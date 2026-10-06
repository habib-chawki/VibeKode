import { expect, test } from "@playwright/test";

// Calls the real model (`npm run test:chat`): Lissie's addTodo tool, end to end.
const hasKey = /^sk-or-v1-.{20,}/.test(process.env.OPENROUTER_API_KEY ?? "");

test("asking Lissie to add buy milk puts it in the sidebar", async ({
  page,
}) => {
  test.skip(!hasKey, "OPENROUTER_API_KEY is not set in .env");
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Milk Human");
  await page.getByLabel("Email").fill(`milk-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page
    .getByTestId("copilot-chat-textarea")
    .fill('Please add "buy milk" to my list.');
  await page.getByTestId("copilot-send-button").click();
  await expect(page.getByTestId("lissie-tool-call").first()).toContainText(
    /Added "buy milk"/i,
    {
      timeout: 90_000,
    },
  );
  await expect(page.getByTestId("todo-sidebar")).toContainText(/buy milk/i);
});
