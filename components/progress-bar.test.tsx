import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ProgressBar } from "./progress-bar";

const fill = (bar: HTMLElement) =>
  (bar.firstElementChild as HTMLElement).style.width;

test("ProgressBar exposes value out of max and fills to match", () => {
  render(<ProgressBar value={3} max={12} label="Todos done" />);
  const bar = screen.getByRole("progressbar", { name: "Todos done" });
  expect(bar.getAttribute("aria-valuemin")).toBe("0");
  expect(bar.getAttribute("aria-valuemax")).toBe("12");
  expect(bar.getAttribute("aria-valuenow")).toBe("3");
  expect(bar.getAttribute("aria-valuetext")).toBe("3 of 12");
  expect(fill(bar)).toBe("25%");
});

test("ProgressBar stays empty for an empty list and never overflows", () => {
  const { rerender } = render(<ProgressBar value={0} max={0} label="Done" />);
  const bar = screen.getByRole("progressbar");
  expect(fill(bar)).toBe("0%");
  expect(bar.getAttribute("aria-valuenow")).toBe("0");

  rerender(<ProgressBar value={5} max={4} label="Done" />);
  expect(fill(bar)).toBe("100%");
  expect(bar.getAttribute("aria-valuenow")).toBe("4");

  rerender(<ProgressBar value={Number.NaN} max={4} label="Done" />);
  expect(fill(bar)).toBe("0%");
});
