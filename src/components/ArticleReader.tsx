"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { Article } from "@/lib/types";
import { cn, fullDate, hostnameOf } from "@/lib/utils";
import Favicon from "./Favicon";

/**
 * In-app reader view. Renders feed-provided HTML that was sanitized
 * server-side; falls back to the excerpt + source link for summary-only feeds.
 */
export default function ArticleReader({
  articles,
}: {
  articles: Article[];
}) {
  const {
    openArticleId,
    openArticle,
    subscriptions,
    markRead,
    toggleBookmark,
    bookmarks,
    prefs,
  } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const index = useMemo(
    () => articles.findIndex((a) => a.id === openArticleId),
    [articles, openArticleId]
  );
  const article = index >= 0 ? articles[index] : null;
  const sub = article
    ? subscriptions.find((s) => s.id === article.subscriptionId)
    : null;

  const goTo = useCallback(
    (i: number) => {
      const next = articles[i];
      if (next) {
        markRead(next.id);
        openArticle(next.id);
        scrollRef.current?.scrollTo({ top: 0 });
      }
    },
    [articles, markRead, openArticle]
  );

  // Keyboard: esc close, arrows/jk to navigate while reader is open
  useEffect(() => {
    if (!article) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") openArticle(null);
      else if (e.key === "ArrowRight" || e.key === "j") goTo(index + 1);
      else if (e.key === "ArrowLeft" || e.key === "k") goTo(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [article, index, goTo, openArticle]);

  if (!article) return null;
  const saved = bookmarks.some((b) => b.id === article.id);
  const fontSize =
    prefs.readerFontSize === "sm" ? "0.9375rem" : prefs.readerFontSize === "lg" ? "1.1875rem" : undefined;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-bg-primary" role="dialog" aria-modal="true" aria-label={article.title}>
      {/* Reader toolbar */}
      <header className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5 sm:px-6">
        <button
          onClick={() => openArticle(null)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <span className="truncate text-sm text-text-tertiary">
            {index + 1} of {articles.length}
          </span>
        </div>
        <button
          onClick={() => toggleBookmark(article)}
          title={saved ? "Remove from saved" : "Save for later"}
          className={cn(
            "rounded-md p-2 hover:bg-bg-tertiary",
            saved ? "text-accent" : "text-text-secondary hover:text-text-primary"
          )}
        >
          <Bookmark className={cn("size-4.5", saved && "fill-current")} />
        </button>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
        >
          <ExternalLink className="size-4" />
          <span className="hidden sm:inline">Original</span>
        </a>
      </header>

      {/* Article body */}
      <div ref={scrollRef} className="app-scroll flex-1 overflow-y-auto">
        <article className="mx-auto max-w-content px-5 py-10 sm:px-8">
          <header className="mb-8 border-b border-border-subtle pb-8">
            <div className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
              <Favicon src={sub?.iconUrl ?? null} size={18} />
              <span className="font-medium">{sub ? (sub.customTitle ?? sub.title) : hostnameOf(article.url)}</span>
            </div>
            <h1 className="text-xl font-bold leading-snug text-balance sm:text-2xl">
              {article.title}
            </h1>
            <p className="mt-3 text-sm text-text-tertiary">
              {article.author && <span>{article.author} · </span>}
              <time>{fullDate(article.publishedAt)}</time>
            </p>
          </header>

          {article.contentHtml ? (
            <div
              className="prose-reader"
              style={fontSize ? { fontSize } : undefined}
              // Sanitized server-side in sanitizeFeedHtml before storage.
              dangerouslySetInnerHTML={{ __html: article.contentHtml }}
            />
          ) : (
            <div>
              {article.excerpt && (
                <p className="prose-reader" style={fontSize ? { fontSize } : undefined}>
                  {article.excerpt}
                </p>
              )}
              <div className="mt-8 rounded-xl border border-border bg-bg-secondary p-6 text-center">
                <p className="text-sm text-text-secondary">
                  This feed only provides a summary.
                </p>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
                >
                  Read the full article on {hostnameOf(article.url)}
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </div>
          )}
        </article>
      </div>

      {/* Prev / next */}
      <footer className="flex items-center justify-between border-t border-border-subtle px-4 py-2.5 sm:px-6">
        <button
          onClick={() => goTo(index - 1)}
          disabled={index <= 0}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
          Previous
        </button>
        <span className="hidden text-xs text-text-tertiary sm:block">
          ← → or j / k to navigate · Esc to close
        </span>
        <button
          onClick={() => goTo(index + 1)}
          disabled={index >= articles.length - 1}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-40"
        >
          Next
          <ChevronRight className="size-4" />
        </button>
      </footer>
    </div>
  );
}
