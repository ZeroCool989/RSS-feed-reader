"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Circle, CircleCheck, ExternalLink } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Article, LayoutMode, Subscription } from "@/lib/types";
import { cn, escapeRegExp, fullDate, relativeTime } from "@/lib/utils";
import Favicon from "./Favicon";

const PAGE_SIZE = 60;

/**
 * Rows are custom role="button" elements — native buttons activate on both
 * Enter and Space, so ours must too. Space also needs preventDefault so the
 * page doesn't scroll.
 */
function rowKeyDown(onOpen: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };
}

/* ------------------------------ text highlight ----------------------------- */

function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-accent-subtle px-0.5 text-accent">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

/* -------------------------------- row actions ------------------------------- */

function RowActions({ article, visibleOnHover = true }: { article: Article; visibleOnHover?: boolean }) {
  const { readIds, toggleRead, toggleBookmark, bookmarks } = useStore();
  const isRead = Boolean(readIds[article.id]);
  const saved = bookmarks.some((b) => b.id === article.id);
  return (
    <span
      className={cn(
        "flex items-center gap-0.5",
        visibleOnHover &&
          "sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => toggleRead(article.id)}
        title={isRead ? "Mark as unread" : "Mark as read"}
        aria-label={isRead ? "Mark as unread" : "Mark as read"}
        className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
      >
        {isRead ? <Circle className="size-4" /> : <CircleCheck className="size-4" />}
      </button>
      <button
        onClick={() => toggleBookmark(article)}
        title={saved ? "Remove from saved" : "Save for later"}
        aria-label={saved ? "Remove from saved" : "Save for later"}
        className={cn(
          "rounded-md p-1.5 hover:bg-bg-tertiary",
          saved ? "text-accent" : "text-text-tertiary hover:text-text-primary"
        )}
      >
        <Bookmark className={cn("size-4", saved && "fill-current")} />
      </button>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open original"
        aria-label="Open original article"
        className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
      >
        <ExternalLink className="size-4" />
      </a>
    </span>
  );
}

/* --------------------------------- layouts --------------------------------- */

interface RowProps {
  article: Article;
  sub: Subscription | undefined;
  isRead: boolean;
  selected: boolean;
  query?: string;
  onOpen: () => void;
}

function CompactRow({ article, sub, isRead, selected, query, onOpen }: RowProps) {
  return (
    <div
      onClick={onOpen}
      onKeyDown={rowKeyDown(onOpen)}
      role="button"
      tabIndex={0}
      data-selected={selected || undefined}
      className={cn(
        "group flex cursor-pointer items-center gap-3 border-l-2 px-3 py-2 transition-colors sm:px-4",
        selected ? "border-accent bg-accent-subtle/60" : "border-transparent hover:bg-bg-tertiary/60"
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", isRead ? "bg-transparent" : "bg-unread")}
        aria-hidden
      />
      <Favicon src={sub?.iconUrl ?? null} size={16} className="shrink-0" />
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          isRead ? "font-normal text-text-secondary" : "font-medium text-text-primary"
        )}
      >
        <Highlight text={article.title} query={query} />
      </p>
      <span className="hidden shrink-0 text-xs text-text-tertiary sm:block">
        {sub ? (sub.customTitle ?? sub.title) : ""}
      </span>
      <RowActions article={article} />
      <time
        className="w-14 shrink-0 text-right text-xs text-text-tertiary tabular-nums"
        title={fullDate(article.publishedAt)}
      >
        {relativeTime(article.publishedAt)}
      </time>
    </div>
  );
}

function ListRow({ article, sub, isRead, selected, query, onOpen }: RowProps) {
  return (
    <article
      onClick={onOpen}
      onKeyDown={rowKeyDown(onOpen)}
      role="button"
      tabIndex={0}
      data-selected={selected || undefined}
      className={cn(
        "group flex cursor-pointer gap-4 border-l-2 px-4 py-3.5 transition-colors sm:px-6",
        selected ? "border-accent bg-accent-subtle/60" : "border-transparent hover:bg-bg-tertiary/60"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-xs text-text-tertiary">
          <Favicon src={sub?.iconUrl ?? null} size={16} />
          <span className="truncate font-medium text-text-secondary">
            {sub ? (sub.customTitle ?? sub.title) : "Unknown source"}
          </span>
          <span aria-hidden>·</span>
          <time title={fullDate(article.publishedAt)}>{relativeTime(article.publishedAt)}</time>
          {!isRead && <span className="size-1.5 rounded-full bg-unread" aria-label="Unread" />}
        </div>
        <h3
          className={cn(
            "text-base leading-snug",
            isRead ? "font-normal text-text-secondary" : "font-semibold text-text-primary"
          )}
        >
          <Highlight text={article.title} query={query} />
        </h3>
        {article.excerpt && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-text-tertiary">
            <Highlight text={article.excerpt} query={query} />
          </p>
        )}
        <div className="mt-1.5 -ml-1.5">
          <RowActions article={article} />
        </div>
      </div>
      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          loading="lazy"
          className={cn(
            "hidden size-20 shrink-0 rounded-lg border border-border-subtle object-cover sm:block",
            isRead && "opacity-70"
          )}
        />
      )}
    </article>
  );
}

function Card({ article, sub, isRead, selected, query, onOpen }: RowProps) {
  return (
    <article
      onClick={onOpen}
      onKeyDown={rowKeyDown(onOpen)}
      role="button"
      tabIndex={0}
      data-selected={selected || undefined}
      className={cn(
        "group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        selected ? "border-accent ring-1 ring-accent" : "border-border"
      )}
    >
      {article.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          loading="lazy"
          className={cn("h-36 w-full object-cover", isRead && "opacity-70")}
        />
      ) : (
        <div
          aria-hidden
          className="flex h-20 w-full items-center justify-center bg-bg-secondary text-2xl font-bold text-text-tertiary/40"
        >
          {(sub?.customTitle ?? sub?.title ?? "?").slice(0, 1)}
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1.5 flex items-center gap-2 text-xs text-text-tertiary">
          <Favicon src={sub?.iconUrl ?? null} size={14} />
          <span className="truncate">{sub ? (sub.customTitle ?? sub.title) : ""}</span>
          {!isRead && (
            <span className="ml-auto size-1.5 shrink-0 rounded-full bg-unread" aria-label="Unread" />
          )}
        </div>
        <h3
          className={cn(
            "line-clamp-3 text-sm leading-snug",
            isRead ? "font-normal text-text-secondary" : "font-semibold text-text-primary"
          )}
        >
          <Highlight text={article.title} query={query} />
        </h3>
        <div className="mt-auto flex items-center justify-between pt-3">
          <time
            className="text-xs text-text-tertiary"
            title={fullDate(article.publishedAt)}
          >
            {relativeTime(article.publishedAt)}
          </time>
          <RowActions article={article} visibleOnHover={false} />
        </div>
      </div>
    </article>
  );
}

/* ---------------------------------- list ----------------------------------- */

export default function ItemList({
  articles,
  layout,
  selectedIndex,
  query,
  emptyMessage,
}: {
  articles: Article[];
  layout: LayoutMode;
  selectedIndex: number;
  query?: string;
  emptyMessage: React.ReactNode;
}) {
  const { subscriptions, readIds, markRead, openArticle } = useStore();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const subsById = useMemo(
    () => new Map(subscriptions.map((s) => [s.id, s])),
    [subscriptions]
  );

  // Reset pagination when the underlying list changes drastically
  const listKey = `${articles.length > 0 ? articles[0].id : "empty"}:${articles.length}:${query ?? ""}`;
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [listKey]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, articles.length));
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [articles.length]);

  // Keep keyboard selection in view
  useEffect(() => {
    if (selectedIndex < 0) return;
    const el = document.querySelector("[data-selected]");
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (articles.length === 0) {
    return <div className="px-6 py-16 text-center">{emptyMessage}</div>;
  }

  const visible = articles.slice(0, visibleCount);

  function open(article: Article) {
    markRead(article.id);
    openArticle(article.id);
  }

  const Row = layout === "compact" ? CompactRow : layout === "cards" ? Card : ListRow;

  return (
    <div
      className={cn(
        layout === "cards"
          ? "grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3"
          : "mx-auto max-w-feed divide-y divide-border-subtle"
      )}
    >
      {visible.map((article, i) => (
        <Row
          key={article.id}
          article={article}
          sub={subsById.get(article.subscriptionId)}
          isRead={Boolean(readIds[article.id])}
          selected={i === selectedIndex}
          query={query}
          onOpen={() => open(article)}
        />
      ))}
      {visibleCount < articles.length && (
        <div ref={sentinelRef} className="col-span-full px-6 py-6 text-center">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary"
          >
            Load more ({articles.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
