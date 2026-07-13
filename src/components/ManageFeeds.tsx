"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { useStore, healthOf } from "@/lib/store";
import { buildOpml } from "@/lib/opml";
import type { FeedHealth, Subscription } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import Favicon from "./Favicon";

const healthMeta: Record<FeedHealth, { label: string; icon: typeof CheckCircle2; className: string }> = {
  active: { label: "Active", icon: CheckCircle2, className: "text-success" },
  stale: { label: "Stale", icon: Clock, className: "text-warning" },
  error: { label: "Error", icon: XCircle, className: "text-error" },
};

function HealthBadge({ health, detail }: { health: FeedHealth; detail?: string | null }) {
  const { label, icon: Icon, className } = healthMeta[health];
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs font-medium", className)}
      title={detail ?? undefined}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

function FeedRow({ sub }: { sub: Subscription }) {
  const { categories, updateSubscription, removeFeed, refreshFeed, refreshing, showToast } =
    useStore();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(sub.customTitle ?? sub.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const health = healthOf(sub);
  const busy = Boolean(refreshing[sub.id]);

  function saveTitle() {
    const trimmed = title.trim();
    updateSubscription(sub.id, {
      customTitle: trimmed && trimmed !== sub.title ? trimmed : null,
    });
    setEditing(false);
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
      <Favicon src={sub.iconUrl} size={28} className="hidden shrink-0 sm:block" />
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveTitle();
            }}
          >
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              aria-label="Feed title"
              className="w-full rounded-md border border-border bg-bg-primary px-2 py-1 text-sm font-medium outline-none focus:border-accent"
            />
          </form>
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{sub.customTitle ?? sub.title}</p>
            <button
              onClick={() => setEditing(true)}
              className="rounded p-1 text-text-tertiary hover:text-text-primary"
              aria-label={`Rename ${sub.customTitle ?? sub.title}`}
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        )}
        <p className="truncate text-xs text-text-tertiary">{sub.feedUrl}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
          <HealthBadge health={health} detail={sub.lastError} />
          {sub.lastSuccessAt && <span>Last fetched {relativeTime(sub.lastSuccessAt)}</span>}
          {sub.lastError && (
            <span className="max-w-72 truncate text-error" title={sub.lastError}>
              {sub.lastError}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <select
          value={sub.categoryId ?? ""}
          onChange={(e) => updateSubscription(sub.id, { categoryId: e.target.value || null })}
          aria-label={`Category for ${sub.customTitle ?? sub.title}`}
          className="rounded-md border border-border bg-bg-primary px-2 py-1.5 text-xs outline-none focus:border-accent"
        >
          <option value="">Uncategorized</option>
          {[...categories]
            .sort((a, b) => a.order - b.order)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <button
          onClick={() => refreshFeed(sub.id, true)}
          disabled={busy}
          title="Refresh this feed"
          aria-label={`Refresh ${sub.customTitle ?? sub.title}`}
          className="rounded-md p-2 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-50"
        >
          <RefreshCw className={cn("size-4", busy && "animate-spin")} />
        </button>
        {confirmingDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                removeFeed(sub.id);
                showToast(`Unsubscribed from ${sub.customTitle ?? sub.title}`);
              }}
              className="rounded-md bg-error px-2.5 py-1.5 text-xs font-semibold text-white"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            title="Remove feed"
            aria-label={`Remove ${sub.customTitle ?? sub.title}`}
            className="rounded-md p-2 text-text-tertiary hover:bg-error/10 hover:text-error"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </li>
  );
}

