// npm run db:seed: the demo user and a dozen todos in the local database.
// Runs under tsx with --conditions=react-server, so server-only modules load like in Next.
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

const { DEMO_USER, seedDemo } = await import("../lib/seed-demo");
const { todos } = await seedDemo({ now: new Date() });
const done = todos.filter((t) => t.done).length;
console.log(
  `Seeded ${DEMO_USER.email} (password ${DEMO_USER.password}): ${todos.length} todos, ${done} done.`,
);
