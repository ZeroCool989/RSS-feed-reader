// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { articlesForView, healthOf, unreadCount, useStore } from "@/lib/store";
import type { Article, Subscription } from "@/lib/types";

function feedResponse(over: Partial<Record<string, unknown>> = {}) {
  return {
    ok: true,
    json: async () => ({
      meta: {
        title: "Mock Feed",
        description: "d",
        siteUrl: "https://mock.example/",
        feedUrl: "https://mock.example/feed.xml",
        format: "rss2",
        iconUrl: null,
      },
      items: [
        {
          id: "item-1",
          title: "First",
          url: "https://mock.example/1",
          author: null,
          publishedAt: "2026-07-13T10:00:00.000Z",
          excerpt: "one",
          contentHtml: null,
          imageUrl: null,
        },
        {
          id: "item-2",
          title: "Second",
          url: "https://mock.example/2",
          author: null,
          publishedAt: "2026-07-12T10:00:00.000Z",
          excerpt: "two",
          contentHtml: null,
          imageUrl: null,
        },
      ],
      ...over,
    }),
  } as Response;
}

const baseSub = (over: Partial<Subscription>): Subscription => ({
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
  newestItemAt: "2026-07-13T10:00:00.000Z",
  consecutiveFailures: 0,
  ...over,
});

const article = (id: string, subscriptionId: string, publishedAt: string): Article => ({
  id,
  subscriptionId,
  title: id,
  url: `https://mock.example/${id}`,
  author: null,
  publishedAt,
  excerpt: "",
  contentHtml: null,
  imageUrl: null,
});

beforeEach(() => {
  localStorage.clear();
  useStore.getState().resetAll();
  useStore.setState({ toast: null });
  vi.restoreAllMocks();
});

describe("addFeed", () => {
  it("validates via the API and creates a subscription with its articles", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => feedResponse()));
    const result = await useStore.getState().addFeed("https://mock.example/feed.xml", null);
    expect(result.ok).toBe(true);
    const state = useStore.getState();
    expect(state.subscriptions).toHaveLength(1);
    expect(state.articles[result.subscription!.id]).toHaveLength(2);
  });

  it("rejects duplicates case- and slash-insensitively", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => feedResponse()));
    await useStore.getState().addFeed("https://mock.example/feed.xml");
    const dup = await useStore.getState().addFeed("HTTPS://MOCK.example/feed.xml/");
    expect(dup.ok).toBe(false);
    expect(dup.duplicate).toBe(true);
    expect(useStore.getState().subscriptions).toHaveLength(1);
  });

  it("surfaces API errors without creating a subscription", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "Feed not found (404)", kind: "http" }),
      }) as Response)
    );
    const result = await useStore.getState().addFeed("https://dead.example/feed.xml");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/404/);
    expect(useStore.getState().subscriptions).toHaveLength(0);
  });
});

describe("refreshFeed", () => {
  it("merges new items by stable id and records success bookkeeping", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => feedResponse()));
    const sub = baseSub({});
    useStore.setState({
      subscriptions: [sub],
      articles: { "sub-1": [article("item-2", "sub-1", "2026-07-12T10:00:00.000Z")] },
    });
    await useStore.getState().refreshFeed("sub-1");
    const state = useStore.getState();
    expect(state.articles["sub-1"].map((a) => a.id)).toEqual(["item-1", "item-2"]);
    expect(state.subscriptions[0].lastError).toBeNull();
    expect(state.subscriptions[0].consecutiveFailures).toBe(0);
    expect(state.newItemsNotice).toBe(1); // only item-1 is genuinely new
  });

  it("records the error and increments failures on fetch error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "timeout", kind: "timeout" }),
      }) as Response)
    );
    useStore.setState({ subscriptions: [baseSub({})] });
    await useStore.getState().refreshFeed("sub-1");
    const sub = useStore.getState().subscriptions[0];
    expect(sub.lastError).toBe("timeout");
    expect(sub.lastErrorKind).toBe("timeout");
    expect(sub.consecutiveFailures).toBe(1);
    expect(healthOf(sub)).toBe("error");
  });
});

