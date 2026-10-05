import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet";
};

const base =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 py-2.5 text-base font-medium transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-eye disabled:cursor-not-allowed disabled:opacity-60";

const variants = {
  primary: "bg-ink text-paper hover:bg-fur",
  quiet: "border border-fur/40 text-ink hover:border-ink hover:bg-surface",
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
