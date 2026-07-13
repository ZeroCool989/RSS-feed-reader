// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@/lib/store";
import type { Article, Subscription } from "@/lib/types";

const STORAGE_KEY = "frontpage-store";

const sub = (over: Partial<Subscription> = {}): Subscription => ({
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
  ...over,
});

const article = (id: string, over: Partial<Article> = {}): Article => ({
  id,
  subscriptionId: "sub-1",
  title: id,
  url: `https://mock.example/${id}`,
  author: null,
  publishedAt: "2026-07-13T00:00:00.000Z",
  excerpt: "excerpt",
  contentHtml: "<p>full html content</p>",
  imageUrl: null,
  ...over,
});

function readPersisted() {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw).toBeTruthy();
  return JSON.parse(raw!).state;
}

beforeEach(() => {
  localStorage.clear();
  useStore.getState().resetAll();
});

describe("localStorage persistence", () => {
  it("persists subscriptions, categories, read state and prefs on change", () => {
    useStore.setState({
      subscriptions: [sub()],
      categories: [{ id: "c1", name: "Frontend", order: 0 }],
    });
    useStore.getState().markRead("item-1");
    useStore.getState().setPrefs({ layout: "cards" });

    const persisted = readPersisted();
    expect(persisted.subscriptions).toHaveLength(1);
    expect(persisted.categories[0].name).toBe("Frontend");
    expect(persisted.readIds["item-1"]).toBeTypeOf("number");
    expect(persisted.prefs.layout).toBe("cards");
  });

  it("persists a trimmed article cache: no contentHtml, capped at 25 per feed", () => {
    const many = Array.from({ length: 40 }, (_, i) => article(`a-${i}`));
    useStore.setState({ subscriptions: [sub()], articles: { "sub-1": many } });
    // Trigger a persisted write
    useStore.getState().setPrefs({ hideRead: false });

    const persisted = readPersisted();
    expect(persisted.articles["sub-1"]).toHaveLength(25);
    expect(persisted.articles["sub-1"].every((a: Article) => a.contentHtml === null)).toBe(true);
    // In-memory copy keeps the full content
    expect(useStore.getState().articles["sub-1"][0].contentHtml).toContain("full html");
  });

  it("does not persist transient UI state (toasts, dialogs, refresh flags)", () => {
    useStore.getState().showToast("hello");
    useStore.getState().setAddFeedOpen(true);
    const persisted = readPersisted();
    expect(persisted.toast).toBeUndefined();
    expect(persisted.addFeedOpen).toBeUndefined();
    expect(persisted.refreshingAll).toBeUndefined();
  });

  it("rehydrates a stored snapshot and sets the digest boundary from lastVisitAt", async () => {
    const snapshot = {
      state: {
        seeded: true,
        subscriptions: [sub()],
        categories: [{ id: "c1", name: "Design", order: 0 }],
        readIds: { "old-item": 1750000000000 },
        bookmarks: [],
        prefs: { layout: "compact", theme: "dark", refreshIntervalMin: 15, readerFontSize: "md", hideRead: true, digestCollapsed: [] },
        lastVisitAt: "2026-07-10T08:00:00.000Z",
        articles: {},
      },
      version: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));

    await useStore.persist.rehydrate();

    const state = useStore.getState();
    expect(state.subscriptions[0].title).toBe("Mock Feed");
    expect(state.categories[0].name).toBe("Design");
    expect(state.prefs.layout).toBe("compact");
    expect(state.readIds["old-item"]).toBe(1750000000000);
    // markHydrated ran: previous visit became the digest boundary,
    // and lastVisitAt moved forward to "now"
    expect(state.hydrated).toBe(true);
    expect(state.digestSince).toBe("2026-07-10T08:00:00.000Z");
    expect(Date.parse(state.lastVisitAt!)).toBeGreaterThan(Date.parse("2026-07-10T08:00:00.000Z"));
  });
});
