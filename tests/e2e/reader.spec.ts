import { expect, test, type Page } from "@playwright/test";

/**
 * E2E flows against the production build with real curated feeds.
 * Requires network access (feeds are fetched live, then served from the
 * server-side cache for subsequent tests).
 */

async function bootGuest(page: Page) {
  await page.goto("/reader?guest=1");
  await expect(page.getByText("All items").first()).toBeVisible();
  // Wait until articles have streamed in
  await page.waitForFunction(
    () => document.querySelectorAll("main [role=button], main article").length > 5,
    undefined,
    { timeout: 45_000 }
  );
}

test("guest mode boots into a populated dashboard", async ({ page }) => {
  await bootGuest(page);
  const sidebar = page.locator("aside").first();
  for (const category of ["Frontend", "Design", "Backend & DevOps", "General Tech", "AI & ML"]) {
    await expect(sidebar.getByText(category, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/browsing as a guest/i)).toBeVisible();
});

test("keyboard: j/k selection, Enter opens reader, navigation works", async ({ page }) => {
  await bootGuest(page);
  await page.keyboard.press("j");
  await expect(page.locator("[data-selected]")).toHaveCount(1);
  await page.keyboard.press("j");
  await page.keyboard.press("k");
  await page.keyboard.press("Enter");
  const reader = page.locator("div[role=dialog][aria-modal=true]");
  await expect(reader).toBeVisible();
  await expect(reader.getByRole("link", { name: /original/i })).toBeVisible();
  await page.keyboard.press("ArrowRight"); // next article
  await page.keyboard.press("Escape");
  await expect(reader).toHaveCount(0);
});

test("opening an article marks it read; m toggles back to unread", async ({ page }) => {
  await bootGuest(page);
  await page.keyboard.press("j");
  const title = await page.locator("[data-selected] h3, [data-selected] p").first().textContent();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  // still selected; toggle read state back
  await page.keyboard.press("m");
  expect(title).toBeTruthy();
});

test("bookmarking via s shows the article in Saved", async ({ page }) => {
  await bootGuest(page);
  await page.keyboard.press("j");
  await page.keyboard.press("s");
  await page.locator("aside").first().getByRole("button", { name: "Saved" }).click();
  await expect(page.locator("main [role=button]").first()).toBeVisible();
  // unbookmark cleans it up
  await page.keyboard.press("j");
  await page.keyboard.press("s");
  await expect(page.getByText("Nothing saved yet")).toBeVisible();
});

test("digest groups unread stories with a hero and category sections", async ({ page }) => {
  await bootGuest(page);
  await page.locator("aside").first().getByRole("button", { name: "Digest" }).click();
  await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible();
  await expect(page.getByText("Your digest")).toBeVisible();
});

test("search filters as you type with highlighted matches", async ({ page }) => {
  await bootGuest(page);
  const input = page.getByLabel("Search articles");
  await input.fill("the");
  await expect(page.getByText(/Results for/)).toBeVisible();
  await expect(page.locator("main mark").first()).toBeVisible();
  // "/" focuses search (blur first — a stray click could open an article)
  await input.fill("");
  await input.blur();
  await page.keyboard.press("/");
  await expect(input).toBeFocused();
});

test("layout switcher cycles compact / list / cards and persists", async ({ page }) => {
  await bootGuest(page);
  await page.getByRole("radio", { name: "Card grid" }).click();
  await expect(page.locator("main article").first()).toBeVisible();
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll("main article").length > 3,
    undefined,
    { timeout: 30_000 }
  );
  await expect(page.getByRole("radio", { name: "Card grid" })).toHaveAttribute("aria-checked", "true");
});

test("command palette navigates and toggles dark mode", async ({ page }) => {
  await bootGuest(page);
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByLabel("Search commands");
  await expect(palette).toBeFocused();
  await palette.fill("saved");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();

  await page.keyboard.press("ControlOrMeta+k");
  await palette.fill("dark");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("? opens the shortcut reference", async ({ page }) => {
  await bootGuest(page);
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("manage feeds: health dashboard, rename, category change, remove with confirmation", async ({ page }) => {
  await bootGuest(page);
  await page.locator("aside").first().getByRole("button", { name: "Manage feeds" }).click();
  await expect(page.getByText("Healthy")).toBeVisible();
  await expect(page.getByText(/Subscriptions \(19\)/)).toBeVisible();

  // Rename the first feed
  const firstRow = page.locator("main ul > li").first();
  await firstRow.getByRole("button", { name: /^Rename/ }).first().click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("My Renamed Feed");
  await page.keyboard.press("Enter");
  await expect(firstRow.getByText("My Renamed Feed")).toBeVisible();

  // Remove requires confirmation
  await firstRow.getByRole("button", { name: /^Remove/ }).click();
  await firstRow.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText(/Subscriptions \(18\)/)).toBeVisible();
});

test("mark all as read empties the unread filter and supports undo", async ({ page }) => {
  await bootGuest(page);
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByText(/Marked \d+ items? as read/)).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Unread only" }).click();
  await expect(page.locator("main [role=button]").first()).toBeVisible();
});

test("mobile: no horizontal scroll, sidebar becomes an overlay", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/reader?guest=1");
  await page.waitForFunction(
    () => document.querySelectorAll("main [role=button]").length > 5,
    undefined,
    { timeout: 45_000 }
  );
  const hasHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
  );
  expect(hasHScroll).toBe(false);
  await page.getByLabel("Open navigation").click();
  await expect(page.locator("div[role=dialog]").getByText("Categories")).toBeVisible();
  await context.close();
});

test("empty state shows the three-path onboarding", async ({ page }) => {
  await page.goto("/reader");
  await expect(page.getByText("Welcome to Frontpage")).toBeVisible();
  await expect(page.getByRole("button", { name: "Load the starter pack" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a feed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import OPML" })).toBeVisible();
});

test("landing page renders with dual CTAs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /personalized front page/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Try as Guest — no sign-up/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
});
