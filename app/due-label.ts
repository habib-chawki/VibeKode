// A due date as people say it: "Due today", "Due Thu 8 Oct", "Overdue by 2 days".
// Dates are calendar days (yyyy-mm-dd) compared in UTC, so no time zone shifts a day.

const DAY_MS = 86_400_000;

const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

const weekdayDayMonth = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export type DueLabel = {
  text: string;
  tone: "overdue" | "today" | "later";
};

export function dueLabel(dueDate: string, today: string): DueLabel {
  const days = Math.round((toUtc(dueDate) - toUtc(today)) / DAY_MS);
  if (days < 0) {
    const late = -days;
    return {
      text: `Overdue by ${late === 1 ? "a day" : `${late} days`}`,
      tone: "overdue",
    };
  }
  if (days === 0) return { text: "Due today", tone: "today" };
  if (days === 1) return { text: "Due tomorrow", tone: "later" };
  const sameYear = dueDate.slice(0, 4) === today.slice(0, 4);
  const date = new Date(toUtc(dueDate));
  return {
    text: `Due ${sameYear ? weekdayDayMonth.format(date) : dayMonthYear.format(date)}`.replace(
      ",",
      "",
    ),
    tone: "later",
  };
}