export default function ManageFeeds() {
  const { subscriptions, categories, setAddFeedOpen, renameCategory, deleteCategory, moveCategory, prefs, setPrefs } =
    useStore();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const stats = useMemo(() => {
    const counts = { active: 0, stale: 0, error: 0 };
    for (const sub of subscriptions) counts[healthOf(sub)]++;
    return counts;
  }, [subscriptions]);

  function exportOpml() {
    const xml = buildOpml(subscriptions, categories);
    const blob = new Blob([xml], { type: "text/x-opml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "frontpage-subscriptions.opml";
    a.click();
    URL.revokeObjectURL(url);
  }

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div className="mx-auto max-w-feed px-4 py-8 sm:px-6">
      {/* Health dashboard */}
      <section aria-label="Feed health">
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["active", "Healthy", CheckCircle2, "text-success"],
              ["stale", "Stale (30d+ quiet)", Clock, "text-warning"],
              ["error", "Erroring", AlertTriangle, "text-error"],
            ] as const
          ).map(([key, label, Icon, color]) => (
            <div key={key} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <Icon className={cn("size-4", color)} />
                <span className="text-xs font-medium text-text-secondary">{label}</span>
              </div>
              <p className="mt-2 text-xl font-bold tabular-nums">{stats[key]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Toolbar */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          Subscriptions <span className="font-normal text-text-tertiary">({subscriptions.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          <label className="mr-2 flex items-center gap-2 text-xs text-text-secondary">
            Auto-refresh
            <select
              value={prefs.refreshIntervalMin}
              onChange={(e) =>
                setPrefs({ refreshIntervalMin: Number(e.target.value) as 0 | 15 | 30 | 60 })
              }
              className="rounded-md border border-border bg-bg-primary px-2 py-1.5 text-xs outline-none focus:border-accent"
            >
              <option value={0}>Manual only</option>
              <option value={15}>Every 15 min</option>
              <option value={30}>Every 30 min</option>
              <option value={60}>Every hour</option>
            </select>
          </label>
          <button
            onClick={exportOpml}
            disabled={subscriptions.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-bg-tertiary disabled:opacity-50"
          >
            <Download className="size-3.5" />
            Export OPML
          </button>
          <button
            onClick={() => setAddFeedOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-hover"
          >
            <Plus className="size-3.5" />
            Add feed
          </button>
        </div>
      </div>

      {/* Feed list */}
      {subscriptions.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-text-secondary">
          No subscriptions yet. Add a feed or import an OPML file to get started.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {subscriptions.map((sub) => (
            <FeedRow key={sub.id} sub={sub} />
          ))}
        </ul>
      )}

      {/* Categories */}
      <section className="mt-10" aria-label="Categories">
        <h2 className="text-base font-semibold">Categories</h2>
        <p className="mt-1 text-xs text-text-tertiary">
          Reorder with the arrows — deleting a category moves its feeds to Uncategorized.
        </p>
        <ul className="mt-4 space-y-2">
          {sortedCategories.map((cat, i) => {
            const feedCount = subscriptions.filter((s) => s.categoryId === cat.id).length;
            return (
              <li
                key={cat.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
              >
                <div className="flex flex-col">
                  <button
                    onClick={() => moveCategory(cat.id, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${cat.name} up`}
                    className="rounded p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    onClick={() => moveCategory(cat.id, 1)}
                    disabled={i === sortedCategories.length - 1}
                    aria-label={`Move ${cat.name} down`}
                    className="rounded p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>
                {renamingId === cat.id ? (
                  <form
                    className="flex-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (renameValue.trim()) renameCategory(cat.id, renameValue.trim());
                      setRenamingId(null);
                    }}
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => setRenamingId(null)}
                      aria-label={`Rename ${cat.name}`}
                      className="w-full rounded-md border border-border bg-bg-primary px-2 py-1 text-sm outline-none focus:border-accent"
                    />
                  </form>
                ) : (
                  <span className="flex-1 text-sm font-medium">
                    {cat.name}{" "}
                    <span className="text-xs font-normal text-text-tertiary">
                      · {feedCount} feed{feedCount === 1 ? "" : "s"}
                    </span>
                  </span>
                )}
                <button
                  onClick={() => {
                    setRenamingId(cat.id);
                    setRenameValue(cat.name);
                  }}
                  aria-label={`Rename ${cat.name}`}
                  className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => deleteCategory(cat.id)}
                  aria-label={`Delete ${cat.name}`}
                  className="rounded-md p-1.5 text-text-tertiary hover:bg-error/10 hover:text-error"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
