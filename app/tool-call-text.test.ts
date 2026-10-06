import { expect, test } from "vitest";
import { describeToolCall } from "./tool-call-text";

// A failed tool call must never read as success.

const line = (name: string, result: unknown) =>
  describeToolCall(name, {}, true, JSON.stringify(result));

test("showProgress reads as counted when it worked", () => {
  expect(line("showProgress", { total: 2, done: 1, open: 1 })).toBe(
    "Counted your list",
  );
  expect(describeToolCall("showProgress", {}, false, undefined)).toBe(
    "Counting your list…",
  );
});

test("showProgress reads as failed when it returned an error", () => {
  expect(
    line("showProgress", {
      error: { code: "todo-not-found", message: "Todo not found." },
    }),
  ).toBe("✗ Couldn't count your list");
});
