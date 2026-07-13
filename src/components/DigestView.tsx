"use client";

import { useMemo } from "react";
import { ArrowRight, CheckCheck, Coffee, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Article } from "@/lib/types";
import { fullDate, pluralize, relativeTime } from "@/lib/utils";
import Favicon from "./Favicon";

const PER_CATEGORY = 5;

/**
 * The digest is a "what did I miss?" catch-up view (a design-it-yourself
 * feature). Approach: visit-based with a 24h floor — everything unread since
 * your last visit, grouped by category, capped at 5 per category with the
 * single freshest story promoted to a hero slot. Quiet days fall back to the
 * most recent unread items so the view is never empty while content exists.
 */
export default function DigestView() {
  const { subscriptions, categories, articles, readIds, digestSince, markRead, openArticle, markAllRead, setView } =
    useStore();

  const digest = useMemo(() => {
    const all: Article[] = subscriptions
      .flatMap((s) => articles[s.id] ?? [])
      .filter((a) => !readIds[a.id])
      .sort((a, b) => (b.publishedAt ? Date.parse(b.publishedAt) : 0) - (a.publishedAt ? Date.parse(a.publishedAt) : 0));

    // Window: since last visit, but at least the last 24 hours.
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const boundary = Math.min(digestSince ? Date.parse(digestSince) : dayAgo, dayAgo);
    let windowed = all.filter((a) => a.publishedAt && Date.parse(a.publishedAt) >= boundary);
    let quietDay = false;
    if (windowed.length === 0) {
      windowed = all.slice(0, 12);
      quietDay = true;
    }

    const hero = windowed.find((a) => a.imageUrl && a.excerpt) ?? windowed[0] ?? null;
    const rest = windowed.filter((a) => a !== hero);

    const subById = new Map(subscriptions.map((s) => [s.id, s]));
    const groups = [...categories]
      .sort((a, b) => a.order - b.order)
      .map((cat) => {
        const items = rest.filter((a) => subById.get(a.subscriptionId)?.categoryId === cat.id);
        return { category: cat, items: items.slice(0, PER_CATEGORY), total: items.length };
      })
      .filter((g) => g.items.length > 0);
    const uncategorized = rest.filter((a) => subById.get(a.subscriptionId)?.categoryId == null);

    return { hero, groups, uncategorized: uncategorized.slice(0, PER_CATEGORY), count: windowed.length, quietDay };
  }, [subscriptions, categories, articles, readIds, digestSince]);

  const subById = useMemo(() => new Map(subscriptions.map((s) => [s.id, s])), [subscriptions]);

  function open(a: Article) {
    markRead(a.id);
    openArticle(a.id);
  }

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  if (digest.count === 0) {
    return (
      <div className="mx-auto max-w-feed px-6 py-20 text-center">
        <Coffee className="mx-auto size-10 text-text-tertiary" />
        <h2 className="mt-4 text-lg font-semibold">You&apos;re all caught up</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
          Nothing unread right now. Enjoy the quiet, or refresh your feeds to check for new
          stories.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-feed px-4 py-8 sm:px-6">
      {/* Digest header */}
      <header className="mb-8">
        <div className="flex items-center gap-2 text-accent">
          <Sparkles className="size-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Your digest</span>
        </div>
        <h2 className="mt-2 text-xl font-bold tracking-tight">
          {greeting} — {digest.quietDay ? "a quiet stretch, here's the latest" : `${pluralize(digest.count, "story", "stories")} since your last visit`}
        </h2>
        <p className="mt-1.5 text-sm text-text-secondary">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          {" · "}the freshest unread stories, grouped by category
        </p>
      </header>

      {/* Hero story */}
      {digest.hero && (
        <button
          onClick={() => open(digest.hero!)}
          className="group mb-10 block w-full overflow-hidden rounded-xl border border-border bg-surface text-left shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex flex-col sm:flex-row">
            {digest.hero.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={digest.hero.imageUrl}
                alt=""
                loading="lazy"
                className="h-48 w-full object-cover sm:h-auto sm:w-64 lg:w-80"
              />
            )}
            <div className="flex-1 p-6">
              <div className="mb-2 flex items-center gap-2 text-xs text-text-tertiary">
                <Favicon src={subById.get(digest.hero.subscriptionId)?.iconUrl ?? null} size={16} />
                <span className="font-medium text-text-secondary">
                  {subById.get(digest.hero.subscriptionId)?.title}
                </span>
                <span aria-hidden>·</span>
                <time title={fullDate(digest.hero.publishedAt)}>
                  {relativeTime(digest.hero.publishedAt)}
                </time>
              </div>
              <h3 className="text-lg font-semibold leading-snug group-hover:text-accent">
                {digest.hero.title}
              </h3>
              {digest.hero.excerpt && (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-text-secondary">
                  {digest.hero.excerpt}
                </p>
              )}
            </div>
          </div>
        </button>
      )}

      {/* Category sections */}
      <div className="space-y-10">
        {digest.groups.map(({ category, items, total }) => (
          <section key={category.id} aria-label={category.name}>
            <div className="mb-3 flex items-center justify-between border-b border-border-subtle pb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                {category.name}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => markAllRead({ type: "category", id: category.id })}
                  title={`Mark all in ${category.name} as read`}
                  className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
                >
                  <CheckCheck className="size-4" />
                </button>
                <button
                  onClick={() => setView({ type: "category", id: category.id })}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-subtle"
                >
                  {total > items.length ? `+${total - items.length} more` : "View all"}
                  <ArrowRight className="size-3" />
                </button>
              </div>
            </div>
            <ol className="space-y-1">
              {items.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => open(a)}
                    className="group flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left hover:bg-bg-tertiary/60"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 self-center rounded-full bg-unread" aria-hidden />
                    <span className="min-w-0 flex-1 text-sm font-medium text-text-primary group-hover:text-accent">
                      {a.title}
                    </span>
                    <span className="hidden shrink-0 text-xs text-text-tertiary sm:block">
                      {subById.get(a.subscriptionId)?.title}
                    </span>
                    <time className="shrink-0 text-xs text-text-tertiary tabular-nums">
                      {relativeTime(a.publishedAt)}
                    </time>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}

        {digest.uncategorized.length > 0 && (
          <section aria-label="Uncategorized">
            <h3 className="mb-3 border-b border-border-subtle pb-2 text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Elsewhere
            </h3>
            <ol className="space-y-1">
              {digest.uncategorized.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => open(a)}
                    className="group flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left hover:bg-bg-tertiary/60"
                  >
                    <span className="min-w-0 flex-1 text-sm font-medium group-hover:text-accent">
                      {a.title}
                    </span>
                    <time className="shrink-0 text-xs text-text-tertiary">
                      {relativeTime(a.publishedAt)}
                    </time>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
