"use client";

import { X } from "lucide-react";
import { useStore } from "@/lib/store";

const groups: Array<{ title: string; rows: Array<[string, string]> }> = [
  {
    title: "Navigate",
    rows: [
      ["j / k", "Next / previous article"],
      ["Enter or o", "Open selected article"],
      ["Esc", "Close reader / dialogs"],
      ["g then h", "Go home (all items)"],
      ["g then d", "Go to digest"],
      ["g then s", "Go to saved"],
      ["g then f", "Go to manage feeds"],
    ],
  },
  {
    title: "Act",
    rows: [
      ["m", "Toggle read / unread"],
      ["s", "Save / unsave article"],
      ["r", "Refresh all feeds"],
      ["v", "Cycle layout"],
    ],
  },
  {
    title: "Find",
    rows: [
      ["/", "Focus search"],
      ["⌘K / Ctrl+K", "Command palette"],
      ["?", "This overlay"],
    ],
  },
];

export default function ShortcutsHelp() {
  const { shortcutsOpen, setShortcutsOpen } = useStore();
  if (!shortcutsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="absolute inset-0 bg-black/40" onClick={() => setShortcutsOpen(false)} aria-hidden />
      <div className="relative w-full max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-lg">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <button
            onClick={() => setShortcutsOpen(false)}
            className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
            aria-label="Close shortcuts"
          >
            <X className="size-4.5" />
          </button>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                {group.title}
              </h3>
              <dl className="space-y-2">
                {group.rows.map(([key, action]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <dd className="text-sm text-text-secondary">{action}</dd>
                    <dt>
                      <kbd className="rounded border border-border bg-bg-secondary px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                        {key}
                      </kbd>
                    </dt>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
