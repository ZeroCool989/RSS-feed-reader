import { describe, expect, it } from "vitest";
import { parseFeedDate } from "@/lib/server/dates";

describe("parseFeedDate", () => {
  it("parses ISO 8601 (Atom)", () => {
    expect(parseFeedDate("2024-01-15T10:30:00Z")).toBe("2024-01-15T10:30:00.000Z");
    expect(parseFeedDate("2024-01-15T10:30:00+02:00")).toBe("2024-01-15T08:30:00.000Z");
  });

  it("parses RFC 822 / RFC 2822 (RSS)", () => {
    expect(parseFeedDate("Mon, 15 Jan 2024 10:30:00 GMT")).toBe("2024-01-15T10:30:00.000Z");
    expect(parseFeedDate("Mon, 15 Jan 2024 10:30:00 +0000")).toBe("2024-01-15T10:30:00.000Z");
  });

  it("handles timezone abbreviations Date.parse may reject", () => {
    expect(parseFeedDate("Mon, 15 Jan 2024 10:30:00 UT")).toBe("2024-01-15T10:30:00.000Z");
    expect(parseFeedDate("Mon, 15 Jan 2024 05:30:00 EST")).toBe("2024-01-15T10:30:00.000Z");
    expect(parseFeedDate("Mon, 15 Jan 2024 02:30:00 PST")).toBe("2024-01-15T10:30:00.000Z");
  });

  it("assumes UTC when the timezone is missing entirely", () => {
    expect(parseFeedDate("15 Jan 2024 10:30:00")).toBe("2024-01-15T10:30:00.000Z");
  });

  it("falls back for date-only sloppy formats", () => {
    expect(parseFeedDate("15 Jan 2024")).toBe("2024-01-15T00:00:00.000Z");
    expect(parseFeedDate("January 15, 2024")).toBe("2024-01-15T00:00:00.000Z");
  });

  it("clamps bogus far-future dates to ~now", () => {
    const result = parseFeedDate("2124-01-15T10:30:00Z");
    expect(result).not.toBeNull();
    expect(Date.parse(result!)).toBeLessThanOrEqual(Date.now() + 25 * 3600 * 1000);
  });

  it("returns null for missing or garbage input", () => {
    expect(parseFeedDate(null)).toBeNull();
    expect(parseFeedDate(undefined)).toBeNull();
    expect(parseFeedDate("")).toBeNull();
    expect(parseFeedDate("not a date")).toBeNull();
  });
});
