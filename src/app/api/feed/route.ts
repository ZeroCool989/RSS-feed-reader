import { NextRequest, NextResponse } from "next/server";
import { assertPublicHttpUrl } from "@/lib/server/ssrf";
import { looksLikeFeed, parseFeedXml } from "@/lib/server/parser";
import type { FeedError, FetchFeedResult } from "@/lib/types";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const CACHE_TTL_MS = 10 * 60 * 1000;

/* ------------------------------ server cache ------------------------------ */

interface CacheEntry {
  fetchedAt: number;
  etag: string | null;
  lastModified: string | null;
  result: FetchFeedResult;
}

const globalCache = globalThis as unknown as { __feedCache?: Map<string, CacheEntry> };
const cache = (globalCache.__feedCache ??= new Map<string, CacheEntry>());

/* ------------------------------ rate limiting ----------------------------- */

const globalRl = globalThis as unknown as { __feedRl?: Map<string, number[]> };
const rlBuckets = (globalRl.__feedRl ??= new Map<string, number[]>());
const RL_WINDOW_MS = 60_000;
// Counted only on cache misses — the limit protects upstream feed servers,
// not our own cache. A full refresh of ~20 feeds is 20 upstream fetches.
const RL_MAX = 300;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = (rlBuckets.get(key) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  if (bucket.length >= RL_MAX) return true;
  bucket.push(now);
  rlBuckets.set(key, bucket);
  return false;
}

/* --------------------------------- fetching -------------------------------- */

/**
 * Global cap on concurrent upstream fetches. A "refresh all" from several
 * tabs (or an OPML import racing a guest boot) can otherwise burst 40+
 * simultaneous fetches, exhausting sockets/DNS and failing spuriously.
 */
const globalSem = globalThis as unknown as {
  __feedSem?: { active: number; queue: Array<() => void> };
};
const sem = (globalSem.__feedSem ??= { active: 0, queue: [] });
const MAX_CONCURRENT_UPSTREAM = 8;

async function withUpstreamSlot<T>(fn: () => Promise<T>): Promise<T> {
  while (sem.active >= MAX_CONCURRENT_UPSTREAM) {
    await new Promise<void>((resolve) => sem.queue.push(resolve));
  }
  sem.active++;
  try {
    return await fn();
  } finally {
    sem.active--;
    sem.queue.shift()?.();
  }
}

function detectCharset(contentType: string | null, bytes: Uint8Array): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader;
  // Sniff the XML declaration from the first bytes (ASCII-compatible prefix)
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 256));
  const fromXml = head.match(/encoding=["']([\w-]+)["']/i)?.[1];
  return fromXml ?? "utf-8";
}

function decodeBody(bytes: Uint8Array, charset: string): string {
  const normalized = charset.toLowerCase();
  try {
    return new TextDecoder(normalized, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      reader.cancel();
      throw new Error("Feed exceeds maximum size");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

interface FetchOutcome {
  response: Response;
  finalUrl: string;
  permanentRedirect: string | null;
}

/** Follow redirects manually so every hop passes the SSRF check. */
async function fetchWithChecks(startUrl: string, conditional: HeadersInit): Promise<FetchOutcome> {
  let currentUrl = startUrl;
  let permanentRedirect: string | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = await assertPublicHttpUrl(currentUrl);
    if (!check.ok) {
      const err = new Error(check.reason ?? "URL not allowed");
      (err as Error & { kind?: string }).kind = "blocked";
      throw err;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "FrontpageReader/1.0 (+https://frontpage.example)",
          accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8",
          ...conditional,
        },
      });
    } finally {
      clearTimeout(timer);
    }

    // 304 Not Modified is a revalidation result, not a redirect
    if (response.status >= 300 && response.status < 400 && response.status !== 304) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect without location");
      const nextUrl = new URL(location, currentUrl).href;
      if (response.status === 301 || response.status === 308) {
        permanentRedirect = nextUrl;
      }
      currentUrl = nextUrl;
      continue;
    }

    return { response, finalUrl: currentUrl, permanentRedirect };
  }
  throw new Error("Too many redirects");
}

