import type { Category, Subscription } from "./types";
import { normalizeFeedUrl } from "./utils";

/**
 * OPML import/export (runs in the browser — DOMParser does not resolve
 * external entities, so this is XXE-safe).
 *
 * Import handles the edge cases from the sample file: lowercase `xmlurl`
 * attributes, missing `type`, arbitrary nesting (flattened to the top-level
 * category), duplicate URLs, and entries with no title.
 */

export interface OpmlEntry {
  title: string;
  xmlUrl: string;
  htmlUrl: string;
  category: string | null;
}

export interface OpmlParseResult {
  entries: OpmlEntry[];
  errors: string[];
  /** Entries dropped because the same xmlUrl appeared earlier in the file. */
  duplicatesInFile: number;
}

function attr(el: Element, name: string): string {
  // OPML in the wild uses xmlUrl / xmlurl / XMLURL — match case-insensitively.
  for (const a of Array.from(el.attributes)) {
    if (a.name.toLowerCase() === name.toLowerCase()) return a.value;
  }
  return "";
}

export function parseOpml(xml: string): OpmlParseResult {
  const errors: string[] = [];
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) {
    return { entries: [], errors: ["File is not valid OPML/XML"], duplicatesInFile: 0 };
  }

  const entries: OpmlEntry[] = [];
  const seen = new Set<string>();
  let duplicatesInFile = 0;

  function walk(el: Element, categoryPath: string[]) {
    for (const child of Array.from(el.children)) {
      if (child.tagName.toLowerCase() !== "outline") continue;
      const xmlUrl = attr(child, "xmlUrl");
      const text = attr(child, "text") || attr(child, "title");

      if (xmlUrl) {
        const key = normalizeFeedUrl(xmlUrl);
        if (seen.has(key)) {
          // duplicate inside the file itself — keep first occurrence
          duplicatesInFile++;
          walk(child, categoryPath);
          continue;
        }
        seen.add(key);
        entries.push({
          title: text,
          xmlUrl,
          htmlUrl: attr(child, "htmlUrl"),
          // nested structures flatten to the top-level folder name
          category: categoryPath[0] ?? null,
        });
      } else if (text) {
        walk(child, [...categoryPath, text]);
        continue;
      }
      walk(child, categoryPath);
    }
  }

  const body = doc.querySelector("body");
  if (!body) return { entries: [], errors: ["OPML file has no <body>"], duplicatesInFile: 0 };
  walk(body, []);

  if (entries.length === 0) errors.push("No feeds found in this file");
  return { entries, errors, duplicatesInFile };
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildOpml(subscriptions: Subscription[], categories: Category[]): string {
  const byCategory = new Map<string | null, Subscription[]>();
  for (const sub of subscriptions) {
    const list = byCategory.get(sub.categoryId) ?? [];
    list.push(sub);
    byCategory.set(sub.categoryId, list);
  }

  const outline = (sub: Subscription) =>
    `    <outline type="rss" text="${xmlEscape(sub.customTitle ?? sub.title)}" title="${xmlEscape(
      sub.customTitle ?? sub.title
    )}" xmlUrl="${xmlEscape(sub.feedUrl)}" htmlUrl="${xmlEscape(sub.siteUrl)}"/>`;

  const groups: string[] = [];
  for (const cat of [...categories].sort((a, b) => a.order - b.order)) {
    const subs = byCategory.get(cat.id);
    if (!subs?.length) continue;
    groups.push(
      `  <outline text="${xmlEscape(cat.name)}" title="${xmlEscape(cat.name)}">\n${subs
        .map(outline)
        .join("\n")}\n  </outline>`
    );
  }
  const uncategorized = byCategory.get(null) ?? [];
  for (const sub of uncategorized) groups.push(outline(sub).replace(/^ {4}/, "  "));

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Frontpage subscriptions</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
${groups.join("\n")}
  </body>
</opml>
`;
}
