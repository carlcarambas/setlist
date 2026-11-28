import { expect, test } from "@playwright/test";
import { readState } from "./fixtures";

/** Reading a plan's sheets: songs come first, the screen stays on, Back closes, zoom and full view. */
test("the sheet viewer stays awake, zooms, hides its bar and closes with Back", async ({ page }) => {
  const state = readState();
  // Record wake lock use; headless browsers don't have a real screen to keep on.
  await page.addInitScript(() => {
    const log = { requested: 0, released: 0 };
    Object.assign(window, { __wake: log });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          log.requested += 1;
          return { released: false, release: async () => void (log.released += 1) };
        },
      },
    });
  });
  const wake = () => page.evaluate(() => (window as unknown as { __wake: { requested: number; released: number } }).__wake);

  await page.goto("/plans");
  await expect(page.getByRole("link", { name: state.planTitle })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("link", { name: state.planTitle }).click();

  // Both songs are on screen without scrolling.
  const open = (song: string) => page.getByRole("button", { name: new RegExp(`^Open sheet: ${song}`) });
  for (const song of state.songs) await expect(open(song)).toBeInViewport();

  await open(state.songs[0]).click();
  const dialog = page.getByRole("dialog");
  const sheet = dialog.locator("canvas").first();
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  expect((await wake()).requested).toBe(1);

  // The page uses the full width of a phone.
  const viewport = page.viewportSize()!;
  const fit = (await sheet.boundingBox())!.width;
  if (viewport.width < 768) expect(fit).toBeGreaterThanOrEqual(viewport.width - 2);

  await dialog.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(async () => (await sheet.boundingBox())!.width).toBeGreaterThan(fit * 1.4);
  await dialog.getByRole("button", { name: "Zoom in" }).click();
  await dialog.getByRole("button", { name: "Fit width" }).click();
  await expect.poll(async () => Math.round((await sheet.boundingBox())!.width)).toBe(Math.round(fit));

  // A tap hides the bar; the button brings it back.
  await sheet.click({ position: { x: 100, y: 100 } });
  await expect(dialog.getByRole("button", { name: "Close sheet" })).toBeHidden();
  await dialog.getByRole("button", { name: "Show controls" }).click();
  await expect(dialog.getByRole("button", { name: "Close sheet" })).toBeVisible();

  // Next song keeps the chosen size; then one Back closes the sheet and stays on the plan.
  await dialog.getByRole("button", { name: "Zoom in" }).click();
  await dialog.getByRole("button", { name: "Next song" }).click();
  await expect(dialog.getByRole("heading", { name: new RegExp(state.songs[1]) })).toBeVisible();
  await expect.poll(async () => (await sheet.boundingBox())?.width ?? 0).toBeGreaterThan(fit * 1.4);
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: state.planTitle })).toBeVisible();
  await expect.poll(async () => (await wake()).released).toBe(1);

  // Close button and Escape also close, without leaving the plan.
  await open(state.songs[0]).click();
  await page.getByRole("button", { name: "Close sheet" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await open(state.songs[0]).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/plan\\?id=${state.planId}$`));
  await page.goBack();
  await expect(page).toHaveURL(/\/plans$/);

  // A link straight to a sheet opens it; closing stays on the plan.
  await page.goto(`/plan?id=${state.planId}`);
  await open(state.songs[1]).click();
  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close sheet" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: state.planTitle })).toBeVisible();

  // Occasional actions are in the More menu; administrators-only Delete isn't offered to members.
  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("menuitem", { name: "Duplicate" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Archive" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(page.getByText("This plan is read-only")).toBeVisible();
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Restore" }).click();
  await expect(page.getByText("This plan is read-only")).toHaveCount(0);
});
