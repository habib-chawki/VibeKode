/**
 * How full the bar is, in whole percent. Only an empty count is 0 and only a complete
 * one is 100: rounding alone would draw 199 of 200 as full and 1 of 201 as empty.
 */
export function progressPercent(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(max) || !(value > 0)) return 0;
  if (value >= max) return 100;
  return Math.min(99, Math.max(1, Math.round((value / max) * 100)));
}

// How far along something is: an ink fill on a fur-grey track. Not amber: Lissie's eyes
// are kept for focus and checked boxes (tech-docs/ui.md).
export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 0;
  const safeValue = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), safeMax)
    : 0;
  const percent = progressPercent(safeValue, safeMax);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      aria-valuetext={`${safeValue} of ${safeMax}`}
      className="h-2.5 w-full overflow-hidden rounded-full bg-fur/20"
    >
      <div
        className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
