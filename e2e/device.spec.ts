import { expect, test } from "@playwright/test";
import { CLI_CLIENT_ID } from "@todo-cat/contract";

// The human half of `todo-cat login`: the CLI asks for a code, the user approves it on
// /device after signing in, and the CLI's next poll gets a session token.
test("a signed-out user signs up via /device and approves the CLI's code", async ({
  page,
  request,
}) => {
  const start = await request.post("/api/auth/device/code", {
    data: { client_id: CLI_CLIENT_ID },
  });
  expect(start.ok()).toBe(true);
  const { device_code, user_code, verification_uri_complete } =
    await start.json();

  // Signed out: /device sends us to /login and keeps the code for the way back.
  await page.goto(verification_uri_complete);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/signup\?next=/);

  await page.getByLabel("Name").fill("Device Human");
  await page.getByLabel("Email").fill(`device-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/device\?user_code=/);
  await expect(page.getByLabel("Code from your terminal")).toHaveValue(
    user_code,
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByText("The todo-cat CLI wants to read and change your todos"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved.")).toBeVisible();

  const poll = await request.post("/api/auth/device/token", {
    data: {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code,
      client_id: CLI_CLIENT_ID,
    },
  });
  expect(poll.ok()).toBe(true);
  expect((await poll.json()).access_token).toBeTruthy();
});

test("an unknown client id can't start a device login", async ({ request }) => {
  const start = await request.post("/api/auth/device/code", {
    data: { client_id: "some-other-app" },
  });
  expect(start.ok()).toBe(false);
});
