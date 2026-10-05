import { expect, test } from "vitest";
import { safeNext } from "./safe-next";

test("keeps local paths and rejects everything that could leave the site", () => {
  expect(safeNext("/device?user_code=ABCD1234")).toBe(
    "/device?user_code=ABCD1234",
  );
  for (const bad of [
    undefined,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "device",
  ]) {
    expect(safeNext(bad)).toBe("/");
  }
  expect(safeNext(["/device", "/other"])).toBe("/device");
});
