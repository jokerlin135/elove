import { test, expect } from "@playwright/test";

test.describe("Publish — Site goes live", () => {
  test("user can trigger publish and see build status", async ({ page }) => {
    await page.goto("/login");
    await page.fill("[name=email]", "publisher@elove.me");
    await page.fill("[name=password]", "SecurePass123!");
    await page.click("[type=submit]");
    await page.waitForURL(/\/dashboard/);

    await page.goto("/editor/test-project-id");
    await page.click("button:has-text('Xuất bản')");
    await expect(page.locator(".publish-status")).toContainText(/(Đang xây dựng|Đã phát hành)/, { timeout: 15_000 });
  });
});
