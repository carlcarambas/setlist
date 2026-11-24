import { expect, test, type Page } from "@playwright/test";
import { adminClient, readState } from "./fixtures";

/**
 * Offline is view-only (spec 2.1 §4.5): with the browser genuinely offline, plans, songs, events and
 * saved sheets open, and every change says it needs a connection. Back online, changes made
 * elsewhere arrive.
 */

async function waitForOfflineReady(page: Page) {
  // The service worker controls the page and has cached every app page.
  await page.waitForFunction(async () => {
    if (!navigator.serviceWorker.controller) return false;
    const name = (await caches.keys()).find((n) => n.startsWith("setlist-shell-"));
    return name ? (await (await caches.open(name)).keys()).length >= 10 : false;
  }, undefined, { timeout: 30_000 });
}

test("a kept plan and its sheets work offline; changes need a connection", async ({ page, context }) => {
  const state = readState();

  // First visit: the welcome step, then the plan (synced to the device).
  await page.goto(`/plan?id=${state.planId}`);
  await expect(page.getByRole("heading", { name: state.planTitle })).toBeVisible({ timeout: 45_000 });

  await page.getByRole("button", { name: /^Keep offline/ }).click();
  await expect(page.getByText("Available offline on this device")).toBeVisible();
  await waitForOfflineReady(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: state.planTitle })).toBeVisible();
  await expect(page.getByText(/Offline: showing what's on this device/)).toBeVisible();
  await expect(page.getByText("Editing needs a connection")).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

  for (const song of state.songs) {
    await page.getByRole("button", { name: new RegExp(`^Open sheet: ${song}`) }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Close sheet" }).click();
  }

  // Other pages open from the device, including ones never visited.
  await page.goto(`/library?q=${encodeURIComponent(state.tag)}`);
  await expect(page.getByText(`${state.songs.length} songs`)).toBeVisible();
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "Events", exact: true })).toBeVisible();
  await expect(page.getByText("Needs a connection").first()).toBeVisible();

  // Online-only pages explain themselves.
  await page.goto(`/plans/${state.planId}/edit`);
  await expect(page.getByRole("heading", { name: "This page needs a connection" })).toBeVisible();

  // Back online: a change made elsewhere reaches the device.
  await context.setOffline(false);
  const renamed = `${state.planTitle} (renamed)`;
  const { error } = await adminClient().from("plans").update({ title: renamed }).eq("id", state.planId);
  expect(error).toBeNull();
  await page.goto(`/plan?id=${state.planId}`);
  await expect(page.getByRole("heading", { name: renamed })).toBeVisible({ timeout: 20_000 });
  await adminClient().from("plans").update({ title: state.planTitle }).eq("id", state.planId);
});
