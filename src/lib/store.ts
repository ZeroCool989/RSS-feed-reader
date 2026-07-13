"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Article,
  BookmarkedArticle,
  Category,
  FeedError,
  FeedHealth,
  FetchFeedResult,
  Preferences,
  Subscription,
} from "./types";
import { normalizeFeedUrl, uid } from "./utils";
import sampleFeeds from "@/data/sample-feeds.json";

/* ---------------------------------- view ----------------------------------- */

export type View =
  | { type: "all" }
  | { type: "category"; id: string }
  | { type: "feed"; id: string }
  | { type: "saved" }
  | { type: "digest" }
  | { type: "search"; query: string }
  | { type: "feeds-manage" };

/* --------------------------------- fetching -------------------------------- */

export interface AddFeedOutcome {
  ok: boolean;
  subscription?: Subscription;
  error?: string;
  duplicate?: boolean;
}

async function fetchFeed(url: string, fresh = false): Promise<FetchFeedResult> {
  const params = new URLSearchParams({ url });
  if (fresh) params.set("fresh", "1");
  const res = await fetch(`/api/feed?${params}`);
  const json = await res.json();
  if (!res.ok) {
    const err = json as FeedError;
    const e = new Error(err.error || "Failed to fetch feed") as Error & { kind?: string };
    e.kind = err.kind;
    throw e;
  }
  return json as FetchFeedResult;
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length }) as R[];
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/* ---------------------------------- store ---------------------------------- */

const MAX_READ_IDS = 6000;
const ARTICLES_PERSIST_CAP = 25;

export interface FrontpageState {
  hydrated: boolean;
  seeded: boolean;
  subscriptions: Subscription[];
  categories: Category[];
  /** Articles by subscription id. Full content lives in memory; a trimmed
   *  version (no contentHtml, capped) is persisted for instant paint. */
  articles: Record<string, Article[]>;
  /** itemId -> epoch ms when read. */
  readIds: Record<string, number>;
  bookmarks: BookmarkedArticle[];
  prefs: Preferences;
  lastVisitAt: string | null;
  /** Snapshot of lastVisitAt taken at hydration — the digest boundary. */
  digestSince: string | null;

  // transient ui state
  view: View;
  openArticleId: string | null;
  refreshing: Record<string, boolean>;
  refreshingAll: boolean;
  lastRefreshAt: string | null;
  newItemsNotice: number;
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  shortcutsOpen: boolean;
  addFeedOpen: boolean;
  addFeedTab: "url" | "discover" | "opml" | null;
  toast: { message: string; undo?: () => void } | null;

  // actions
  markHydrated: () => void;
  seedGuest: () => void;
  setView: (view: View) => void;
  openArticle: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setAddFeedOpen: (open: boolean, tab?: "url" | "discover" | "opml") => void;
  showToast: (message: string, undo?: () => void) => void;
  dismissToast: () => void;

  addFeed: (url: string, categoryId?: string | null, customTitle?: string | null) => Promise<AddFeedOutcome>;
  removeFeed: (id: string) => void;
  updateSubscription: (id: string, patch: Partial<Pick<Subscription, "customTitle" | "categoryId">>) => void;
  refreshFeed: (id: string, fresh?: boolean) => Promise<void>;
  refreshAll: (fresh?: boolean) => Promise<void>;

  addCategory: (name: string) => Category;
  renameCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => void;
  moveCategory: (id: string, direction: -1 | 1) => void;

  markRead: (itemId: string) => void;
  markUnread: (itemId: string) => void;
  toggleRead: (itemId: string) => void;
  markAllRead: (scope: { type: "all" } | { type: "category"; id: string } | { type: "feed"; id: string }) => void;

  toggleBookmark: (article: Article) => void;
  isBookmarked: (itemId: string) => boolean;

  setPrefs: (patch: Partial<Preferences>) => void;
  resetAll: () => void;
}

const defaultPrefs: Preferences = {
  layout: "list",
  theme: "system",
  refreshIntervalMin: 30,
  readerFontSize: "md",
  hideRead: false,
  digestCollapsed: [],
};

