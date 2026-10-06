import { expect, test } from "vitest";
import { dueLabel } from "./due-label";

const today = "2026-10-06"; // a Tuesday

test("past dates are overdue, counted in days", () => {
  expect(dueLabel("2026-10-05", today)).toEqual({
    text: "Overdue by a day",
    tone: "overdue",
  });
  expect(dueLabel("2026-10-04", today).text).toBe("Overdue by 2 days");
  expect(dueLabel("2025-10-06", today).text).toBe("Overdue by 365 days");
});

test("today and tomorrow are said in words", () => {
  expect(dueLabel("2026-10-06", today)).toEqual({
    text: "Due today",
    tone: "today",
  });
  expect(dueLabel("2026-10-07", today)).toEqual({
    text: "Due tomorrow",
    tone: "later",
  });
});

test("later dates show the weekday, and the year only when it differs", () => {
  expect(dueLabel("2026-10-09", today).text).toBe("Due Fri 9 Oct");
  expect(dueLabel("2026-12-31", today).text).toBe("Due Thu 31 Dec");
  expect(dueLabel("2027-01-04", today).text).toBe("Due 4 Jan 2027");
});

test("a daylight-saving change doesn't shift the count", () => {
  expect(dueLabel("2026-10-26", "2026-10-24").text).toBe("Due Mon 26 Oct");
  expect(dueLabel("2026-03-28", "2026-03-30").text).toBe("Overdue by 2 days");
});
