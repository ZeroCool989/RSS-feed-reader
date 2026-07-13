import { expect, test } from "@playwright/test";

/** API-level contract tests for the feed proxy — security and error paths. */

test.describe("/api/feed security", () => {
  const blocked = [
    "http://localhost/feed",
    "http://127.0.0.1/feed",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/feed",
    "http://2130706433/",
    "file:///etc/passwd",
    "ftp://example.com/feed",
  ];

  for (const url of blocked) {
    test(`blocks ${url}`, async ({ request }) => {
      const res = await request.get(`/api/feed?url=${encodeURIComponent(url)}`);
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.kind).toBe("blocked");
    });
  }

  test("rejects a missing url parameter", async ({ request }) => {
    const res = await request.get("/api/feed");
    expect(res.status()).toBe(400);
  });
});

test.describe("/api/feed error classification", () => {
  test("HTML pages are rejected as not-a-feed", async ({ request }) => {
    const res = await request.get(`/api/feed?url=${encodeURIComponent("https://example.com/")}`);
    expect(res.status()).toBe(422);
    expect((await res.json()).kind).toBe("not-a-feed");
  });

  test("404 feeds are reported with the upstream status", async ({ request }) => {
    const res = await request.get(
      `/api/feed?url=${encodeURIComponent("https://css-tricks.com/definitely-not-a-feed-xyz/")}`
    );
    expect(res.status()).toBe(502);
    const body = await res.json();
    expect(body.kind).toBe("http");
    expect(body.status).toBe(404);
  });
});

test.describe("/api/feed parsing + caching", () => {
  test("parses a real feed into the normalized shape and caches it", async ({ request }) => {
    const target = `/api/feed?url=${encodeURIComponent("https://css-tricks.com/feed/")}`;
    const first = await request.get(target);
    expect(first.ok()).toBeTruthy();
    const body = await first.json();
    expect(body.meta.format).toBe("rss2");
    expect(body.meta.title.length).toBeGreaterThan(0);
    expect(body.items.length).toBeGreaterThan(0);
    const item = body.items[0];
    expect(item.id).toMatch(/^[0-9a-f]{16}$/);
    expect(item.title.length).toBeGreaterThan(0);
    expect(item.url).toMatch(/^https:/);
    // Second hit must come from the server cache
    const second = await request.get(target);
    expect(second.headers()["x-feed-cache"]).toMatch(/hit|revalidated/);
  });

  test("sanitizes feed HTML server-side (no scripts or event handlers)", async ({ request }) => {
    const res = await request.get(
      `/api/feed?url=${encodeURIComponent("https://blog.cloudflare.com/rss/")}`
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    for (const item of body.items) {
      if (!item.contentHtml) continue;
      expect(item.contentHtml).not.toMatch(/<script/i);
      expect(item.contentHtml).not.toMatch(/\son\w+=/i);
      expect(item.contentHtml).not.toMatch(/javascript:/i);
    }
  });

  test("security headers are set on responses", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
  });
});
