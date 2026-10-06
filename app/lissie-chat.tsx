"use client";

import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
import { useEffect, useState } from "react";
import { TodoSidebar } from "./todo-sidebar";
import { lissieToolRenderers } from "./tool-call-line";

// Lissie's chat. The runtime only lets this user run and connect on their own thread
// (lib/copilot-runtime.ts); the thread id here just has to match it.
/** CopilotKit's dark styles key on a `.dark` class; the app follows the OS setting. */
function usePrefersDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return dark;
}

export function LissieChat({ threadId }: { threadId: string }) {
  const dark = usePrefersDark();
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      agentId="lissie"
      useSingleEndpoint={false}
      enableInspector={process.env.NODE_ENV === "development"}
      renderToolCalls={lissieToolRenderers}
    >
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,9rem)] gap-4 md:grid-cols-[minmax(0,1fr)_16rem] md:grid-rows-1">
        <div
          className={`lissie-chat ${dark ? "dark" : ""} flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-fur/30 bg-surface`}
        >
          <CopilotChat
            agentId="lissie"
            threadId={threadId}
            className="h-full min-h-0"
            labels={{
              chatInputPlaceholder:
                "Tell Lissie what's on your mind (about the list)",
            }}
          />
        </div>
        <TodoSidebar />
      </div>
    </CopilotKitProvider>
  );
}
