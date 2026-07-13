import { describe, expect, it } from "vitest";
import { htmlToExcerpt, sanitizeFeedHtml } from "@/lib/server/sanitize";

describe("sanitizeFeedHtml — XSS protection", () => {
  it("strips script tags and inline event handlers", () => {
    const out = sanitizeFeedHtml(
      `<p onclick="alert(1)">hi</p><script>alert(2)</script><img src="x" onerror="alert(3)">`
    );
    expect(out).not.toContain("script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
    expect(out).toContain("<p>hi</p>");
  });

  it("blocks javascript: and data: links", () => {
    const out = sanitizeFeedHtml(`<a href="javascript:alert(1)">x</a><a href="data:text/html,hi">y</a>`);
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("data:text/html");
  });

  it("removes iframes, forms, styles and other non-content chrome", () => {
    const out = sanitizeFeedHtml(
      `<iframe src="https://evil.example"></iframe><form><input></form><style>p{}</style><nav>nav</nav><p>keep</p>`
    );
    expect(out).toBe("<p>keep</p>");
  });

  it("forces target=_blank + rel=noopener on links", () => {
    const out = sanitizeFeedHtml(`<a href="https://example.com">x</a>`);
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("drops tracking pixels but keeps real images (lazy, https-upgraded)", () => {
    const out = sanitizeFeedHtml(
      `<img src="https://medium.com/stat?event=post" width="1" height="1"><img src="http://example.com/photo.jpg" alt="photo">`
    );
    expect(out).not.toContain("stat?");
    expect(out).toContain('src="https://example.com/photo.jpg"');
    expect(out).toContain('loading="lazy"');
  });

  it("preserves content structure: headings, lists, code, tables", () => {
    const input = `<h2>Title</h2><ul><li>a</li></ul><pre><code>const x = 1;</code></pre><table><tr><td>c</td></tr></table>`;
    const out = sanitizeFeedHtml(input);
    for (const tag of ["<h2>", "<ul>", "<li>", "<pre>", "<code>", "<table>", "<td>"]) {
      expect(out).toContain(tag);
    }
  });
});

describe("htmlToExcerpt", () => {
  it("strips all markup and collapses whitespace", () => {
    expect(htmlToExcerpt("<p>Hello   <b>world</b></p>\n<p>again</p>")).toBe("Hello world again");
  });

  it("truncates long text at a word boundary with an ellipsis", () => {
    const text = "word ".repeat(200);
    const out = htmlToExcerpt(`<p>${text}</p>`);
    expect(out.length).toBeLessThanOrEqual(321);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/wor…$/); // cut on a word boundary, not mid-word
  });
});
