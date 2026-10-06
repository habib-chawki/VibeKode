// zod v3 on purpose: the A2UI binder reads v3 internals (`_def.typeName`) to find the
// props it must resolve against the data model; a zod 4 schema would never bind.
import { z } from "zod/v3";

// Lissie's A2UI catalog: CopilotKit's basic components plus what they lack. Server-safe
// (no React), so a tool can name the catalog its surfaces render against.

export const LISSIE_CATALOG_ID = "todo-cat://lissie-catalog";

/** A literal, a `{ path }` into the surface's data model, or a function call. */
const dynamic = <T extends z.ZodTypeAny>(literal: T) =>
  z.union([
    literal,
    z.object({ path: z.string() }),
    z.object({
      call: z.string(),
      args: z.record(z.any()),
      returnType: z.string().optional(),
    }),
  ]);

export const lissieCatalogDefinitions = {
  // Replaces the basic Card, whose white background and grey border ignore the app's
  // palette and leave light text unreadable in dark mode.
  Card: {
    description: "A container card with a single child.",
    props: z.object({ child: z.string() }),
  },
  ProgressBar: {
    description:
      "A horizontal bar showing value out of max, e.g. todos done out of all todos.",
    props: z.object({
      value: dynamic(z.number()),
      max: dynamic(z.number()),
      label: dynamic(z.string()),
    }),
  },
};

/** What each renderer receives: the binder has already resolved every binding. */
export type LissieCatalogProps = {
  Card: { child: string };
  ProgressBar: { value: number; max: number; label: string };
};
