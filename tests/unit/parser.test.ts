import { describe, expect, it } from "vitest";
import { decodeEntities, looksLikeFeed, parseFeedXml } from "@/lib/server/parser";

const FEED_URL = "https://example.com/feed.xml";

const RSS2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Test Blog &amp; Friends</title>
    <link>https://example.com/</link>
    <description>A test feed</description>
    <item>
      <title>Hello &amp;mdash; World &#8217;s</title>
      <link>https://example.com/post-1</link>
      <guid>post-1</guid>
      <pubDate>Mon, 15 Jan 2024 10:30:00 GMT</pubDate>
      <dc:creator>Jane Doe</dc:creator>
      <description>&lt;p&gt;A &lt;b&gt;summary&lt;/b&gt; with markup&lt;/p&gt;</description>
      <content:encoded><![CDATA[<p>Full content with an <img src="http://example.com/pic.jpg" alt=""> image and <code>&lt;div&gt;</code> code.</p><p>${"x".repeat(50)} more paragraphs to pass the length threshold ${"y".repeat(400)}</p>]]></content:encoded>
    </item>
    <item>
      <title>No date, no guid</title>
      <link>https://example.com/post-2</link>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Test</title>
  <subtitle>Testing atom</subtitle>
  <link href="https://example.com/"/>
  <link rel="self" href="${FEED_URL}"/>
  <entry>
    <id>tag:example.com,2024:1</id>
    <title>Entry one</title>
    <link rel="alternate" href="https://example.com/one?a=1&amp;b=2"/>
    <published>2024-01-15T10:30:00Z</published>
    <author><name>Alice</name></author>
    <summary type="html">&lt;p&gt;Short summary&lt;/p&gt;</summary>
  </entry>
  <entry>
    <id>tag:example.com,2024:2</id>
    <title>Entry two — xhtml content</title>
    <link href="https://example.com/two"/>
    <updated>2024-02-01T08:00:00Z</updated>
    <content type="xhtml">
      <div xmlns="http://www.w3.org/1999/xhtml">
        <h2>First heading</h2>
        <p>First paragraph.</p>
        <h2>Second heading</h2>
        <p>Second paragraph with <a href="https://example.com/link">a link</a>.</p>
        <p>${"padding ".repeat(80)}</p>
      </div>
    </content>
  </entry>
</feed>`;

const RDF = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://example.com/">
    <title>RDF Feed</title>
    <link>https://example.com/</link>
    <description>RSS 1.0 test</description>
  </channel>
  <item rdf:about="https://example.com/rdf-1">
    <title>RDF item</title>
    <link>https://example.com/rdf-1</link>
    <dc:date>2024-01-15T10:30:00Z</dc:date>
    <description>Plain text description</description>
  </item>
</rdf:RDF>`;

describe("parseFeedXml — RSS 2.0", () => {
  const result = parseFeedXml(RSS2, FEED_URL);

  it("extracts channel metadata", () => {
    expect(result.meta.title).toBe("Test Blog & Friends");
    expect(result.meta.siteUrl).toBe("https://example.com/");
    expect(result.meta.format).toBe("rss2");
  });

  it("decodes entities in titles (including double-encoded)", () => {
    expect(result.items[0].title).toBe("Hello — World ’s");
  });

  it("extracts author, date, and stable ids", () => {
    const item = result.items[0];
    expect(item.author).toBe("Jane Doe");
    expect(item.publishedAt).toBe("2024-01-15T10:30:00.000Z");
    expect(item.id).toMatch(/^[0-9a-f]{16}$/);
    // Same input → same id (dedup across refetches)
    expect(parseFeedXml(RSS2, FEED_URL).items[0].id).toBe(item.id);
  });

  it("produces a plain-text excerpt from escaped HTML description", () => {
    expect(result.items[0].excerpt).toBe("A summary with markup");
  });

  it("sanitizes CDATA content, keeps code, upgrades http images", () => {
    const html = result.items[0].contentHtml!;
    expect(html).toContain("<p>Full content");
    expect(html).toContain("<code>&lt;div&gt;</code>");
    expect(html).toContain('src="https://example.com/pic.jpg"');
    expect(html).toContain('loading="lazy"');
  });

  it("extracts the content image as the item image", () => {
    expect(result.items[0].imageUrl).toBe("https://example.com/pic.jpg");
  });

  it("tolerates items with missing optional fields", () => {
    const bare = result.items[1];
    expect(bare.title).toBe("No date, no guid");
    expect(bare.publishedAt).toBeNull();
    expect(bare.author).toBeNull();
    expect(bare.contentHtml).toBeNull();
  });
});

