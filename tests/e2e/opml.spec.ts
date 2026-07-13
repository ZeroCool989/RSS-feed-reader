import { expect, test } from "@playwright/test";
import path from "node:path";

const SAMPLE_OPML = path.resolve(__dirname, "../../public/sample-feeds.opml");

test("OPML import: preview, duplicate flagging, results report, category structure", async ({ page }) => {
  test.setTimeout(240_000); // imports ~20 live feeds

  await page.goto("/reader");
  await expect(page.getByText("Welcome to Frontpage")).toBeVisible();
  await page.getByRole("button", { name: "Import OPML" }).click();

  // Preview: 20 unique feeds (19 curated + 1 dead edge case), in-file dupes merged
  await page.locator('input[type=file]').setInputFiles(SAMPLE_OPML);
  await expect(page.getByText(/Found 20 feeds/)).toBeVisible();
  await expect(page.getByText(/duplicate entries in\s+the file merged/)).toBeVisible();

  // Import — each feed is fetched and validated live
  await page.getByRole("button", { name: /^Import 20 feeds$/ }).click();
  await expect(page.getByText("Import complete")).toBeVisible({ timeout: 200_000 });

  const dialog = page.getByRole("dialog", { name: "Add feeds" });
  const report = (await dialog.textContent()) ?? "";
  const added = Number(report.match(/(\d+)\s*feeds added/)?.[1]);
  const failed = Number(report.match(/(\d+)\s*failed/)?.[1]);
  // Live-network test: allow a few transient upstream failures, but the
  // deliberately dead feed must be reported and every entry accounted for.
  expect(added).toBeGreaterThanOrEqual(12);
  expect(failed).toBeGreaterThanOrEqual(1);
  expect(added + failed).toBe(20);

  await dialog.getByRole("button", { name: "Done", exact: true }).click();

  // Categories from the OPML folder structure exist in the sidebar
  const sidebar = page.locator("aside").first();
  for (const category of ["Frontend", "Design", "Backend & DevOps", "General Tech", "AI & ML"]) {
    await expect(sidebar.getByText(category, { exact: true })).toBeVisible();
  }
});

test("OPML export downloads a valid file preserving categories", async ({ page }) => {
  await page.goto("/reader?guest=1");
  await expect(page.getByText("All items").first()).toBeVisible();
  await page.getByRole("button", { name: "Manage feeds" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export OPML" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("frontpage-subscriptions.opml");

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const xml = Buffer.concat(chunks).toString("utf8");
  expect(xml).toContain('<opml version="2.0">');
  expect(xml).toContain('text="Frontend"');
  expect(xml).toContain('xmlUrl="https://css-tricks.com/feed/"');
});

test("invalid OPML file is reported clearly", async ({ page }) => {
  await page.goto("/reader");
  await page.getByRole("button", { name: "Import OPML" }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: "broken.opml",
    mimeType: "text/xml",
    buffer: Buffer.from("<<< not xml at all"),
  });
  await expect(page.getByText(/not valid OPML/i)).toBeVisible();
});
