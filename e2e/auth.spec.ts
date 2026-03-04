import { test, expect } from "@playwright/test";

test.describe("Auth — Register & Login", () => {
  test("user can register a new account", async ({ page }) => {
    await page.goto("/register");
    await page.fill("[name=email]", `e2e-${Date.now()}@elove.me`);
    await page.fill("[name=password]", "SecurePass123!");
    await page.fill("[name=tenantSlug]", `tenant-${Date.now()}`);
    await page.click("[type=submit]");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test("user can login with email and password", async ({ page }) => {
    await page.goto("/login");
    await page.fill("[name=email]", "demo@elove.me");
    await page.fill("[name=password]", "DemoPass123!");
    await page.click("[type=submit]");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test("login shows error for wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.fill("[name=email]", "demo@elove.me");
    await page.fill("[name=password]", "WrongPassword");
    await page.click("[type=submit]");
    await expect(page.locator(".error-message, [role=alert]")).toBeVisible({ timeout: 5_000 });
  });
});
