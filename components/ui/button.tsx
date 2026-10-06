import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet";
  /** md for forms and pages, sm inside the list and the header. */
  size?: "md" | "sm";
};

// Colors transition, the focus outline doesn't: it appears at once, in her eye color.
const base =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium transition-[background-color,border-color,color] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-eye-line disabled:cursor-not-allowed disabled:opacity-60";

const variants = {
  primary: "bg-ink text-paper hover:bg-fur",
  quiet: "border border-fur/40 text-ink hover:border-ink hover:bg-surface",
};

const sizes = {
  md: "h-11 px-4 text-base",
  sm: "h-9 px-3 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
