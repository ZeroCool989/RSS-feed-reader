"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignJustify,
  Bookmark,
  CheckCheck,
  FolderOpen,
  Inbox,
  LayoutGrid,
  Moon,
  Plus,
  RefreshCw,
  Rows3,
  Rss,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Inbox;
  keywords?: string;
  run: () => void;
}

export default function CommandPalette() {
  const store = useStore();
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    subscriptions,
    categories,
    setView,
    setPrefs,
    refreshAll,
    markAllRead,
    setAddFeedOpen,
  } = store;
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(commandPaletteOpen, panelRef);

  const commands = useMemo<Command[]>(() => {
    const close = () => setCommandPaletteOpen(false);
    const base: Command[] = [
      { id: "all", label: "Go to All items", icon: Inbox, keywords: "home inbox", run: () => { setView({ type: "all" }); close(); } },
      { id: "digest", label: "Go to Digest", icon: Sparkles, keywords: "catch up summary", run: () => { setView({ type: "digest" }); close(); } },
      { id: "saved", label: "Go to Saved", icon: Bookmark, keywords: "bookmarks read later", run: () => { setView({ type: "saved" }); close(); } },
      { id: "manage", label: "Manage feeds", icon: Settings2, keywords: "subscriptions health opml settings", run: () => { setView({ type: "feeds-manage" }); close(); } },
      { id: "add", label: "Add a feed…", icon: Plus, keywords: "subscribe new rss", run: () => { close(); setAddFeedOpen(true); } },
      { id: "refresh", label: "Refresh all feeds", icon: RefreshCw, run: () => { refreshAll(true); close(); } },
      { id: "mark-read", label: "Mark all as read", icon: CheckCheck, run: () => { markAllRead({ type: "all" }); close(); } },
      { id: "layout-compact", label: "Layout: Compact list", icon: AlignJustify, keywords: "dense view", run: () => { setPrefs({ layout: "compact" }); close(); } },
      { id: "layout-list", label: "Layout: Comfortable list", icon: Rows3, keywords: "view", run: () => { setPrefs({ layout: "list" }); close(); } },
      { id: "layout-cards", label: "Layout: Card grid", icon: LayoutGrid, keywords: "magazine view", run: () => { setPrefs({ layout: "cards" }); close(); } },
      {
        id: "theme",
        label: "Toggle dark mode",
        icon: Moon,
        keywords: "light theme",
        run: () => {
          const isDark = document.documentElement.getAttribute("data-theme") === "dark";
          if (isDark) document.documentElement.removeAttribute("data-theme");
          else document.documentElement.setAttribute("data-theme", "dark");
          setPrefs({ theme: isDark ? "light" : "dark" });
          close();
        },
      },
    ];
    for (const cat of [...categories].sort((a, b) => a.order - b.order)) {
      base.push({
        id: `cat-${cat.id}`,
        label: cat.name,
        hint: "Category",
        icon: FolderOpen,
        run: () => { setView({ type: "category", id: cat.id }); close(); },
      });
    }
    for (const sub of subscriptions) {
      base.push({
        id: `feed-${sub.id}`,
        label: sub.customTitle ?? sub.title,
        hint: "Feed",
        icon: Rss,
        run: () => { setView({ type: "feed", id: sub.id }); close(); },
      });
    }
    return base;
  }, [categories, subscriptions, setView, setPrefs, refreshAll, markAllRead, setAddFeedOpen, setCommandPaletteOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords?.toLowerCase().includes(q) ||
        c.hint?.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [commandPaletteOpen]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!commandPaletteOpen) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[index]?.run();
    } else if (e.key === "Escape") {
      setCommandPaletteOpen(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setCommandPaletteOpen(false)}
        aria-hidden
      />
      <div ref={panelRef} className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
        <div className="flex items-center gap-3 border-b border-border-subtle px-4">
          <Search className="size-4 shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command, category, or feed…"
            aria-label="Search commands"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-text-tertiary"
          />
          <kbd className="shrink-0 rounded border border-border bg-bg-secondary px-1.5 py-0.5 font-mono text-xs text-text-tertiary">
            esc
          </kbd>
        </div>
        <ul ref={listRef} className="app-scroll max-h-80 overflow-y-auto p-2" role="listbox">
          {filtered.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-text-tertiary">
              No matching commands
            </li>
          )}
          {filtered.map((cmd, i) => (
            <li key={cmd.id} role="option" aria-selected={i === index}>
              <button
                onClick={cmd.run}
                onMouseEnter={() => setIndex(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                  i === index ? "bg-accent-subtle text-accent" : "text-text-primary"
                )}
              >
                <cmd.icon className="size-4 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
                {cmd.hint && (
                  <span className="shrink-0 text-xs text-text-tertiary">{cmd.hint}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
