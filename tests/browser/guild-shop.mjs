import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { builtinShopItems } from "../../shared/equipment-shop.ts";
import { fight, student } from "../phase4/fixtures.ts";

const origin = process.env.UI_ORIGIN || "http://127.0.0.1:4173";
const output = "artifacts/combat-ui";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const guild = { id: "00000000-0000-4000-8000-000000000008", teacherId: fight.teacherId,
  name: "Guild shop review", code: "SHOP01", unlockedTier: 1, limitTier: 1, experience: 0, isArchived: false };
const errors = [];
try {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", error => errors.push(error.message));
    let savedStudent = { ...student(), guildId: guild.id, gold: 500, inventory: [] };
    const purchases = [];
    await page.addInitScript(({ teacherId, studentId }) => {
      localStorage.setItem("teacherId", teacherId);
      localStorage.setItem("studentId", studentId);
    }, { teacherId: fight.teacherId, studentId: savedStudent.id });
    await page.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      let json = [];
      if (path === `/api/guilds/${guild.id}`) json = guild;
      else if (path === "/api/equipment-items/shop") json = builtinShopItems();
      else if (path === `/api/student/${savedStudent.id}` || path.endsWith("/check-session")) json = savedStudent;
      else if (path.endsWith("/job-levels")) json = [{ jobClass: "warrior", level: 2 }];
      else if (path.endsWith("/purchase-item")) {
        purchases.push(route.request().postDataJSON());
        savedStudent = { ...savedStudent, gold: 350, inventory: ["t1_fighter_armor"] };
        json = savedStudent;
      }
      return route.fulfill({ json });
    });
    await page.goto(`${origin}/teacher/guild/${guild.id}`);
    await page.getByRole("tab", { name: "Shop", exact: true }).click();
    const selectTier = value => page.getByLabel("Browse shop tier").evaluate((input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    await page.getByText("Fighter's Cuirass", { exact: true }).waitFor();
    assert.equal(await page.getByText("Default equipment", { exact: true }).count(), 37);
    assert.equal(await page.getByRole("button", { name: "Edit item" }).count(), 0);
    await selectTier("2");
    await page.getByText("No items defined at tier 2 yet.", { exact: false }).waitFor();
    assert.ok((await page.getByRole("link").filter({ hasText: "Create item" }).getAttribute("href")).includes("tier=2"));
    await selectTier("1");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${output}/${viewport.width}-teacher-guild-shop.png` });

    await page.goto(`${origin}/student/shop`);
    await page.getByTestId("card-item-t1_fighter_armor").waitFor();
    assert.equal(await page.locator('[data-testid^="card-item-"]').count(), 37);
    await page.getByTestId("tab-armor").click();
    assert.equal(await page.locator('[data-testid^="card-item-"]').count(), 4);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${output}/${viewport.width}-student-guild-shop.png` });
    await page.getByTestId("button-purchase-t1_fighter_armor").click();
    await page.getByText("Purchase Successful!", { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('[data-testid="text-gold-balance"]')?.textContent === "350");
    assert.equal(purchases.length, 1);
    assert.equal(purchases[0].itemId, "t1_fighter_armor");
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log("Guild shops: default catalog, tier browsing, armor filters and purchase UI pass at Chromebook and phone sizes.");
} finally {
  await browser.close();
}
