import { expect, test } from "@playwright/test";

// The list next to the chat: add (with a due date), check off, reopen, delete.
test("add, check off, reopen and delete a todo", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("List Human");
  await page.getByLabel("Email").fill(`list-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);

  const list = page.getByTestId("todo-list");
  await list.getByLabel("New todo").fill("Brush Lissie");
  await list.getByLabel("Due date (optional)").fill("2026-12-24");
  await list.getByRole("button", { name: "Add" }).click();
  const item = list
    .getByTestId("todo-item")
    .filter({ hasText: "Brush Lissie" });
  await expect(item).toContainText("Due 2026-12-24");
  await expect(list).toContainText("Open (1)");

  await item
    .getByRole("checkbox", { name: 'Check off "Brush Lissie"' })
    .click();
  await expect(
    item.getByRole("checkbox", { name: 'Reopen "Brush Lissie"' }),
  ).toBeChecked();
  await expect(list).toContainText("Done (1)");
  await expect(list).toContainText("Open (0)");

  await item.getByRole("checkbox", { name: 'Reopen "Brush Lissie"' }).click();
  await expect(
    item.getByRole("checkbox", { name: 'Check off "Brush Lissie"' }),
  ).not.toBeChecked();
  await expect(list).toContainText("Open (1)");

  // Delete asks first; "Keep" backs out.
  await item.getByRole("button", { name: 'Delete "Brush Lissie"' }).click();
  await item.getByRole("button", { name: "Keep" }).click();
  await expect(item).toBeVisible();

  await item.getByRole("button", { name: 'Delete "Brush Lissie"' }).click();
  await item.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(item).toHaveCount(0);
  await page.reload();
  await expect(list).toContainText("Nothing open");
});
