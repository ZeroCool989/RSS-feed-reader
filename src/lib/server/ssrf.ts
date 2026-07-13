import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF guard for the feed-fetching proxy. Feeds are arbitrary user-supplied
 * URLs, so every fetch (and every redirect hop) must be checked against
 * private/internal address space and cloud metadata endpoints.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

function ipv4ToLong(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function inRange(ip: number, cidrBase: string, maskBits: number): boolean {
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ip & mask) === (ipv4ToLong(cidrBase) & mask);
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToLong(ip);
  return (
    inRange(n, "0.0.0.0", 8) || // "this network"
    inRange(n, "10.0.0.0", 8) ||
    inRange(n, "100.64.0.0", 10) || // CGNAT
    inRange(n, "127.0.0.0", 8) ||
    inRange(n, "169.254.0.0", 16) || // link-local + cloud metadata
    inRange(n, "172.16.0.0", 12) ||
    inRange(n, "192.168.0.0", 16) ||
    inRange(n, "192.0.0.0", 24) ||
    inRange(n, "198.18.0.0", 15) ||
    inRange(n, "224.0.0.0", 3) // multicast + reserved
  );
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // Normalize away zone id (fe80::1%eth0)
  const bare = lower.split("%")[0];
  if (bare === "::" || bare === "::1") return true;
  if (bare.startsWith("fe80:") || bare.startsWith("fc") || bare.startsWith("fd")) return true;
  // IPv4-mapped, dotted form: ::ffff:127.0.0.1
  const mapped = bare.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  // IPv4-mapped, hex form — the WHATWG URL parser normalizes
  // [::ffff:127.0.0.1] to [::ffff:7f00:1], which must not slip through.
  const mappedHex = bare.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateIpv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true; // not an IP we can classify — refuse
}

export interface UrlCheck {
  ok: boolean;
  reason?: string;
  url?: URL;
}

/**
 * Validates scheme + hostname, resolves DNS, and rejects anything pointing at
 * private/internal address space. Call again for every redirect hop.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<UrlCheck> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http(s) URLs are allowed" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URLs with credentials are not allowed" };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    return { ok: false, reason: "Host is not allowed" };
  }

  // Literal IPs (incl. decimal/octal/hex forms that URL normalizes) get
  // checked directly; hostnames get resolved and every address checked.
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) return { ok: false, reason: "Address is not allowed" };
    return { ok: true, url };
  }

  const verdict = await checkHostname(hostname);
  if (!verdict.ok) return verdict;
  return { ok: true, url };
}

/**
 * DNS verdicts are cached briefly — refreshing 20 feeds at once would
 * otherwise burst 40+ lookups and trip local resolver throttling (EAI_AGAIN).
 */
const dnsVerdicts = new Map<string, { ok: boolean; reason?: string; expires: number }>();
const DNS_OK_TTL_MS = 5 * 60 * 1000;
const DNS_FAIL_TTL_MS = 30 * 1000;

async function checkHostname(hostname: string): Promise<UrlCheck> {
  const cached = dnsVerdicts.get(hostname);
  if (cached && cached.expires > Date.now()) {
    return cached.ok ? { ok: true } : { ok: false, reason: cached.reason };
  }

  let verdict: UrlCheck;
  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) {
      verdict = { ok: false, reason: "Host could not be resolved" };
    } else if (addresses.some((addr) => isBlockedIp(addr.address))) {
      verdict = { ok: false, reason: "Host resolves to a private address" };
    } else {
      verdict = { ok: true };
    }
  } catch {
    verdict = { ok: false, reason: "Host could not be resolved" };
  }

  dnsVerdicts.set(hostname, {
    ok: verdict.ok,
    reason: verdict.reason,
    expires: Date.now() + (verdict.ok ? DNS_OK_TTL_MS : DNS_FAIL_TTL_MS),
  });
  if (dnsVerdicts.size > 500) {
    const oldest = dnsVerdicts.keys().next().value;
    if (oldest) dnsVerdicts.delete(oldest);
  }
  return verdict;
}
