import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, isBlockedIp } from "@/lib/server/ssrf";

describe("isBlockedIp", () => {
  it("blocks loopback, private, link-local and CGNAT IPv4 ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "127.8.8.8",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // CGNAT
      "0.0.0.0",
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "151.101.1.140", "172.32.0.1", "9.255.255.255"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  it("blocks IPv6 loopback, link-local, ULA, and mapped-IPv4 forms", () => {
    for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:192.168.0.1"]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv6", () => {
    expect(isBlockedIp("2606:4700:4700::1111")).toBe(false);
  });
});

describe("assertPublicHttpUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    for (const url of ["file:///etc/passwd", "ftp://example.com/x", "javascript:alert(1)", "gopher://x"]) {
      expect((await assertPublicHttpUrl(url)).ok, url).toBe(false);
    }
  });

  it("rejects invalid URLs and embedded credentials", async () => {
    expect((await assertPublicHttpUrl("not a url")).ok).toBe(false);
    expect((await assertPublicHttpUrl("https://user:pass@example.com/feed")).ok).toBe(false);
  });

  it("rejects blocked hostnames and literal private IPs (incl. decimal/octal forms)", async () => {
    for (const url of [
      "http://localhost/feed",
      "http://127.0.0.1/feed",
      "http://2130706433/", // 127.0.0.1 as decimal — URL normalizes it
      "http://0177.0.0.1/", // octal
      "http://0x7f.0.0.1/", // hex
      "http://127.1/", // shorthand
      "http://[::1]/feed",
      "http://[::ffff:127.0.0.1]/feed",
      "http://169.254.169.254/latest/meta-data/",
      "http://metadata.google.internal/computeMetadata/",
    ]) {
      expect((await assertPublicHttpUrl(url)).ok, url).toBe(false);
    }
  });

  it("allows a URL with a public literal IP", async () => {
    expect((await assertPublicHttpUrl("http://8.8.8.8/feed.xml")).ok).toBe(true);
  });
});
