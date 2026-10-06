"use client";

import {
  type CatalogDefinitions,
  type CatalogRenderers,
  type ComponentRenderer,
  createCatalog,
} from "@copilotkit/a2ui-renderer";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  LISSIE_CATALOG_ID,
  type LissieCatalogProps,
  lissieCatalogDefinitions,
} from "@/lib/lissie-catalog";

// The components Lissie's A2UI surfaces render with: the basic catalog, plus the
// definitions in lib/lissie-catalog.ts. The binder resolves data-model paths first, so
// renderers get plain values.

const renderers: {
  [K in keyof LissieCatalogProps]: ComponentRenderer<LissieCatalogProps[K]>;
} = {
  Card: ({ props, children }) => (
    <div className="my-2 w-full max-w-md rounded-xl border border-fur/30 bg-surface p-4 text-ink">
      {children(props.child)}
    </div>
  ),
  // The basic Text keeps an 8px margin all round; match it so the bar lines up.
  ProgressBar: ({ props }) => (
    <div className="m-2">
      <ProgressBar value={props.value} max={props.max} label={props.label} />
    </div>
  ),
};

// Module level: one stable catalog for the provider. The renderers are type-checked
// above against props derived from the definitions, so drift fails typecheck. The casts
// only cross the library boundary: its zod 3 copy differs from ours (zod/v3) to
// TypeScript alone, and its CatalogRenderers types bound props as unresolved bindings.
export const lissieCatalog = createCatalog(
  lissieCatalogDefinitions as unknown as CatalogDefinitions,
  renderers as unknown as CatalogRenderers<CatalogDefinitions>,
  { catalogId: LISSIE_CATALOG_ID, includeBasicCatalog: true },
);