describe("read state", () => {
  it("marks, toggles, and counts unread", () => {
    useStore.setState({
      subscriptions: [baseSub({})],
      articles: {
        "sub-1": [
          article("a", "sub-1", "2026-07-13T00:00:00.000Z"),
          article("b", "sub-1", "2026-07-12T00:00:00.000Z"),
        ],
      },
    });
    expect(unreadCount(useStore.getState(), ["sub-1"])).toBe(2);
    useStore.getState().markRead("a");
    expect(unreadCount(useStore.getState(), ["sub-1"])).toBe(1);
    useStore.getState().toggleRead("a");
    expect(unreadCount(useStore.getState(), ["sub-1"])).toBe(2);
  });

  it("markAllRead scopes to category and supports undo via toast", () => {
    useStore.setState({
      categories: [{ id: "cat-1", name: "Frontend", order: 0 }],
      subscriptions: [baseSub({ id: "sub-1", categoryId: "cat-1" }), baseSub({ id: "sub-2", feedUrl: "https://x.example/f" })],
      articles: {
        "sub-1": [article("a", "sub-1", "2026-07-13T00:00:00.000Z")],
        "sub-2": [article("b", "sub-2", "2026-07-13T00:00:00.000Z")],
      },
    });
    useStore.getState().markAllRead({ type: "category", id: "cat-1" });
    expect(unreadCount(useStore.getState(), ["sub-1"])).toBe(0);
    expect(unreadCount(useStore.getState(), ["sub-2"])).toBe(1);
    // undo restores previous read state
    useStore.getState().toast?.undo?.();
    expect(unreadCount(useStore.getState(), ["sub-1"])).toBe(1);
  });
});

describe("categories", () => {
  it("deleting a category moves its feeds to Uncategorized", () => {
    useStore.setState({
      categories: [{ id: "cat-1", name: "X", order: 0 }],
      subscriptions: [baseSub({ categoryId: "cat-1" })],
    });
    useStore.getState().deleteCategory("cat-1");
    expect(useStore.getState().categories).toHaveLength(0);
    expect(useStore.getState().subscriptions[0].categoryId).toBeNull();
  });

  it("moveCategory reorders and clamps at edges", () => {
    useStore.setState({
      categories: [
        { id: "a", name: "A", order: 0 },
        { id: "b", name: "B", order: 1 },
      ],
    });
    useStore.getState().moveCategory("b", -1);
    const names = [...useStore.getState().categories].sort((x, y) => x.order - y.order).map((c) => c.name);
    expect(names).toEqual(["B", "A"]);
    useStore.getState().moveCategory("b", -1); // already first — no-op
    expect([...useStore.getState().categories].sort((x, y) => x.order - y.order)[0].name).toBe("B");
  });
});

describe("removeFeed", () => {
  it("cleans up articles and resets the view if it pointed at the feed", () => {
    useStore.setState({
      subscriptions: [baseSub({})],
      articles: { "sub-1": [article("a", "sub-1", "2026-07-13T00:00:00.000Z")] },
      view: { type: "feed", id: "sub-1" },
    });
    useStore.getState().removeFeed("sub-1");
    const state = useStore.getState();
    expect(state.subscriptions).toHaveLength(0);
    expect(state.articles["sub-1"]).toBeUndefined();
    expect(state.view).toEqual({ type: "all" });
  });
});

describe("bookmarks + saved view", () => {
  it("toggles bookmarks and sorts saved by savedAt", () => {
    const a = article("a", "sub-1", "2026-07-10T00:00:00.000Z");
    useStore.getState().toggleBookmark(a);
    expect(useStore.getState().isBookmarked("a")).toBe(true);
    const saved = articlesForView(useStore.getState(), { type: "saved" });
    expect(saved.map((x) => x.id)).toEqual(["a"]);
    useStore.getState().toggleBookmark(a);
    expect(useStore.getState().isBookmarked("a")).toBe(false);
  });
});

describe("articlesForView", () => {
  it("sorts reverse-chronologically across feeds and filters by category", () => {
    useStore.setState({
      categories: [{ id: "cat-1", name: "X", order: 0 }],
      subscriptions: [
        baseSub({ id: "sub-1", categoryId: "cat-1" }),
        baseSub({ id: "sub-2", feedUrl: "https://y.example/f" }),
      ],
      articles: {
        "sub-1": [article("old", "sub-1", "2026-07-10T00:00:00.000Z")],
        "sub-2": [article("new", "sub-2", "2026-07-13T00:00:00.000Z")],
      },
    });
    const all = articlesForView(useStore.getState(), { type: "all" });
    expect(all.map((a) => a.id)).toEqual(["new", "old"]);
    const cat = articlesForView(useStore.getState(), { type: "category", id: "cat-1" });
    expect(cat.map((a) => a.id)).toEqual(["old"]);
  });
});

describe("healthOf", () => {
  it("classifies active, stale (30d+ quiet) and erroring feeds", () => {
    expect(healthOf(baseSub({ newestItemAt: new Date().toISOString() }))).toBe("active");
    expect(
      healthOf(baseSub({ newestItemAt: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString() }))
    ).toBe("stale");
    expect(healthOf(baseSub({ lastError: "boom", consecutiveFailures: 2 }))).toBe("error");
  });
});
