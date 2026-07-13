import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { escapeRegExp, hostnameOf, normalizeFeedUrl, pluralize, relativeTime } from "@/lib/utils";

describe("relativeTime", () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date("2026-07-13T12:00:00Z")));
  afterEach(() => vi.useRealTimers());

  it("formats recency buckets", () => {
    expect(relativeTime("2026-07-13T11:59:40Z")).toBe("just now");
    expect(relativeTime("2026-07-13T11:15:00Z")).toBe("45m ago");
    expect(relativeTime("2026-07-13T07:00:00Z")).toBe("5h ago");
    expect(relativeTime("2026-07-12T09:00:00Z")).toBe("yesterday");
    expect(relativeTime("2026-07-09T12:00:00Z")).toBe("4d ago");
    expect(relativeTime("2026-06-29T12:00:00Z")).toBe("2w ago");
  });

  it("is empty for null/garbage", () => {
    expect(relativeTime(null)).toBe("");
    expect(relativeTime("nope")).toBe("");
  });
});

describe("normalizeFeedUrl", () => {
  it("normalizes case and trailing slashes for dedup", () => {
    expect(normalizeFeedUrl("HTTPS://Example.com/Feed/")).toBe("https://example.com/feed");
    expect(normalizeFeedUrl("  https://a.com/f//  ")).toBe("https://a.com/f");
  });
});

describe("hostnameOf", () => {
  it("strips www and survives invalid urls", () => {
    expect(hostnameOf("https://www.example.com/a/b")).toBe("example.com");
    expect(hostnameOf("not-a-url")).toBe("not-a-url");
  });
});

describe("escapeRegExp", () => {
  it("escapes special characters so user queries are literal", () => {
    const re = new RegExp(escapeRegExp("c++ (v2)?"), "i");
    expect(re.test("learning C++ (v2)? today")).toBe(true);
  });
});

describe("pluralize", () => {
  it("handles singular, plural and irregular forms", () => {
    expect(pluralize(1, "item")).toBe("1 item");
    expect(pluralize(3, "item")).toBe("3 items");
    expect(pluralize(2, "story", "stories")).toBe("2 stories");
  });
});
