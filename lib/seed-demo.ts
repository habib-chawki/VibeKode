import "server-only";
import { auth } from "./auth";
import { addTodo, deleteTodo, listTodos, updateTodo } from "./todo-service";

// The dev seed behind `npm run db:seed`. Everything goes through Better Auth and the
// todo service, so the seed obeys the same rules as the app. Rerunning it resets the
// demo user's list to the same todos, relative to `now`.

export const DEMO_USER = {
  name: "Demo Human",
  email: "demo@todo-cat.dev",
  password: "cat-person-2026",
};

type SeedTodo = {
  title: string;
  /** Created this many days before now. */
  createdDaysAgo: number;
  /** Due this many days from today (negative: in the past). */
  dueInDays?: number;
  /** Marked done this many days before now. */
  doneDaysAgo?: number;
};

const SEED_TODOS: SeedTodo[] = [
  {
    title: "Book Lissie's yearly checkup at the vet",
    createdDaysAgo: 14,
    dueInDays: 3,
  },
  {
    title: "Buy the salmon kibble, not the chicken one",
    createdDaysAgo: 13,
    doneDaysAgo: 12,
  },
  { title: "Replace the scratching post she shredded", createdDaysAgo: 12 },
  { title: "Clean the litter box", createdDaysAgo: 10, dueInDays: 0 },
  {
    title: "Order a new water fountain filter",
    createdDaysAgo: 9,
    dueInDays: -2,
  },
  {
    title: "Move the plants out of paw's reach",
    createdDaysAgo: 8,
    doneDaysAgo: 7,
  },
  {
    title: "Call the neighbors about Sindi's barking",
    createdDaysAgo: 7,
    dueInDays: 1,
  },
  { title: "Vacuum cat hair off the sofa", createdDaysAgo: 6, doneDaysAgo: 4 },
  { title: "Renew the pet insurance", createdDaysAgo: 5, dueInDays: 10 },
  { title: "Find out why she sits in the sink", createdDaysAgo: 4 },
  { title: "Restock the treat drawer", createdDaysAgo: 2, doneDaysAgo: 1 },
  {
    title: "Buy a cardboard box for her to ignore",
    createdDaysAgo: 1,
    dueInDays: 5,
  },
];

const DAY = 24 * 60 * 60 * 1000;

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY);
}

/** Local calendar date as yyyy-mm-dd: due dates are days, not instants. */
function localDate(now: Date, offsetDays: number): string {
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offsetDays,
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function demoUserId(): Promise<string> {
  const { email, password } = DEMO_USER;
  try {
    return (await auth.api.signInEmail({ body: { email, password } })).user.id;
  } catch {
    // Not there yet (or the database was reset): create it. If the email exists with a
    // different password, sign-up fails loudly instead of silently changing it.
    return (await auth.api.signUpEmail({ body: DEMO_USER })).user.id;
  }
}

export async function seedDemo({ now }: { now: Date }) {
  const userId = await demoUserId();

  for (const todo of await listTodos(userId, { status: "all" })) {
    await deleteTodo(userId, todo.id);
  }

  for (const seed of SEED_TODOS) {
    const todo = await addTodo(
      userId,
      {
        title: seed.title,
        dueDate:
          seed.dueInDays === undefined
            ? undefined
            : localDate(now, seed.dueInDays),
      },
      { now: daysBefore(now, seed.createdDaysAgo) },
    );
    if (seed.doneDaysAgo !== undefined) {
      await updateTodo(
        userId,
        todo.id,
        { done: true },
        { now: daysBefore(now, seed.doneDaysAgo) },
      );
    }
  }

  return { userId, todos: await listTodos(userId, { status: "all" }) };
}