describe("parseFeedXml — Atom 1.0", () => {
  const result = parseFeedXml(ATOM, FEED_URL);

  it("extracts feed metadata", () => {
    expect(result.meta.title).toBe("Atom Test");
    expect(result.meta.format).toBe("atom");
    expect(result.meta.siteUrl).toBe("https://example.com/");
  });

  it("picks the alternate link and decodes &amp; in hrefs", () => {
    expect(result.items[0].url).toBe("https://example.com/one?a=1&b=2");
  });

  it("reads authors and escaped html summaries", () => {
    expect(result.items[0].author).toBe("Alice");
    expect(result.items[0].excerpt).toBe("Short summary");
  });

  it("serializes xhtml content preserving element order", () => {
    const html = parseFeedXml(ATOM, FEED_URL).items[1].contentHtml!;
    const first = html.indexOf("First heading");
    const firstP = html.indexOf("First paragraph");
    const second = html.indexOf("Second heading");
    const secondP = html.indexOf("Second paragraph");
    expect(first).toBeGreaterThan(-1);
    expect(firstP).toBeGreaterThan(first);
    expect(second).toBeGreaterThan(firstP);
    expect(secondP).toBeGreaterThan(second);
    expect(html).toContain('<a href="https://example.com/link"');
  });

  it("falls back to updated when published is missing", () => {
    expect(result.items[1].publishedAt).toBe("2024-02-01T08:00:00.000Z");
  });
});

describe("parseFeedXml — RSS 1.0 / RDF", () => {
  const result = parseFeedXml(RDF, FEED_URL);

  it("parses channel and items from the RDF structure", () => {
    expect(result.meta.format).toBe("rss1");
    expect(result.meta.title).toBe("RDF Feed");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("RDF item");
    expect(result.items[0].publishedAt).toBe("2024-01-15T10:30:00.000Z");
  });
});

describe("parseFeedXml — malformed input", () => {
  it("recovers a document truncated mid-tag (partial parse)", () => {
    // Cut in the middle of the second item's closing tag — guaranteed-invalid XML
    const secondClose = RSS2.indexOf("</item>", RSS2.indexOf("</item>") + 1);
    const truncated = RSS2.slice(0, secondClose + 4);
    const result = parseFeedXml(truncated, FEED_URL);
    expect(result.partial).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toContain("Hello");
  });

  it("throws a clear error for fully broken XML", () => {
    expect(() => parseFeedXml("<<<not xml>>>", FEED_URL)).toThrow();
  });

  it("throws for valid XML that is not a feed", () => {
    expect(() => parseFeedXml("<html><body>hi</body></html>", FEED_URL)).toThrow(
      /Not a recognized/
    );
  });

  it("strips control characters that break real feeds", () => {
    const dirty = RSS2.replace("Hello", "He\x00l\x08lo");
    expect(parseFeedXml(dirty, FEED_URL).items[0].title).toContain("Hello");
  });
});

describe("looksLikeFeed", () => {
  it("accepts rss/atom/rdf documents", () => {
    expect(looksLikeFeed(RSS2)).toBe(true);
    expect(looksLikeFeed(ATOM)).toBe(true);
    expect(looksLikeFeed(RDF)).toBe(true);
  });
  it("rejects HTML pages", () => {
    expect(looksLikeFeed("<!DOCTYPE html><html><head></head></html>")).toBe(false);
  });
});

describe("decodeEntities", () => {
  it("decodes named, numeric, and double-encoded entities", () => {
    expect(decodeEntities("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeEntities("caf&#233;")).toBe("café");
    expect(decodeEntities("it&amp;#8217;s")).toBe("it’s");
    expect(decodeEntities("A &mdash; B &hellip;")).toBe("A — B …");
  });
});
