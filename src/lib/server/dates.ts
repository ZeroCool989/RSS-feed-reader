/**
 * Tolerant date parsing across the formats found in real feeds:
 * ISO 8601 (Atom), RFC 822/2822 (RSS), and common sloppy variants.
 */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Zone abbreviations Date.parse chokes on in some runtimes.
const ZONE_OFFSETS: Record<string, string> = {
  UT: "+0000", GMT: "+0000", UTC: "+0000", Z: "+0000",
  EST: "-0500", EDT: "-0400", CST: "-0600", CDT: "-0500",
  MST: "-0700", MDT: "-0600", PST: "-0800", PDT: "-0700",
};

export function parseFeedDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let t: number;
  const hasTime = /\d{1,2}:\d{2}/.test(s);

  if (hasTime) {
    const hasNumericZone = /(?:[+-]\d{2}:?\d{2}|Z)$/i.test(s);
    const zoneAbbr = s.match(/\s([A-Z]{2,4})$/)?.[1];

    if (hasNumericZone) {
      t = Date.parse(s);
      if (!Number.isNaN(t)) return clampFuture(t);
    } else if (zoneAbbr && ZONE_OFFSETS[zoneAbbr]) {
      t = Date.parse(s.replace(/\s[A-Z]{2,4}$/, " " + ZONE_OFFSETS[zoneAbbr]));
      if (!Number.isNaN(t)) return clampFuture(t);
    } else if (!zoneAbbr) {
      // No timezone at all ("2024-01-15T10:30:00", "15 Jan 2024 10:30:00").
      // Date.parse would interpret these as server-local time — feeds almost
      // always mean UTC, so append it explicitly.
      t = /^\d{4}-\d{2}-\d{2}T/.test(s) ? Date.parse(s + "Z") : Date.parse(s + " +0000");
      if (!Number.isNaN(t)) return clampFuture(t);
    } else {
      // Unknown zone abbreviation — try as-is, then strip it and assume UTC.
      t = Date.parse(s);
      if (!Number.isNaN(t)) return clampFuture(t);
      t = Date.parse(s.replace(/\s[A-Z]{2,4}$/, " +0000"));
      if (!Number.isNaN(t)) return clampFuture(t);
    }
    // Last resort for time-bearing strings.
    t = Date.parse(s);
    if (!Number.isNaN(t)) return clampFuture(t);
  }

  // Date-only ISO ("2024-01-15") — Date.parse treats this as UTC already.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    t = Date.parse(s);
    if (!Number.isNaN(t)) return clampFuture(t);
  }

  // Manual RFC 822-ish fallback (UTC midnight): "15 Jan 2024" / "Jan 15, 2024"
  const dmy = s.match(/(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/);
  if (dmy) {
    const month = MONTHS[dmy[2].toLowerCase()];
    if (month !== undefined) {
      return clampFuture(Date.UTC(Number(dmy[3]), month, Number(dmy[1])));
    }
  }
  const mdy = s.match(/([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})/);
  if (mdy) {
    const month = MONTHS[mdy[1].toLowerCase()];
    if (month !== undefined) {
      return clampFuture(Date.UTC(Number(mdy[3]), month, Number(mdy[2])));
    }
  }

  return null;
}

/** Feeds sometimes carry bogus future dates; clamp anything > 1 day ahead. */
function clampFuture(t: number): string {
  const dayAhead = Date.now() + 24 * 3600 * 1000;
  return new Date(Math.min(t, dayAhead)).toISOString();
}
