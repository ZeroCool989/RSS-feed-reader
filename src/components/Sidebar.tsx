"use client";

import { useMemo, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Inbox,
  Rss,
  Settings2,
  Sparkles,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { useStore, unreadCount, type View } from "@/lib/store";
import { cn } from "@/lib/utils";
import Favicon from "./Favicon";

function NavRow({
  active,
  onClick,
  icon,
  label,
  count,
  indent,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  indent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
        indent && "pl-8",
        active
          ? "bg-accent-subtle font-medium text-accent"
          : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            active ? "text-accent" : "text-text-tertiary"
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

export default function Sidebar() {
  const { subscriptions, categories, view, sidebarOpen, bookmarkCount, articles, readIds } = useStore(
    useShallow((s) => ({
      subscriptions: s.subscriptions,
      categories: s.categories,
      view: s.view,
      sidebarOpen: s.sidebarOpen,
      bookmarkCount: s.bookmarks.length,
      articles: s.articles,
      readIds: s.readIds,
    }))
  );
  const setView = useStore((s) => s.setView);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setAddFeedOpen = useStore((s) => s.setAddFeedOpen);
  const addCategory = useStore((s) => s.addCategory);
  const counts = { articles, readIds };
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  );
  const uncategorized = subscriptions.filter((s) => s.categoryId === null);
  const totalUnread = unreadCount(counts, subscriptions.map((s) => s.id));

  const isActive = (v: View) =>
    (v.type === view.type && (!("id" in v) || ("id" in view && v.id === view.id))) as boolean;

  function submitCategory() {
    const name = newCategoryName.trim();
    if (name) addCategory(name);
    setNewCategoryName("");
    setAddingCategory(false);
  }

  const content = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-accent">
            <Rss className="size-4 text-white" strokeWidth={2.5} />
          </span>
          <span className="text-base font-semibold tracking-tight text-text-primary">
            Frontpage
          </span>
        </Link>
        <button
          className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        >
          <X className="size-4.5" />
        </button>
      </div>

      <nav className="app-scroll flex-1 overflow-y-auto px-3 pb-4" aria-label="Feeds and views">
        {/* Top-level views */}
        <div className="space-y-0.5">
          <NavRow
            active={isActive({ type: "all" })}
            onClick={() => setView({ type: "all" })}
            icon={<Inbox className="size-4" />}
            label="All items"
            count={totalUnread}
          />
          <NavRow
            active={isActive({ type: "digest" })}
            onClick={() => setView({ type: "digest" })}
            icon={<Sparkles className="size-4" />}
            label="Digest"
          />
          <NavRow
            active={isActive({ type: "saved" })}
            onClick={() => setView({ type: "saved" })}
            icon={<Bookmark className="size-4" />}
            label="Saved"
            count={bookmarkCount}
          />
          <NavRow
            active={isActive({ type: "feeds-manage" })}
            onClick={() => setView({ type: "feeds-manage" })}
            icon={<Settings2 className="size-4" />}
            label="Manage feeds"
          />
        </div>

        {/* Categories */}
        <div className="mt-6 mb-1.5 flex items-center justify-between px-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Categories
          </span>
          <button
            onClick={() => setAddingCategory(true)}
            className="rounded p-1 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
            aria-label="New category"
            title="New category"
          >
            <FolderPlus className="size-3.5" />
          </button>
        </div>

        {addingCategory && (
          <form
            className="mb-2 px-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              submitCategory();
            }}
          >
            <input
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onBlur={submitCategory}
              onKeyDown={(e) => e.key === "Escape" && setAddingCategory(false)}
              placeholder="Category name…"
              className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
          </form>
        )}

        {sortedCategories.map((cat) => {
          const feeds = subscriptions.filter((s) => s.categoryId === cat.id);
          const catUnread = unreadCount(counts, feeds.map((f) => f.id));
          const isCollapsed = collapsed[cat.id];
          return (
            <div key={cat.id} className="mt-0.5">
              <div className="flex items-center">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))}
                  className="rounded p-1 text-text-tertiary hover:text-text-primary"
                  aria-label={isCollapsed ? `Expand ${cat.name}` : `Collapse ${cat.name}`}
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <NavRow
                    active={isActive({ type: "category", id: cat.id })}
                    onClick={() => setView({ type: "category", id: cat.id })}
                    icon={null}
                    label={cat.name}
                    count={catUnread}
                  />
                </div>
              </div>
              {!isCollapsed &&
                feeds.map((feed) => (
                  <NavRow
                    key={feed.id}
                    indent
                    active={isActive({ type: "feed", id: feed.id })}
                    onClick={() => setView({ type: "feed", id: feed.id })}
                    icon={
                      <span className="relative inline-flex">
                        <Favicon src={feed.iconUrl} size={16} />
                        {feed.lastError && (
                          <span
                            className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-error"
                            title={feed.lastError}
                          />
                        )}
                      </span>
                    }
                    label={feed.customTitle ?? feed.title}
                    count={unreadCount(counts, [feed.id])}
                  />
                ))}
            </div>
          );
        })}

        {uncategorized.length > 0 && (
          <div className="mt-2">
            <div className="mb-1 px-2.5 text-xs font-medium text-text-tertiary">Uncategorized</div>
            {uncategorized.map((feed) => (
              <NavRow
                key={feed.id}
                indent
                active={isActive({ type: "feed", id: feed.id })}
                onClick={() => setView({ type: "feed", id: feed.id })}
                icon={<Favicon src={feed.iconUrl} size={16} />}
                label={feed.customTitle ?? feed.title}
                count={unreadCount(counts, [feed.id])}
              />
            ))}
          </div>
        )}
      </nav>

      {/* Add feed */}
      <div className="border-t border-border-subtle p-3">
        <button
          onClick={() => setAddFeedOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary shadow-sm transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="size-4" />
          Add feed
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-sidebar shrink-0 border-r border-border-subtle bg-bg-secondary lg:block">
        {content}
      </aside>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-[85vw] max-w-sidebar bg-bg-secondary shadow-lg">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
