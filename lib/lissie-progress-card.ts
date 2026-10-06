import { LISSIE_CATALOG_ID } from "./lissie-catalog";

// The progress card showProgress (lib/lissie-progress.ts) draws: an A2UI v0.9 surface
// from a fixed component tree. Pure, so tests can render it without a database.

export type TodoProgress = { total: number; done: number; open: number };

export const PROGRESS_SURFACE_ID = "todo-progress";

/** `${/path}` in a formatString template: interpolated from the data model on the client. */
const at = (path: keyof TodoProgress) => `\${/${path}}`;

/**
 * The card, authored once. Every number is a binding into the data model (`/total`,
 * `/done`, `/open`), so the tree is the same for every user and every list.
 */
export const PROGRESS_CARD = [
  { id: "root", component: "Card", child: "progress" },
  {
    id: "progress",
    component: "Column",
    children: ["heading", "bar", "summary"],
  },
  { id: "heading", component: "Text", variant: "h4", text: "Your list" },
  {
    id: "bar",
    component: "ProgressBar",
    value: { path: "/done" },
    max: { path: "/total" },
    label: "Todos done",
  },
  {
    id: "summary",
    component: "Text",
    text: {
      call: "formatString",
      args: {
        value: `${at("done")} of ${at("total")} done, ${at("open")} open`,
      },
      returnType: "string",
    },
  },
];

/** The operations that draw the card with these numbers. */
export function progressOperations(progress: TodoProgress) {
  const surfaceId = PROGRESS_SURFACE_ID;
  return [
    {
      version: "v0.9",
      createSurface: { surfaceId, catalogId: LISSIE_CATALOG_ID },
    },
    {
      version: "v0.9",
      updateComponents: { surfaceId, components: PROGRESS_CARD },
    },
    {
      version: "v0.9",
      updateDataModel: { surfaceId, path: "/", value: progress },
    },
  ];
}
