import { expect, test } from "@playwright/test";

// Calls the real model via OpenRouter: slow, non-deterministic and paid, so it stays out
// of the QA script and CI. Run with `npm run test:chat`.
const hasKey = /^sk-or-v1-.{20,}/.test(process.env.OPENROUTER_API_KEY ?? "");

test("Lissie answers in character and the conversation survives a reload", async ({
  page,
}) => {
  test.skip(!hasKey, "OPENROUTER_API_KEY is not set in .env");
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Chat Human");
  await page.getByLabel("Email").fill(`llm-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page
    .getByTestId("copilot-chat-textarea")
    .fill("Good morning, Lissie. What's the capital of France?");
  await page.getByTestId("copilot-send-button").click();
  const reply = page.getByTestId("copilot-assistant-message").last();
  await expect(reply).not.toBeEmpty({ timeout: 60_000 });

  // Reload only after the run has finished, as a person would.
  await expect(page.getByTestId("copilot-loading-cursor")).toHaveCount(0, {
    timeout: 60_000,
  });
  await page.reload();
  await expect(page.getByTestId("copilot-user-message").first()).toContainText(
    "capital of France",
  );
  await expect(
    page.getByTestId("copilot-assistant-message").first(),
  ).not.toBeEmpty();
});
