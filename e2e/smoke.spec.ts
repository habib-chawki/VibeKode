import { expect, test } from "@playwright/test";

test("home page loads in the browser", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /to get started/i }),
  ).toBeVisible();
});
