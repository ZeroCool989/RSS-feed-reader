"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileUp, Globe, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { parseOpml, type OpmlEntry } from "@/lib/opml";
import { cn, hostnameOf, normalizeFeedUrl } from "@/lib/utils";
import sampleFeeds from "@/data/sample-feeds.json";

type Tab = "url" | "discover" | "opml";

interface ImportReport {
  added: number;
  duplicates: number;
  failed: Array<{ title: string; error: string }>;
}

export default function AddFeedDialog() {
  const {
    addFeedOpen,
    addFeedTab,
    setAddFeedOpen,
    categories,
    subscriptions,
    addFeed,
    addCategory,
    showToast,
  } = useStore();
  const [tab, setTab] = useState<Tab>(subscriptions.length === 0 ? "discover" : "url");

  // Respect the tab requested by the opener (e.g. onboarding's "Import OPML").
  // Subscriptions are read fresh from the store so the dependency array is
  // complete without re-running mid-session as feeds are added.
  useEffect(() => {
    if (!addFeedOpen) return;
    const hasSubscriptions = useStore.getState().subscriptions.length > 0;
    setTab(addFeedTab ?? (hasSubscriptions ? "url" : "discover"));
  }, [addFeedOpen, addFeedTab]);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(addFeedOpen, dialogRef);

  // --- by URL state
  const [url, setUrl] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- discover state
  const [addingUrl, setAddingUrl] = useState<string | null>(null);

  // --- OPML state
  const [opmlEntries, setOpmlEntries] = useState<OpmlEntry[] | null>(null);
  const [opmlErrors, setOpmlErrors] = useState<string[]>([]);
  const [opmlFileDupes, setOpmlFileDupes] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [report, setReport] = useState<ImportReport | null>(null);

  const subscribedUrls = useMemo(
    () => new Set(subscriptions.map((s) => normalizeFeedUrl(s.feedUrl))),
    [subscriptions]
  );

  useEffect(() => {
    if (!addFeedOpen) {
      setUrl("");
      setError(null);
      setOpmlEntries(null);
      setOpmlErrors([]);
      setReport(null);
    }
  }, [addFeedOpen]);

  // Focus trap entry + esc to close
  useEffect(() => {
    if (!addFeedOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAddFeedOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addFeedOpen, setAddFeedOpen]);

  if (!addFeedOpen) return null;

  async function submitUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await addFeed(url, categoryId || null);
    setBusy(false);
    if (result.ok && result.subscription) {
      showToast(`Subscribed to ${result.subscription.title}`);
      setAddFeedOpen(false);
    } else {
      setError(result.error ?? "Could not add this feed");
    }
  }

  /** Resolve a category by name, creating it if needed. */
  function categoryIdByName(name: string | null): string | null {
    if (!name) return null;
    const state = useStore.getState();
    const existing = state.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    return state.addCategory(name).id;
  }

  async function addSuggested(feed: { title: string; feedUrl: string }, categoryName: string) {
    setAddingUrl(feed.feedUrl);
    const result = await addFeed(feed.feedUrl, categoryIdByName(categoryName));
    setAddingUrl(null);
    if (result.ok) showToast(`Subscribed to ${feed.title}`);
    else if (!result.duplicate) showToast(result.error ?? "Could not add feed");
  }

  async function onOpmlFile(file: File) {
    const text = await file.text();
    const { entries, errors, duplicatesInFile } = parseOpml(text);
    setOpmlEntries(entries);
    setOpmlErrors(errors);
    setOpmlFileDupes(duplicatesInFile);
    setReport(null);
  }

  async function runImport() {
    if (!opmlEntries || importing) return;
    setImporting(true);
    const result: ImportReport = { added: 0, duplicates: 0, failed: [] };
    let done = 0;
    const queue = [...opmlEntries];
    const total = queue.length;
    // Snapshot existing URLs at import start — concurrent workers must not
    // consult a render-time memo that could be stale mid-import.
    const existingUrls = new Set(
      useStore.getState().subscriptions.map((s) => normalizeFeedUrl(s.feedUrl))
    );
    // Categories are resolved up front so concurrent workers don't race to
    // create the same one.
    const categoryIds = new Map(
      queue.map((e) => [e.xmlUrl, categoryIdByName(e.category)] as const)
    );
    async function worker() {
      for (;;) {
        const entry = queue.shift();
        if (!entry) return;
        if (existingUrls.has(normalizeFeedUrl(entry.xmlUrl))) {
          result.duplicates++;
        } else {
          const outcome = await addFeed(
            entry.xmlUrl,
            categoryIds.get(entry.xmlUrl) ?? null,
            entry.title || null
          );
          if (outcome.ok) result.added++;
          else if (outcome.duplicate) result.duplicates++;
          else
            result.failed.push({
              title: entry.title || hostnameOf(entry.xmlUrl),
              error: outcome.error ?? "failed",
            });
        }
        done++;
        setImportProgress(Math.round((done / total) * 100));
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker));
    setImporting(false);
    setReport(result);
    setOpmlEntries(null);
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Globe }> = [
    { id: "url", label: "By URL", icon: Globe },
    { id: "discover", label: "Discover", icon: Sparkles },
    { id: "opml", label: "Import OPML", icon: FileUp },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh] sm:pt-[12vh]" role="dialog" aria-modal="true" aria-label="Add feeds">
      <div className="absolute inset-0 bg-black/40" onClick={() => setAddFeedOpen(false)} aria-hidden />
      <div ref={dialogRef} className="relative w-full max-w-xl rounded-xl border border-border bg-surface shadow-lg">
        {/* Header + tabs */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 pt-4 pb-0">
          <div className="flex gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-2 rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  tab === id
                    ? "border-accent text-accent"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAddFeedOpen(false)}
            className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
            aria-label="Close dialog"
          >
            <X className="size-4.5" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-5">
          {/* ------------------------------- by URL ------------------------------ */}
          {tab === "url" && (
            <form onSubmit={submitUrl}>
              <label htmlFor="feed-url" className="mb-1.5 block text-sm font-medium">
                Feed URL
              </label>
              <input
                id="feed-url"
                autoFocus
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/feed.xml"
                className="w-full rounded-lg border border-border bg-bg-primary px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
              <p className="mt-1.5 text-xs text-text-tertiary">
                RSS 2.0, RSS 1.0 and Atom feeds are supported. We&apos;ll validate the feed before
                subscribing.
              </p>

              <label htmlFor="feed-category" className="mt-4 mb-1.5 block text-sm font-medium">
                Category
              </label>
              <select
                id="feed-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-primary px-3.5 py-2.5 text-sm outline-none focus:border-accent"
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

              {error && (
                <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {busy ? "Validating feed…" : "Add feed"}
              </button>
            </form>
          )}

          {/* ------------------------------ discover ----------------------------- */}
          {tab === "discover" && (
            <div>
              <p className="mb-4 text-sm text-text-secondary">
                Curated starter feeds, hand-picked for people who build for the web. Add them
                individually — categories are created for you.
              </p>
              <div className="space-y-5">
                {sampleFeeds.categories.map((cat) => (
                  <section key={cat.name}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      {cat.name}
                    </h3>
                    <ul className="space-y-1.5">
                      {cat.feeds.map((feed) => {
                        const subscribed = subscribedUrls.has(normalizeFeedUrl(feed.feedUrl));
                        return (
                          <li
                            key={feed.feedUrl}
                            className="flex items-center gap-3 rounded-lg border border-border-subtle px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{feed.title}</p>
                              <p className="truncate text-xs text-text-tertiary">
                                {feed.description}
                              </p>
                            </div>
                            <button
                              disabled={subscribed || addingUrl === feed.feedUrl}
                              onClick={() => addSuggested(feed, cat.name)}
                              className={cn(
                                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                                subscribed
                                  ? "text-success"
                                  : "border border-border text-text-secondary hover:border-accent hover:text-accent"
                              )}
                            >
                              {subscribed ? (
                                <>
                                  <Check className="size-3.5" /> Added
                                </>
                              ) : addingUrl === feed.feedUrl ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="size-3.5" /> Follow
                                </>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          )}

          {/* -------------------------------- OPML -------------------------------- */}
          {tab === "opml" && (
            <div>
              {!opmlEntries && !report && (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-12 text-center transition-colors hover:border-accent">
                  <FileUp className="size-8 text-text-tertiary" />
                  <span className="text-sm font-medium">
                    Choose an OPML file
                  </span>
                  <span className="text-xs text-text-tertiary">
                    Exported from Feedly, Inoreader, NetNewsWire, or any other reader
                  </span>
                  <input
                    type="file"
                    accept=".opml,.xml,text/xml,text/x-opml"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onOpmlFile(f);
                    }}
                  />
                </label>
              )}

              {opmlErrors.map((err) => (
                <p key={err} role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
                  {err}
                </p>
              ))}

              {opmlEntries && opmlEntries.length > 0 && (
                <div>
                  <p className="mb-3 text-sm text-text-secondary">
                    Found <strong>{opmlEntries.length}</strong> feeds
                    {opmlFileDupes > 0 && (
                      <> ({opmlFileDupes} duplicate {opmlFileDupes === 1 ? "entry" : "entries"} in
                      the file merged)</>
                    )}
                    . Feeds you already follow are marked as duplicates and will be skipped.
                  </p>
                  <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border-subtle p-2">
                    {opmlEntries.map((entry) => {
                      const dup = subscribedUrls.has(normalizeFeedUrl(entry.xmlUrl));
                      return (
                        <li key={entry.xmlUrl} className="flex items-center gap-2 px-2 py-1 text-sm">
                          <span className="min-w-0 flex-1 truncate">
                            {entry.title || hostnameOf(entry.xmlUrl)}
                          </span>
                          {entry.category && (
                            <span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-xs text-text-tertiary">
                              {entry.category}
                            </span>
                          )}
                          {dup && (
                            <span className="rounded bg-warning/15 px-1.5 py-0.5 text-xs font-medium text-warning">
                              duplicate
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    onClick={runImport}
                    disabled={importing}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Importing… {importProgress}%
                      </>
                    ) : (
                      <>Import {opmlEntries.length} feeds</>
                    )}
                  </button>
                  <p className="mt-2 text-center text-xs text-text-tertiary">
                    Each feed is fetched and validated — this can take a moment.
                  </p>
                </div>
              )}

              {report && (
                <div className="rounded-xl border border-border bg-bg-secondary p-5">
                  <h3 className="text-sm font-semibold">Import complete</h3>
                  <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
                    <li>
                      <span className="font-medium text-success">{report.added}</span> feeds added
                    </li>
                    <li>
                      <span className="font-medium text-warning">{report.duplicates}</span>{" "}
                      duplicates skipped
                    </li>
                    <li>
                      <span className="font-medium text-error">{report.failed.length}</span> failed
                    </li>
                  </ul>
                  {report.failed.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-border-subtle pt-3 text-xs text-text-tertiary">
                      {report.failed.map((f) => (
                        <li key={f.title}>
                          <span className="font-medium text-text-secondary">{f.title}</span> —{" "}
                          {f.error}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    onClick={() => setAddFeedOpen(false)}
                    className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
