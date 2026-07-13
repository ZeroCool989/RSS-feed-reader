import Link from "next/link";
import {
  Rss,
  FolderOpen,
  BookOpenText,
  Search,
  Keyboard,
  Newspaper,
  ArrowRight,
  Check,
} from "lucide-react";

const features = [
  {
    icon: Rss,
    title: "Every source, one place",
    body: "Blogs, newsletters, changelogs — add any RSS or Atom feed and read it all in a single calm dashboard. OPML import brings your existing subscriptions over in seconds.",
  },
  {
    icon: FolderOpen,
    title: "Organized your way",
    body: "Group feeds into categories like Frontend, Design, or AI. Unread counts keep you oriented; read state syncs across every view.",
  },
  {
    icon: BookOpenText,
    title: "A reader view worth reading in",
    body: "Full articles render clean and distraction-free — typography tuned for long-form, code blocks included, ads stripped out.",
  },
  {
    icon: Search,
    title: "Find it again, fast",
    body: "Full-text search across everything you follow, with a daily digest that catches you up on what you missed.",
  },
];

const shortcuts = [
  ["j / k", "next / previous article"],
  ["Enter", "open article"],
  ["m", "toggle read"],
  ["s", "save for later"],
  ["⌘K", "command palette"],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Header */}
      <header className="mx-auto flex max-w-page items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent">
            <Rss className="size-4.5 text-white" strokeWidth={2.5} />
          </span>
          <span className="text-lg font-semibold tracking-tight">Frontpage</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/reader"
            className="rounded-md px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          >
            Open the app
          </Link>
          <Link
            href="/reader?guest=1"
            className="rounded-md bg-accent px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
          >
            Try as Guest
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-page px-6 pt-16 pb-20 text-center sm:pt-24">
        <p className="mx-auto mb-5 w-fit rounded-full border border-border bg-bg-secondary px-3.5 py-1.5 text-xs font-medium text-text-secondary">
          RSS &amp; Atom, beautifully readable
        </p>
        <h1 className="mx-auto max-w-3xl text-balance text-2xl font-bold tracking-tight sm:text-3xl">
          Your personalized front page for tech content
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-balance text-base text-text-secondary">
          Dozens of blogs, newsletters and release notes — scattered across tabs, inboxes and
          bookmarks. Frontpage brings them home. One place. Your sources, your categories, your
          pace.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/reader?guest=1"
            className="group inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-accent-hover hover:shadow-lg"
          >
            Try as Guest — no sign-up
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/reader"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-6 py-3 text-base font-semibold text-text-primary shadow-sm transition-colors hover:bg-bg-tertiary"
          >
            Get started
          </Link>
        </div>
        <p className="mt-4 text-sm text-text-tertiary">
          Guest mode is pre-loaded with 19 curated feeds — real content, zero setup.
        </p>

        {/* Product mock */}
        <div className="relative mx-auto mt-16 max-w-4xl overflow-hidden rounded-xl border border-border bg-surface text-left shadow-lg">
          <div className="flex items-center gap-1.5 border-b border-border-subtle bg-bg-secondary px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="ml-3 hidden rounded-md bg-bg-tertiary px-16 py-1 text-xs text-text-tertiary sm:block">
              frontpage.app/reader
            </span>
          </div>
          <div className="flex">
            <div className="hidden w-48 shrink-0 border-r border-border-subtle bg-bg-secondary p-3 sm:block">
              {["All items", "Digest", "Saved"].map((label, i) => (
                <div
                  key={label}
                  className={`mb-1 rounded-md px-2.5 py-1.5 text-sm ${
                    i === 0 ? "bg-accent-subtle font-medium text-accent" : "text-text-secondary"
                  }`}
                >
                  {label}
                </div>
              ))}
              <div className="mt-4 mb-1 px-2.5 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                Categories
              </div>
              {[
                ["Frontend", "12"],
                ["Design", "5"],
                ["AI & ML", "9"],
              ].map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-text-secondary"
                >
                  <span>{name}</span>
                  <span className="text-xs text-text-tertiary">{count}</span>
                </div>
              ))}
            </div>
            <div className="min-w-0 flex-1 divide-y divide-border-subtle">
              {[
                ["CSS-Tricks", "A Deep Dive Into Container Queries", "2h ago", true],
                ["Josh W. Comeau", "The Joy of Spring Physics in CSS", "5h ago", true],
                ["Simon Willison", "Things I learned shipping LLM apps", "8h ago", false],
                ["The Pragmatic Engineer", "Inside a real platform migration", "1d ago", false],
              ].map(([source, title, time, unread]) => (
                <div key={title as string} className="flex items-start gap-3 px-4 py-3.5">
                  <span
                    className={`mt-2 size-2 shrink-0 rounded-full ${
                      unread ? "bg-unread" : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0">
                    <p
                      className={`truncate text-sm ${
                        unread ? "font-semibold" : "font-normal text-text-secondary"
                      }`}
                    >
                      {title}
                    </p>
                    <p className="mt-0.5 text-xs text-text-tertiary">
                      {source} · {time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border-subtle bg-bg-secondary">
        <div className="mx-auto max-w-page px-6 py-20">
          <h2 className="text-center text-xl font-semibold tracking-tight">
            Built for people who read for a living
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-base text-text-secondary">
            A well-organized desk, not another social feed.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent-subtle">
                  <Icon className="size-5 text-accent" />
                </span>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Keyboard + sign-up value */}
      <section className="mx-auto grid max-w-page items-center gap-12 px-6 py-20 lg:grid-cols-2">
        <div>
          <span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent-subtle">
            <Keyboard className="size-5 text-accent" />
          </span>
          <h2 className="text-xl font-semibold tracking-tight">Fast enough to live in</h2>
          <p className="mt-3 max-w-md text-base text-text-secondary">
            Vim-style navigation, a command palette, and three switchable layouts — from dense
            list to magazine cards. Triage a hundred headlines without touching the mouse.
          </p>
          <ul className="mt-6 space-y-2.5">
            {shortcuts.map(([key, action]) => (
              <li key={key} className="flex items-center gap-3 text-sm">
                <kbd className="min-w-14 rounded-md border border-border bg-bg-secondary px-2 py-1 text-center font-mono text-xs font-medium text-text-secondary">
                  {key}
                </kbd>
                <span className="text-text-secondary">{action}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-bg-secondary p-8">
          <span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent-subtle">
            <Newspaper className="size-5 text-accent" />
          </span>
          <h2 className="text-lg font-semibold tracking-tight">Start reading in one click</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Guest mode gives you a fully populated dashboard — 19 curated feeds across Frontend,
            Design, Backend &amp; DevOps, General Tech and AI. Everything below works from your
            first click:
          </p>
          <ul className="mt-5 space-y-2">
            {[
              "Browse, search, and bookmark real articles",
              "Switch layouts and toggle dark mode",
              "Add your own feeds or import OPML",
              "Catch up with the daily digest",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                {line}
              </li>
            ))}
          </ul>
          <Link
            href="/reader?guest=1"
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
          >
            Open the guest dashboard
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle">
        <div className="mx-auto flex max-w-page flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-text-tertiary sm:flex-row">
          <div className="flex items-center gap-2">
            <Rss className="size-4 text-accent" />
            <span className="font-medium text-text-secondary">Frontpage</span>
            <span>— your sources, your categories, your pace.</span>
          </div>
          <p>
            Built for the{" "}
            <a
              href="https://www.frontendmentor.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary underline underline-offset-2 hover:text-accent"
            >
              Frontend Mentor
            </a>{" "}
            product challenge
          </p>
        </div>
      </footer>
    </div>
  );
}
