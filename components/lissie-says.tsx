import type { ReactNode } from "react";
import { Wordmark } from "./wordmark";

// Lissie's one remark per page: the only loud element; everything else stays quiet.
export function LissieSays({
  remark,
  children,
}: {
  remark: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-5xl px-6 pt-6 md:pt-8">
        <Wordmark />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-6 pt-10 pb-16 md:flex-row md:items-center md:gap-16 md:py-16">
        <h1 className="max-w-[14ch] text-balance font-display text-5xl leading-[1.05] font-bold tracking-tight text-ink md:flex-1 md:text-6xl">
          {remark}
        </h1>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
