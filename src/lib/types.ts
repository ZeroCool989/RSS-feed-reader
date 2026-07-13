/** Normalized shapes shared between the server parser and the client store. */

export type FeedFormat = "rss2" | "rss1" | "atom" | "unknown";

export type FeedHealth = "active" | "stale" | "error";

export interface ParsedFeedMeta {
  title: string;
  description: string;
  siteUrl: string;
  feedUrl: string;
  format: FeedFormat;
  iconUrl: string | null;
}

export interface ParsedItem {
  /** Stable id derived from guid/link — survives re-fetches for dedup + read state. */
  id: string;
  title: string;
  url: string;
  author: string | null;
  /** ISO string, or null when the feed omits dates. */
  publishedAt: string | null;
  /** Plain-text excerpt, entity-decoded, truncated. */
  excerpt: string;
  /** Sanitized HTML full content when the feed provides it. */
  contentHtml: string | null;
  imageUrl: string | null;
}

export interface FetchFeedResult {
  meta: ParsedFeedMeta;
  items: ParsedItem[];
  /** Set when the XML was malformed but a partial parse succeeded. */
  partial?: boolean;
  /** Set when the server followed a permanent redirect — client should update the stored URL. */
  permanentRedirect?: string;
}

export interface FeedError {
  error: string;
  /** Coarse classification so the UI can message 404 vs timeout differently. */
  kind: "invalid-url" | "blocked" | "timeout" | "http" | "not-a-feed" | "parse" | "network";
  status?: number;
}

/* ------------------------------ client models ------------------------------ */

export interface Subscription {
  id: string;
  feedUrl: string;
  siteUrl: string;
  /** Title from the feed itself. */
  title: string;
  /** User override — takes precedence when set. */
  customTitle: string | null;
  description: string;
  iconUrl: string | null;
  categoryId: string | null;
  addedAt: string;
  /** Fetch bookkeeping */
  lastFetchedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastErrorKind: FeedError["kind"] | null;
  /** Most recent item date seen — used for stale detection. */
  newestItemAt: string | null;
  consecutiveFailures: number;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface Article extends ParsedItem {
  subscriptionId: string;
}

export type LayoutMode = "compact" | "list" | "cards";

export interface Preferences {
  layout: LayoutMode;
  theme: "system" | "light" | "dark";
  refreshIntervalMin: 0 | 15 | 30 | 60;
  readerFontSize: "sm" | "md" | "lg";
  hideRead: boolean;
  digestCollapsed: string[];
}

export interface BookmarkedArticle extends Article {
  savedAt: string;
}
