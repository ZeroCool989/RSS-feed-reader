"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUp, BookmarkX, FileUp, Globe, Inbox, Rss, SearchX, Sparkles, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useStore, articlesForView } from "@/lib/store";
import { useKeyboard } from "@/hooks/useKeyboard";
import { pluralize } from "@/lib/utils";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import ItemList from "./ItemList";
import ArticleReader from "./ArticleReader";
import DigestView from "./DigestView";
import ManageFeeds from "./ManageFeeds";
import AddFeedDialog from "./AddFeedDialog";
import CommandPalette from "./CommandPalette";
import ShortcutsHelp from "./ShortcutsHelp";
import Toast from "./Toast";

/* ------------------------------- empty states ------------------------------ */

function Onboarding() {
  const seedGuest = useStore((s) => s.seedGuest);
  const setAddFeedOpen = useStore((s) => s.setAddFeedOpen);
  const options = [
    {
      icon: Sparkles,
      title: "Start with curated feeds",
      body: "19 hand-picked sources across Frontend, Design, DevOps, Tech and AI. The fastest way to a full front page.",
      cta: "Load the starter pack",
      primary: true,
      action: () => {
        seedGuest();
        useStore.getState().refreshAll();
      },
    },
    {
      icon: Globe,
      title: "Add a feed you love",
      body: "Paste any RSS or Atom URL — a favorite blog, a newsletter, a changelog.",
      cta: "Add a feed",
      action: () => setAddFeedOpen(true, "url"),
    },
    {
      icon: FileUp,
      title: "Bring your subscriptions",
      body: "Coming from Feedly, Inoreader or another reader? Import your OPML file — categories included.",
      cta: "Import OPML",
      action: () => setAddFeedOpen(true, "opml"),
    },
  ];

  return (
    <div className="mx-auto max-w-feed px-6 py-14">
      <div className="text-center">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-accent">
          <Rss className="size-7 text-white" strokeWidth={2.5} />
        </span>
        <h1 className="text-xl font-bold tracking-tight">Welcome to Frontpage</h1>
        <p className="mx-auto mt-3 max-w-md text-base text-text-secondary">
          Your front page starts with your sources. Pick a path — you can always change everything
          later.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {options.map(({ icon: Icon, title, body, cta, primary, action }) => (
          <div
            key={title}
            className="flex flex-col rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent-subtle">
              <Icon className="size-4.5 text-accent" />
            </span>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-text-secondary">{body}</p>
            <button
              onClick={action}
              className={
                primary
                  ? "mt-4 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
                  : "mt-4 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text-secondary hover:border-accent hover:text-accent"
              }
            >
              {cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="mx-auto max-w-feed divide-y divide-border-subtle" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex gap-4 px-6 py-4">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="skeleton size-4 rounded-full" />
              <div className="skeleton h-3 w-28" />
            </div>
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-2/3" />
          </div>
          <div className="skeleton hidden size-20 rounded-lg sm:block" />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- main app -------------------------------- */

export default function ReaderApp() {
  const searchParams = useSearchParams();
  // Subscribe to precise slices — a bare useStore() would re-render this
  // shell on every store change (each toast, each refresh tick).
  const { hydrated, subscriptions, categories, view, prefs, refreshingAll, newItemsNotice, openArticleId, articles, bookmarks, readIds } =
    useStore(
      useShallow((s) => ({
        hydrated: s.hydrated,
        subscriptions: s.subscriptions,
        categories: s.categories,
        view: s.view,
        prefs: s.prefs,
        refreshingAll: s.refreshingAll,
        newItemsNotice: s.newItemsNotice,
        openArticleId: s.openArticleId,
        articles: s.articles,
        bookmarks: s.bookmarks,
        readIds: s.readIds,
      }))
    );
  const setPrefs = useStore((s) => s.setPrefs);
  const refreshAll = useStore((s) => s.refreshAll);

  const [selectedIndex, setSelectedIndexRaw] = useState(-1);
  const setSelectedIndex = useCallback(
    (fn: (i: number) => number) => setSelectedIndexRaw((i) => fn(i)),
    []
  );
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);
  const isGuest = searchParams.get("guest") === "1";
  const bootRef = useRef(false);

  /* Boot: seed guest mode, then refresh feeds once per session. */
  useEffect(() => {
    if (!hydrated || bootRef.current) return;
    bootRef.current = true;
    const state = useStore.getState();
    if (isGuest && !state.seeded && state.subscriptions.length === 0) {
      state.seedGuest();
    }
    if (useStore.getState().subscriptions.length > 0) {
      refreshAll();
    }
  }, [hydrated, isGuest, refreshAll]);

  /* Configurable auto-refresh. */
  useEffect(() => {
    if (!prefs.refreshIntervalMin) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refreshAll();
    }, prefs.refreshIntervalMin * 60_000);
    return () => clearInterval(id);
  }, [prefs.refreshIntervalMin, refreshAll]);

  /* Reset keyboard selection when switching views. */
  const viewKey = JSON.stringify(view);
  useEffect(() => setSelectedIndexRaw(-1), [viewKey]);

  /* Current article list (also drives the reader's next/prev). */
  const baseArticles = useMemo(() => {
    const data = { subscriptions, articles, bookmarks };
    if (view.type === "search") {
      const q = view.query.toLowerCase();
      const subsById = new Map(subscriptions.map((s) => [s.id, s]));
      return articlesForView(data, { type: "all" }).filter((a) => {
        const source = subsById.get(a.subscriptionId);
        return (
          a.title.toLowerCase().includes(q) ||
          a.excerpt.toLowerCase().includes(q) ||
          (a.author?.toLowerCase().includes(q) ?? false) ||
          ((source?.customTitle ?? source?.title)?.toLowerCase().includes(q) ?? false)
        );
      });
    }
    if (view.type === "digest" || view.type === "feeds-manage") return [];
    return articlesForView(data, view);
  }, [articles, bookmarks, subscriptions, view]);

  const visibleArticles = useMemo(
    () =>
      prefs.hideRead && view.type !== "saved"
        ? baseArticles.filter((a) => !readIds[a.id])
        : baseArticles,
    [baseArticles, prefs.hideRead, readIds, view.type]
  );

  useKeyboard({ articles: visibleArticles, selectedIndex, setSelectedIndex });

  if (!hydrated) {
    return (
      <div className="flex min-h-screen bg-bg-primary">
        <div className="hidden w-sidebar shrink-0 border-r border-border-subtle bg-bg-secondary lg:block" />
        <div className="flex-1 pt-16">
          <SkeletonList />
        </div>
      </div>
    );
  }

  const showOnboarding = subscriptions.length === 0;

  const title = (() => {
    switch (view.type) {
      case "all":
        return "All items";
      case "saved":
        return "Saved";
      case "digest":
        return "Digest";
      case "feeds-manage":
        return "Manage feeds";
      case "search":
        return `Results for “${view.query}”`;
      case "category":
        return categories.find((c) => c.id === view.id)?.name ?? "Category";
      case "feed": {
        const sub = subscriptions.find((s) => s.id === view.id);
        return sub ? (sub.customTitle ?? sub.title) : "Feed";
      }
    }
  })();

  const emptyMessage = (() => {
    if (view.type === "search")
      return (
        <div className="text-text-secondary">
          <SearchX className="mx-auto size-8 text-text-tertiary" />
          <p className="mt-3 text-sm font-medium">No results for “{view.query}”</p>
          <p className="mt-1 text-sm text-text-tertiary">
            Check the spelling, or try a shorter, more general term.
          </p>
        </div>
      );
    if (view.type === "saved")
      return (
        <div className="text-text-secondary">
          <BookmarkX className="mx-auto size-8 text-text-tertiary" />
          <p className="mt-3 text-sm font-medium">Nothing saved yet</p>
          <p className="mt-1 text-sm text-text-tertiary">
            Tap the bookmark icon on any article to keep it here for later.
          </p>
        </div>
      );
    if (prefs.hideRead && baseArticles.length > 0)
      return (
        <div className="text-text-secondary">
          <Inbox className="mx-auto size-8 text-text-tertiary" />
          <p className="mt-3 text-sm font-medium">All read — nice work</p>
          <button
            onClick={() => setPrefs({ hideRead: false })}
            className="mt-2 text-sm font-medium text-accent hover:underline"
          >
            Show read items
          </button>
        </div>
      );
    return (
      <div className="text-text-secondary">
        <Inbox className="mx-auto size-8 text-text-tertiary" />
        <p className="mt-3 text-sm font-medium">No articles here yet</p>
        <p className="mt-1 text-sm text-text-tertiary">
          Refresh your feeds, or add more sources to fill this view.
        </p>
      </div>
    );
  })();

  const listView = !["digest", "feeds-manage"].includes(view.type);

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {showOnboarding ? (
          <Onboarding />
        ) : (
          <>
            <TopBar title={title} itemCount={listView ? visibleArticles.length : undefined} />

            {/* Guest nudge — gentle, dismissible */}
            {isGuest && !guestBannerDismissed && (
              <div className="flex items-center gap-3 border-b border-border-subtle bg-accent-subtle px-4 py-2 text-sm text-text-secondary sm:px-6">
                <Sparkles className="size-4 shrink-0 text-accent" />
                <p className="min-w-0 flex-1">
                  You&apos;re browsing as a guest with curated feeds. Your reading data stays in
                  this browser — add your own feeds to make it yours.
                </p>
                <button
                  onClick={() => setGuestBannerDismissed(true)}
                  className="shrink-0 rounded p-1 text-text-tertiary hover:text-text-primary"
                  aria-label="Dismiss guest notice"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {/* Unread filter + new items notice */}
            {listView && (
              <div className="flex items-center gap-3 px-4 pt-3 sm:px-6">
                {view.type !== "saved" && (
                  <button
                    onClick={() => setPrefs({ hideRead: !prefs.hideRead })}
                    aria-pressed={prefs.hideRead}
                    className={
                      prefs.hideRead
                        ? "rounded-full bg-accent-subtle px-3 py-1 text-xs font-semibold text-accent"
                        : "rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
                    }
                  >
                    Unread only
                  </button>
                )}
                {newItemsNotice > 0 && !refreshingAll && (
                  <button
                    onClick={() => {
                      useStore.setState({ newItemsNotice: 0 });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-accent-hover"
                  >
                    <ArrowUp className="size-3" />
                    {pluralize(newItemsNotice, "new item")}
                  </button>
                )}
              </div>
            )}

            <main className="min-w-0 flex-1" aria-label={title}>
              {view.type === "digest" ? (
                <DigestView />
              ) : view.type === "feeds-manage" ? (
                <ManageFeeds />
              ) : refreshingAll && visibleArticles.length === 0 ? (
                <SkeletonList />
              ) : (
                <ItemList
                  articles={visibleArticles}
                  layout={prefs.layout}
                  selectedIndex={selectedIndex}
                  query={view.type === "search" ? view.query : undefined}
                  emptyMessage={emptyMessage}
                />
              )}
            </main>
          </>
        )}
      </div>

      {/* Overlays */}
      {openArticleId && <ArticleReader articles={visibleArticles} />}
      <AddFeedDialog />
      <CommandPalette />
      <ShortcutsHelp />
      <Toast />
    </div>
  );
}
