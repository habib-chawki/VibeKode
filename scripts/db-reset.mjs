// npm run db:reset, step 1: delete the local SQLite file (and its WAL/SHM/journal)
// named by DATABASE_URL; the npm script then runs drizzle-kit migrate on a fresh one.
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

if (existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:")) {
  console.error(
    `db:reset only deletes local file: databases, got DATABASE_URL=${url ?? "(unset)"}`,
  );
  process.exit(1);
}

const path = url.startsWith("file://")
  ? fileURLToPath(url)
  : url.slice("file:".length);
for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  rmSync(path + suffix, { force: true });
}
console.log(`deleted ${path}`);