/* ---------------------------------- route ---------------------------------- */

function errorJson(error: string, kind: FeedError["kind"], httpStatus: number, status?: number) {
  const body: FeedError = { error, kind };
  if (status !== undefined) body.status = status;
  return NextResponse.json(body, { status: httpStatus });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || url.length > 2048) {
    return errorJson("Missing or invalid ?url parameter", "invalid-url", 400);
  }

  const forceFresh = req.nextUrl.searchParams.get("fresh") === "1";
  const cached = cache.get(url);
  if (cached && !forceFresh && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached.result, {
      headers: { "x-feed-cache": "hit" },
    });
  }

  // Rate-limit upstream fetches only; cache hits above are always served.
  const clientKey = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (rateLimited(clientKey)) {
    // Fall back to slightly stale cache instead of failing outright.
    if (cached) {
      return NextResponse.json(cached.result, { headers: { "x-feed-cache": "stale" } });
    }
    return errorJson("Too many requests — slow down", "network", 429);
  }

  const conditional: Record<string, string> = {};
  if (cached?.etag) conditional["if-none-match"] = cached.etag;
  if (cached?.lastModified) conditional["if-modified-since"] = cached.lastModified;

  try {
    // Fetch + body read hold an upstream slot so bursts don't exhaust
    // sockets/DNS; includes one retry for transient network hiccups.
    const { response, finalUrl, permanentRedirect, bytes } = await withUpstreamSlot(async () => {
      let outcome: FetchOutcome;
      try {
        outcome = await fetchWithChecks(url, conditional);
      } catch (err) {
        // Retrying won't fix timeouts or blocked URLs.
        const e = err as Error & { kind?: string };
        if (e.name === "AbortError" || e.kind === "blocked") throw err;
        await new Promise((r) => setTimeout(r, 400));
        outcome = await fetchWithChecks(url, conditional);
      }
      const body = outcome.response.ok ? await readCapped(outcome.response) : null;
      return { ...outcome, bytes: body };
    });

    if (response.status === 304 && cached) {
      cached.fetchedAt = Date.now();
      return NextResponse.json(cached.result, { headers: { "x-feed-cache": "revalidated" } });
    }

    if (!response.ok || bytes === null) {
      const msg =
        response.status === 404
          ? "Feed not found (404) — it may have moved or been removed"
          : response.status === 410
            ? "Feed permanently gone (410)"
            : `Feed server returned HTTP ${response.status}`;
      return errorJson(msg, "http", 502, response.status);
    }
    const charset = detectCharset(response.headers.get("content-type"), bytes);
    const body = decodeBody(bytes, charset);

    if (!looksLikeFeed(body)) {
      return errorJson(
        "URL did not return an RSS or Atom feed (got HTML or other content)",
        "not-a-feed",
        422
      );
    }

    const result = parseFeedXml(body, finalUrl);
    if (permanentRedirect) result.permanentRedirect = permanentRedirect;

    cache.set(url, {
      fetchedAt: Date.now(),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      result,
    });
    // Bound the cache — drop oldest entries beyond 200 feeds.
    if (cache.size > 200) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0];
      if (oldest) cache.delete(oldest[0]);
    }

    return NextResponse.json(result, { headers: { "x-feed-cache": "miss" } });
  } catch (err) {
    const e = err as Error & { kind?: FeedError["kind"] };
    if (e.name === "AbortError" || e.name === "TimeoutError") {
      return errorJson("Feed timed out after 10 seconds", "timeout", 504);
    }
    if (e.kind === "blocked") {
      return errorJson(e.message, "blocked", 400);
    }
    if (e.message?.includes("could not be parsed") || e.message?.includes("Not a recognized")) {
      return errorJson(e.message, "parse", 422);
    }
    return errorJson("Could not reach the feed server", "network", 502);
  }
}
