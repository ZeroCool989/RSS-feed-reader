"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import type { Article, LayoutMode } from "@/lib/types";

const layoutCycle: LayoutMode[] = ["compact", "list", "cards"];

/**
 * Global keyboard shortcuts (list context). The article reader handles its
 * own keys while open; dialogs swallow keys via their own handlers.
 */
export function useKeyboard({
  articles,
  selectedIndex,
  setSelectedIndex,
}: {
  articles: Article[];
  selectedIndex: number;
  setSelectedIndex: (fn: (i: number) => number) => void;
}) {
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs so the handler always sees fresh values without re-binding
  const articlesRef = useRef(articles);
  articlesRef.current = articles;
  const selectedRef = useRef(selectedIndex);
  selectedRef.current = selectedIndex;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const store = useStore.getState();

      // Command palette works everywhere
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        store.setCommandPaletteOpen(!store.commandPaletteOpen);
        return;
      }

      // Don't hijack typing in inputs, or while overlays own the keyboard
      const target = e.target as HTMLElement;
      const inField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;
      if (inField || e.metaKey || e.ctrlKey || e.altKey) return;
      if (store.commandPaletteOpen || store.addFeedOpen || store.openArticleId) {
        return;
      }
      if (store.shortcutsOpen && e.key !== "?" && e.key !== "Escape") return;

      const list = articlesRef.current;
      const sel = selectedRef.current;
      const selected = sel >= 0 ? list[sel] : undefined;

      // g-prefixed compound shortcuts
      if (pendingG.current) {
        pendingG.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);
        const views: Record<string, () => void> = {
          h: () => store.setView({ type: "all" }),
          d: () => store.setView({ type: "digest" }),
          s: () => store.setView({ type: "saved" }),
          f: () => store.setView({ type: "feeds-manage" }),
        };
        views[e.key.toLowerCase()]?.();
        return;
      }

      switch (e.key) {
        case "g":
          pendingG.current = true;
          gTimer.current = setTimeout(() => (pendingG.current = false), 1000);
          break;
        case "j":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, list.length - 1));
          break;
        case "k":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "o":
        case "Enter":
          if (selected) {
            e.preventDefault();
            store.markRead(selected.id);
            store.openArticle(selected.id);
          }
          break;
        case "m":
          if (selected) store.toggleRead(selected.id);
          break;
        case "s":
          if (selected) store.toggleBookmark(selected);
          break;
        case "r":
          store.refreshAll(true);
          break;
        case "v": {
          const next =
            layoutCycle[(layoutCycle.indexOf(store.prefs.layout) + 1) % layoutCycle.length];
          store.setPrefs({ layout: next });
          break;
        }
        case "/": {
          e.preventDefault();
          const input = document.querySelector<HTMLInputElement>("[data-search-input]");
          input?.focus();
          break;
        }
        case "?":
          store.setShortcutsOpen(!store.shortcutsOpen);
          break;
        case "Escape":
          if (store.shortcutsOpen) store.setShortcutsOpen(false);
          else setSelectedIndex(() => -1);
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSelectedIndex]);
}
