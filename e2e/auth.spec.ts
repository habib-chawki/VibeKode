import { expect, test } from "@playwright/test";

test("sign up, sign out, and sign in again", async ({ page }) => {
  const email = `human-${Date.now()}@example.com`;
  const password = "correct horse battery";

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Lissie's Human");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Hello, Lissie's Human.",
  );

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Signed out means the server sends / back to the sign-in page.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong password!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "That email and password don't match. Try again.",
  );

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
});
