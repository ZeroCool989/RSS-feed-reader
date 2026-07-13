// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/lib/store";
import type { Subscription } from "@/lib/types";

/**
 * Negative-path tests: the store must degrade gracefully when the API
 * returns unexpected shapes, not just clean errors.
 */

const sub = (): Subscription => ({
  id: "sub-1",
  feedUrl: "https://mock.example/feed.xml",
  siteUrl: "https://mock.example/",
  title: "Mock Feed",
  customTitle: null,
  description: "",
  iconUrl: null,
  categoryId: null,
  addedAt: "2026-01-01T00:00:00.000Z",
  lastFetchedAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastErrorKind: null,
  newestItemAt: null,
  consecutiveFailures: 0,
});

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

beforeEach(() => {
  localStorage.clear();
  useStore.getState().resetAll();
  vi.restoreAllMocks();
});

describe("addFeed with malformed API responses", () => {
  it("fails gracefully when items is missing entirely", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ meta: { title: "X", siteUrl: "", feedUrl: "", description: "", format: "rss2", iconUrl: null } })));
    const result = await useStore.getState().addFeed("https://mock.example/feed.xml");
    expect(result.ok).toBe(false);
    expect(useStore.getState().subscriptions).toHaveLength(0);
  });

  it("fails gracefully when the body is not JSON-shaped at all", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => { throw new SyntaxError("bad json"); } }) as unknown as Response));
    const result = await useStore.getState().addFeed("https://mock.example/feed.xml");
    expect(result.ok).toBe(false);
    expect(useStore.getState().subscriptions).toHaveLength(0);
  });

  it("fails gracefully when fetch itself rejects (network down)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const result = await useStore.getState().addFeed("https://mock.example/feed.xml");
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("refreshFeed with malformed API responses", () => {
  it("handles an empty items array without disturbing existing articles", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      meta: { title: "Mock Feed", siteUrl: "https://mock.example/", feedUrl: "https://mock.example/feed.xml", description: "", format: "rss2", iconUrl: null },
      items: [],
    })));
    useStore.setState({
      subscriptions: [sub()],
      articles: { "sub-1": [{ id: "keep", subscriptionId: "sub-1", title: "keep", url: "https://x/1", author: null, publishedAt: null, excerpt: "", contentHtml: null, imageUrl: null }] },
    });
    await useStore.getState().refreshFeed("sub-1");
    const state = useStore.getState();
    expect(state.articles["sub-1"].map((a) => a.id)).toEqual(["keep"]);
    expect(state.subscriptions[0].lastError).toBeNull();
  });

  it("records an error and keeps articles when the response shape explodes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ meta: null, items: null })));
    useStore.setState({
      subscriptions: [sub()],
      articles: { "sub-1": [{ id: "keep", subscriptionId: "sub-1", title: "keep", url: "https://x/1", author: null, publishedAt: null, excerpt: "", contentHtml: null, imageUrl: null }] },
    });
    await useStore.getState().refreshFeed("sub-1");
    const state = useStore.getState();
    expect(state.articles["sub-1"]).toHaveLength(1);
    expect(state.subscriptions[0].consecutiveFailures).toBe(1);
    expect(state.subscriptions[0].lastError).toBeTruthy();
  });
});
