import Link from "next/link";
import type { ComponentProps } from "react";

export function TextLink({
  className = "",
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`font-medium text-ink underline decoration-eye decoration-2 underline-offset-4 hover:decoration-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-eye ${className}`}
      {...props}
    />
  );
}
