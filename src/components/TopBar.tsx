"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignJustify,
  CheckCheck,
  LayoutGrid,
  List,
  Menu,
  Moon,
  RefreshCw,
  Rows3,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "@/lib/store";
import type { LayoutMode } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

const layouts: Array<{ mode: LayoutMode; icon: typeof List; label: string }> = [
  { mode: "compact", icon: AlignJustify, label: "Compact list" },
  { mode: "list", icon: Rows3, label: "Comfortable list" },
  { mode: "cards", icon: LayoutGrid, label: "Card grid" },
];

export default function TopBar({ title, itemCount }: { title: string; itemCount?: number }) {
  const { view, prefs, refreshingAll, lastRefreshAt, hasFeeds } = useStore(
    useShallow((s) => ({
      view: s.view,
      prefs: s.prefs,
      refreshingAll: s.refreshingAll,
      lastRefreshAt: s.lastRefreshAt,
      hasFeeds: s.subscriptions.length > 0,
    }))
  );
  const setView = useStore((s) => s.setView);
  const setPrefs = useStore((s) => s.setPrefs);
  const refreshAll = useStore((s) => s.refreshAll);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const markAllRead = useStore((s) => s.markAllRead);
  const [query, setQuery] = useState(view.type === "search" ? view.query : "");
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local input in sync when the view changes from elsewhere (palette, shortcut)
  useEffect(() => {
    if (view.type !== "search") setQuery("");
  }, [view]);

  // Expose focus target for the "/" shortcut
  useEffect(() => {
    const el = searchRef.current;
    if (el) el.dataset.searchInput = "true";
  }, []);

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim()) setView({ type: "search", query: value.trim() });
      else if (view.type === "search") setView({ type: "all" });
    }, 250);
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next === "dark" ? "dark" : "light");
    if (next === "light") document.documentElement.removeAttribute("data-theme");
    setPrefs({ theme: next });
  }

  const markScope =
    view.type === "category"
      ? ({ type: "category", id: view.id } as const)
      : view.type === "feed"
        ? ({ type: "feed", id: view.id } as const)
        : ({ type: "all" } as const);

  const canMarkRead = ["all", "category", "feed"].includes(view.type);

  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg-primary/85 backdrop-blur">
      <div className="flex items-center gap-2 px-4 py-2.5 sm:px-6">
        <button
          className="rounded-md p-2 text-text-secondary hover:bg-bg-tertiary lg:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-text-primary">
            {title}
            {itemCount !== undefined && (
              <span className="ml-2 text-sm font-normal text-text-tertiary tabular-nums">
                {itemCount}
              </span>
            )}
          </h1>
          {lastRefreshAt && (
            <p className="hidden text-xs text-text-tertiary sm:block">
              Updated {relativeTime(lastRefreshAt)}
            </p>
          )}
        </div>

        {/* Search */}
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-tertiary" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search articles…  ( / )"
            aria-label="Search articles"
            className="w-44 rounded-lg border border-border bg-bg-secondary py-1.5 pr-8 pl-8 text-sm outline-none transition-all placeholder:text-text-tertiary focus:w-64 focus:border-accent focus:bg-surface md:w-56"
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-text-tertiary hover:text-text-primary"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Layout switcher */}
        <div
          className="hidden items-center rounded-lg border border-border bg-bg-secondary p-0.5 md:flex"
          role="radiogroup"
          aria-label="Layout"
        >
          {layouts.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              role="radio"
              aria-checked={prefs.layout === mode}
              title={label}
              onClick={() => setPrefs({ layout: mode })}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                prefs.layout === mode
                  ? "bg-surface text-accent shadow-sm"
                  : "text-text-tertiary hover:text-text-primary"
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>

        {canMarkRead && (
          <button
            onClick={() => markAllRead(markScope)}
            title="Mark all as read"
            aria-label="Mark all as read"
            className="rounded-md p-2 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          >
            <CheckCheck className="size-4.5" />
          </button>
        )}

        <button
          onClick={() => refreshAll(true)}
          disabled={refreshingAll || !hasFeeds}
          title="Refresh all feeds"
          aria-label="Refresh all feeds"
          className="rounded-md p-2 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-50"
        >
          <RefreshCw className={cn("size-4.5", refreshingAll && "animate-spin")} />
        </button>

        <button
          onClick={toggleTheme}
          title="Toggle theme"
          aria-label="Toggle light/dark theme"
          className="rounded-md p-2 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
        >
          <Sun className="hidden size-4.5 [[data-theme=dark]_&]:block" />
          <Moon className="size-4.5 [[data-theme=dark]_&]:hidden" />
        </button>
      </div>
    </header>
  );
}
