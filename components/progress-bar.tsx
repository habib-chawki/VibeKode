// How far along something is: Lissie's gold eye filling a fur-grey track.
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
  const percent = safeMax === 0 ? 0 : Math.round((safeValue / safeMax) * 100);
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
        className="h-full rounded-full bg-eye transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
