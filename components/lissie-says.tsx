import type { ReactNode } from "react";

// Lissie's one remark per page: the only loud element; everything else stays quiet.
export function LissieSays({
  remark,
  children,
}: {
  remark: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-6 py-16 md:flex-row md:items-center md:gap-16">
      <div className="md:flex-1">
        <p className="text-sm text-fur">Lissie keeps this list.</p>
        <h1 className="mt-3 max-w-[14ch] font-display text-5xl leading-[1.05] font-bold tracking-tight text-ink md:text-6xl">
          {remark}
        </h1>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
