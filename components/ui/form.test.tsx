import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { FormError } from "./form-error";
import { TextField } from "./text-field";

test("TextField ties its label and hint to the input", () => {
  render(<TextField label="Password" hint="At least 8 characters." />);
  const input = screen.getByLabelText("Password");
  expect(input.getAttribute("aria-describedby")).toBe(
    screen.getByText("At least 8 characters.").id,
  );
});

test("FormError announces a message and renders nothing without one", () => {
  const { rerender } = render(<FormError message={null} />);
  expect(screen.queryByRole("alert")).toBeNull();
  rerender(<FormError message="That email and password don't match." />);
  expect(screen.getByRole("alert").textContent).toBe(
    "That email and password don't match.",
  );
});
