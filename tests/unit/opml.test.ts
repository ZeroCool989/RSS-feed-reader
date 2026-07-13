// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildOpml, parseOpml } from "@/lib/opml";
import type { Category, Subscription } from "@/lib/types";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test</title></head>
  <body>
    <outline text="Frontend" title="Frontend">
      <outline type="rss" text="CSS-Tricks" xmlUrl="https://css-tricks.com/feed/" htmlUrl="https://css-tricks.com/"/>
      <outline text="web.dev (no type)" xmlUrl="https://web.dev/feed.xml"/>
    </outline>
    <outline text="Design">
      <outline type="rss" text="Lowercase attrs" xmlurl="https://example.com/lower.xml" htmlurl="https://example.com/"/>
    </outline>
    <outline text="Nested Category">
      <outline text="Subcategory">
        <outline type="rss" text="Deep Feed" xmlUrl="https://example.com/deep.xml"/>
      </outline>
    </outline>
    <outline type="rss" text="Duplicate" xmlUrl="https://css-tricks.com/feed/"/>
    <outline type="rss" xmlUrl="https://example.com/no-title.xml"/>
  </body>
</opml>`;

describe("parseOpml", () => {
  const result = parseOpml(SAMPLE);

  it("imports feeds including entries without a type attribute", () => {
    const urls = result.entries.map((e) => e.xmlUrl);
    expect(urls).toContain("https://css-tricks.com/feed/");
    expect(urls).toContain("https://web.dev/feed.xml");
  });

  it("handles lowercase attribute names case-insensitively", () => {
    expect(result.entries.some((e) => e.xmlUrl === "https://example.com/lower.xml")).toBe(true);
  });

  it("flattens nested categories to the top-level folder", () => {
    const deep = result.entries.find((e) => e.xmlUrl === "https://example.com/deep.xml");
    expect(deep?.category).toBe("Nested Category");
  });

  it("deduplicates repeated xmlUrls and counts them", () => {
    const cssTricks = result.entries.filter((e) => e.xmlUrl === "https://css-tricks.com/feed/");
    expect(cssTricks).toHaveLength(1);
    expect(result.duplicatesInFile).toBe(1);
  });

  it("keeps entries with no title (resolved later from the feed itself)", () => {
    const untitled = result.entries.find((e) => e.xmlUrl === "https://example.com/no-title.xml");
    expect(untitled).toBeDefined();
    expect(untitled?.title).toBe("");
  });

  it("assigns feeds to their folder name as category", () => {
    const css = result.entries.find((e) => e.xmlUrl === "https://css-tricks.com/feed/");
    expect(css?.category).toBe("Frontend");
  });

  it("reports invalid XML clearly", () => {
    const bad = parseOpml("<<<");
    expect(bad.entries).toHaveLength(0);
    expect(bad.errors[0]).toMatch(/not valid/i);
  });

  it("handles the provided sample-feeds.opml structure end-to-end", async () => {
    const fs = await import("node:fs");
    const xml = fs.readFileSync("public/sample-feeds.opml", "utf8");
    const parsed = parseOpml(xml);
    // 19 curated + 1 dead edge-case feed = 20 unique; duplicates collapsed
    expect(parsed.entries.length).toBe(20);
    expect(parsed.duplicatesInFile).toBeGreaterThanOrEqual(2);
    expect(parsed.errors).toHaveLength(0);
  });
});

describe("buildOpml (export)", () => {
  const categories: Category[] = [{ id: "c1", name: "Frontend & Fun", order: 0 }];
  const sub = (over: Partial<Subscription>): Subscription => ({
    id: "s1",
    feedUrl: "https://example.com/feed.xml",
    siteUrl: "https://example.com/",
    title: "Example",
    customTitle: null,
    description: "",
    iconUrl: null,
    categoryId: "c1",
    addedAt: "2024-01-01T00:00:00.000Z",
    lastFetchedAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastErrorKind: null,
    newestItemAt: null,
    consecutiveFailures: 0,
    ...over,
  });

  it("round-trips through parseOpml preserving categories and escaping", () => {
    const xml = buildOpml(
      [
        sub({}),
        sub({ id: "s2", feedUrl: "https://other.com/rss?a=1&b=2", categoryId: null, customTitle: 'My "Custom" <Title>' }),
      ],
      categories
    );
    const parsed = parseOpml(xml);
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0].category).toBe("Frontend & Fun");
    expect(parsed.entries[1].xmlUrl).toBe("https://other.com/rss?a=1&b=2");
    expect(parsed.entries[1].title).toBe('My "Custom" <Title>');
    expect(parsed.entries[1].category).toBeNull();
  });
});
