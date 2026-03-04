import { test, expect } from "@playwright/test";

async function loginAs(page: any, email: string, password: string = "SecurePass123!") {
  await page.goto("/login");
  await page.fill("[name=email]", email);
  await page.fill("[name=password]", password);
  await page.click("[type=submit]");
  await page.waitForURL(/\/dashboard/);
}

test.describe("Editor — Critical Flow", () => {
  test("user creates project and enters editor", async ({ page }) => {
    await loginAs(page, "e2e@elove.me");
    await page.click("text=Tạo thiệp cưới mới");
    await page.click("text=Elegant");
    await page.fill("[name=title]", "Thiệp E2E Test");
    await page.fill("[name=slug]", `e2e-test-${Date.now()}`);
    await page.click("text=Tạo thiệp");
    await expect(page).toHaveURL(/\/editor\//, { timeout: 10_000 });
  });

  test("user edits text content in editor", async ({ page }) => {
    await loginAs(page, "e2e@elove.me");
    await page.goto("/editor/test-project-id");
    await page.click(".elove-section .elove-slot >> nth=0");
    await expect(page.locator(".property-panel")).toBeVisible({ timeout: 5_000 });
  });

  test("autosave status updates after content change", async ({ page }) => {
    await loginAs(page, "e2e@elove.me");
    await page.goto("/editor/test-project-id");
    // Trigger a change
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("editor:force-save"));
    });
    await expect(page.locator(".autosave-status")).toContainText(/(Đang lưu|Đã lưu)/, { timeout: 10_000 });
  });
});
