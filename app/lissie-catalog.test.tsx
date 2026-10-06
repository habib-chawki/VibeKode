import {
  A2UIProvider,
  A2UIRenderer,
  useA2UIActions,
} from "@copilotkit/a2ui-renderer";
import { render, screen } from "@testing-library/react";
import type { TodoProgress } from "@todo-cat/contract";
import { useEffect } from "react";
import { expect, test } from "vitest";
import {
  PROGRESS_SURFACE_ID,
  progressOperations,
} from "@/lib/lissie-progress-card";
import { lissieCatalog } from "./lissie-catalog";

// The progress card end to end in the browser: showProgress's operations through the
// real catalog, so the bindings in the tree must resolve to the numbers in the data model.

function Surface({ progress }: { progress: TodoProgress }) {
  const { processMessages } = useA2UIActions();
  useEffect(() => {
    processMessages(progressOperations(progress));
  }, [processMessages, progress]);
  return <A2UIRenderer surfaceId={PROGRESS_SURFACE_ID} />;
}

test("the progress card renders the data model's numbers through the catalog", async () => {
  render(
    <A2UIProvider catalog={lissieCatalog}>
      <Surface progress={{ total: 4, done: 3, open: 1 }} />
    </A2UIProvider>,
  );
  const bar = await screen.findByRole("progressbar", { name: "Todos done" });
  expect(bar.getAttribute("aria-valuenow")).toBe("3");
  expect(bar.getAttribute("aria-valuemax")).toBe("4");
  expect(screen.getByText("3 of 4 done, 1 open")).toBeTruthy();
  expect(screen.getByText("Your list")).toBeTruthy();
});