function healthOf(sub: Subscription): FeedHealth {
  if (sub.lastError && sub.consecutiveFailures > 0) return "error";
  const newest = sub.newestItemAt ? Date.parse(sub.newestItemAt) : NaN;
  if (!Number.isNaN(newest) && Date.now() - newest > 30 * 24 * 3600 * 1000) return "stale";
  return "active";
}

export { healthOf };

function pruneReadIds(readIds: Record<string, number>): Record<string, number> {
  const entries = Object.entries(readIds);
  if (entries.length <= MAX_READ_IDS) return readIds;
  entries.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(entries.slice(0, MAX_READ_IDS));
}

export const useStore = create<FrontpageState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      seeded: false,
      subscriptions: [],
      categories: [],
      articles: {},
      readIds: {},
      bookmarks: [],
      prefs: defaultPrefs,
      lastVisitAt: null,
      digestSince: null,

      view: { type: "all" },
      openArticleId: null,
      refreshing: {},
      refreshingAll: false,
      lastRefreshAt: null,
      newItemsNotice: 0,
      sidebarOpen: false,
      commandPaletteOpen: false,
      shortcutsOpen: false,
      addFeedOpen: false,
      addFeedTab: null,
      toast: null,

      markHydrated: () => {
        const { lastVisitAt } = get();
        set({
          hydrated: true,
          digestSince: lastVisitAt,
          lastVisitAt: new Date().toISOString(),
        });
      },

      seedGuest: () => {
        if (get().seeded) return;
        const categories: Category[] = sampleFeeds.categories.map((c, i) => ({
          id: uid(),
          name: c.name,
          order: i,
        }));
        const subscriptions: Subscription[] = sampleFeeds.categories.flatMap((c, i) =>
          c.feeds.map((f) => ({
            id: uid(),
            feedUrl: f.feedUrl,
            siteUrl: f.siteUrl,
            title: f.title,
            customTitle: null,
            description: f.description ?? "",
            iconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
              new URL(f.siteUrl).hostname
            )}&sz=64`,
            categoryId: categories[i].id,
            addedAt: new Date().toISOString(),
            lastFetchedAt: null,
            lastSuccessAt: null,
            lastError: null,
            lastErrorKind: null,
            newestItemAt: null,
            consecutiveFailures: 0,
          }))
        );
        set({ categories, subscriptions, seeded: true });
      },

      setView: (view) => set({ view, openArticleId: null, sidebarOpen: false }),
      openArticle: (id) => set({ openArticleId: id }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
      setAddFeedOpen: (open, tab) => set({ addFeedOpen: open, addFeedTab: open ? (tab ?? null) : null }),
      showToast: (message, undo) => {
        set({ toast: { message, undo } });
        setTimeout(() => {
          if (get().toast?.message === message) set({ toast: null });
        }, 6000);
      },
      dismissToast: () => set({ toast: null }),

      addFeed: async (url, categoryId = null, customTitle = null) => {
        const normalized = normalizeFeedUrl(url);
        const existing = get().subscriptions.find((s) => normalizeFeedUrl(s.feedUrl) === normalized);
        if (existing) {
          return { ok: false, duplicate: true, error: "You're already subscribed to this feed" };
        }
        try {
          const result = await fetchFeed(url.trim(), true);
          const now = new Date().toISOString();
          const sub: Subscription = {
            id: uid(),
            feedUrl: result.permanentRedirect ?? url.trim(),
            siteUrl: result.meta.siteUrl,
            title: result.meta.title,
            customTitle,
            description: result.meta.description,
            iconUrl: result.meta.iconUrl,
            categoryId,
            addedAt: now,
            lastFetchedAt: now,
            lastSuccessAt: now,
            lastError: null,
            lastErrorKind: null,
            newestItemAt: result.items[0]?.publishedAt ?? null,
            consecutiveFailures: 0,
          };
          const articles: Article[] = result.items.map((i) => ({ ...i, subscriptionId: sub.id }));
          set((s) => ({
            subscriptions: [...s.subscriptions, sub],
            articles: { ...s.articles, [sub.id]: articles },
          }));
          return { ok: true, subscription: sub };
        } catch (err) {
          return { ok: false, error: (err as Error).message };
        }
      },

      removeFeed: (id) => {
        const sub = get().subscriptions.find((s) => s.id === id);
        if (!sub) return;
        set((s) => {
          const articles = { ...s.articles };
          delete articles[id];
          return {
            subscriptions: s.subscriptions.filter((x) => x.id !== id),
            articles,
            view: s.view.type === "feed" && s.view.id === id ? { type: "all" } : s.view,
          };
        });
      },

      updateSubscription: (id, patch) =>
        set((s) => ({
          subscriptions: s.subscriptions.map((sub) => (sub.id === id ? { ...sub, ...patch } : sub)),
        })),

      refreshFeed: async (id, fresh = false) => {
        const sub = get().subscriptions.find((s) => s.id === id);
        if (!sub || get().refreshing[id]) return;
        set((s) => ({ refreshing: { ...s.refreshing, [id]: true } }));
        const now = new Date().toISOString();
        try {
          const result = await fetchFeed(sub.feedUrl, fresh);
          const incoming: Article[] = result.items.map((i) => ({ ...i, subscriptionId: id }));
          set((s) => {
            const prev = s.articles[id] ?? [];
            // Dedup by stable id; incoming wins (content may have been updated).
            const prevById = new Map(prev.map((a) => [a.id, a]));
            for (const a of incoming) prevById.delete(a.id);
            const merged = [...incoming, ...prevById.values()].slice(0, 300);
            // First fetch for a feed isn't "news" — only count genuinely new
            // items appearing on top of an already-populated feed.
            const newCount =
              prev.length === 0
                ? 0
                : incoming.filter((a) => !prev.some((p) => p.id === a.id)).length;
            return {
              articles: { ...s.articles, [id]: merged },
              newItemsNotice: s.newItemsNotice + newCount,
              subscriptions: s.subscriptions.map((x) =>
                x.id === id
                  ? {
                      ...x,
                      title: result.meta.title || x.title,
                      description: result.meta.description || x.description,
                      iconUrl: result.meta.iconUrl ?? x.iconUrl,
                      feedUrl: result.permanentRedirect ?? x.feedUrl,
                      lastFetchedAt: now,
                      lastSuccessAt: now,
                      lastError: null,
                      lastErrorKind: null,
                      newestItemAt: merged[0]?.publishedAt ?? x.newestItemAt,
                      consecutiveFailures: 0,
                    }
                  : x
              ),
            };
          });
        } catch (err) {
          const e = err as Error & { kind?: Subscription["lastErrorKind"] };
          set((s) => ({
            subscriptions: s.subscriptions.map((x) =>
              x.id === id
                ? {
                    ...x,
                    lastFetchedAt: now,
                    lastError: e.message,
                    lastErrorKind: e.kind ?? "network",
                    consecutiveFailures: x.consecutiveFailures + 1,
                  }
                : x
            ),
          }));
        } finally {
          set((s) => {
            const refreshing = { ...s.refreshing };
            delete refreshing[id];
            return { refreshing };
          });
        }
      },

      refreshAll: async (fresh = false) => {
        if (get().refreshingAll) return;
        set({ refreshingAll: true, newItemsNotice: 0 });
        const { subscriptions, refreshFeed } = get();
        // Exponential backoff: skip feeds that keep failing until enough time
        // has passed (2^failures × 5 min, capped at 6h).
        const due = subscriptions.filter((sub) => {
          if (sub.consecutiveFailures === 0 || !sub.lastFetchedAt) return true;
          const wait = Math.min(2 ** sub.consecutiveFailures * 5 * 60_000, 6 * 3600_000);
          return Date.now() - Date.parse(sub.lastFetchedAt) > wait;
        });
        await pool(due, 6, (sub) => refreshFeed(sub.id, fresh));
        set({ refreshingAll: false, lastRefreshAt: new Date().toISOString() });
      },

      addCategory: (name) => {
        const cat: Category = { id: uid(), name, order: get().categories.length };
        set((s) => ({ categories: [...s.categories, cat] }));
        return cat;
      },

      renameCategory: (id, name) =>
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, name } : c)),
        })),

      deleteCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          subscriptions: s.subscriptions.map((sub) =>
            sub.categoryId === id ? { ...sub, categoryId: null } : sub
          ),
          view: s.view.type === "category" && s.view.id === id ? { type: "all" } : s.view,
        })),

      moveCategory: (id, direction) =>
        set((s) => {
          const sorted = [...s.categories].sort((a, b) => a.order - b.order);
          const idx = sorted.findIndex((c) => c.id === id);
          const swap = idx + direction;
          if (idx < 0 || swap < 0 || swap >= sorted.length) return {};
          [sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]];
          return { categories: sorted.map((c, i) => ({ ...c, order: i })) };
        }),

      markRead: (itemId) =>
        set((s) =>
          s.readIds[itemId] ? {} : { readIds: pruneReadIds({ ...s.readIds, [itemId]: Date.now() }) }
        ),

      markUnread: (itemId) =>
        set((s) => {
          const readIds = { ...s.readIds };
          delete readIds[itemId];
          return { readIds };
        }),

      toggleRead: (itemId) => {
        const { readIds, markRead, markUnread } = get();
        if (readIds[itemId]) markUnread(itemId);
        else markRead(itemId);
      },

      markAllRead: (scope) => {
        const { subscriptions, articles, readIds, showToast } = get();
        const subIds =
          scope.type === "all"
            ? subscriptions.map((s) => s.id)
            : scope.type === "feed"
              ? [scope.id]
              : subscriptions.filter((s) => s.categoryId === scope.id).map((s) => s.id);
        const previous = { ...readIds };
        const now = Date.now();
        const next = { ...readIds };
        let count = 0;
        for (const subId of subIds) {
          for (const a of articles[subId] ?? []) {
            if (!next[a.id]) {
              next[a.id] = now;
              count++;
            }
          }
        }
        if (count === 0) return;
        set({ readIds: pruneReadIds(next) });
        showToast(`Marked ${count} item${count === 1 ? "" : "s"} as read`, () =>
          set({ readIds: previous })
        );
      },

      toggleBookmark: (article) => {
        const { bookmarks } = get();
        if (bookmarks.some((b) => b.id === article.id)) {
          set({ bookmarks: bookmarks.filter((b) => b.id !== article.id) });
        } else {
          set({ bookmarks: [{ ...article, savedAt: new Date().toISOString() }, ...bookmarks] });
        }
      },

      isBookmarked: (itemId) => get().bookmarks.some((b) => b.id === itemId),

      setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch } })),

      resetAll: () =>
        set({
          seeded: false,
          subscriptions: [],
          categories: [],
          articles: {},
          readIds: {},
          bookmarks: [],
          prefs: defaultPrefs,
          view: { type: "all" },
          openArticleId: null,
        }),
    }),
    {
      name: "frontpage-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        seeded: s.seeded,
        subscriptions: s.subscriptions,
        categories: s.categories,
        readIds: s.readIds,
        bookmarks: s.bookmarks,
        prefs: s.prefs,
        lastVisitAt: s.lastVisitAt,
        // Trimmed article cache: instant paint on next visit without
        // blowing the localStorage quota (full HTML stays in memory only).
        articles: Object.fromEntries(
          Object.entries(s.articles).map(([subId, list]) => [
            subId,
            list.slice(0, ARTICLES_PERSIST_CAP).map((a) => ({ ...a, contentHtml: null })),
          ])
        ),
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    }
  )
);

/* -------------------------------- selectors -------------------------------- */

export function articlesForView(state: FrontpageState, view: View): Article[] {
  const { subscriptions, articles, bookmarks } = state;
  let subIds: string[];
  switch (view.type) {
    case "feed":
      subIds = [view.id];
      break;
    case "category":
      subIds = subscriptions.filter((s) => s.categoryId === view.id).map((s) => s.id);
      break;
    case "saved":
      return [...bookmarks].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
    default:
      subIds = subscriptions.map((s) => s.id);
  }
  const all = subIds.flatMap((id) => articles[id] ?? []);
  return all.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });
}

export function unreadCount(state: FrontpageState, subIds: string[]): number {
  let count = 0;
  for (const id of subIds) {
    for (const a of state.articles[id] ?? []) {
      if (!state.readIds[a.id]) count++;
    }
  }
  return count;
}
