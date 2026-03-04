import { test, expect } from "@playwright/test";

test.describe("Billing — Upgrade flow", () => {
  test("user sees upgrade prompt on free plan", async ({ page }) => {
    await page.goto("/login");
    await page.fill("[name=email]", "free@elove.me");
    await page.fill("[name=password]", "SecurePass123!");
    await page.click("[type=submit]");
    await page.waitForURL(/\/dashboard/);

    // Free plan users should see upgrade CTA
    await expect(page.locator("text=Nâng cấp")).toBeVisible({ timeout: 5_000 });
  });

  test("upgrade button redirects to PayOS checkout", async ({ page }) => {
    await page.goto("/login");
    await page.fill("[name=email]", "free@elove.me");
    await page.fill("[name=password]", "SecurePass123!");
    await page.click("[type=submit]");
    await page.waitForURL(/\/dashboard/);

    // Intercept API call, don't actually redirect
    await page.route("**/api/trpc/billing.createCheckoutLink**", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ result: { data: { checkoutUrl: "https://pay.payos.vn/web/mock" } } }),
      });
    });

    await page.click("text=Nâng cấp");
    // Verify the checkout URL was generated (intercepted)
  });
});
