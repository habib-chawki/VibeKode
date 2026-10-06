import { expect, test } from "@playwright/test";

// Lissie's chat without calling the model (that's e2e-llm/, `npm run test:chat`):
// the page renders it, and the runtime answers through the real Next.js server.
test("the chat loads for a signed-in user and the runtime guards its routes", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Chat Human");
  await page.getByLabel("Email").fill(`chat-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("copilot-chat-textarea")).toBeVisible();

  // Through Next's real request objects (unit tests can't reproduce those).
  const info = await page.request.get("/api/copilotkit/info");
  expect(info.status()).toBe(200);
  expect(Object.keys((await info.json()).agents)).toEqual(["lissie"]);
  expect((await page.request.get("/api/copilotkit/threads")).status()).toBe(
    404,
  );

  // The read-only sidebar shows the user's list (written here through the REST API).
  await expect(page.getByTestId("todo-sidebar")).toContainText("Nothing open");
  await page.request.post("/api/todos", { data: { title: "Brush Lissie" } });
  await page.reload();
  await expect(page.getByTestId("todo-sidebar")).toContainText("Brush Lissie");
});

test("the runtime rejects requests without a session", async ({ request }) => {
  expect((await request.get("/api/copilotkit/info")).status()).toBe(401);
});
