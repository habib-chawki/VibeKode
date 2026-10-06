"use client";

import {
  type ReactToolCallRenderer,
  ToolCallStatus,
} from "@copilotkit/react-core/v2";
import { describeToolCall } from "./tool-call-text";

// One readable line per tool call in Lissie's chat, live and after a history replay.

// Module level: CopilotKit wants a stable array.
export const lissieToolRenderers: ReactToolCallRenderer<
  Record<string, unknown>
>[] = [
  {
    name: "*",
    agentId: "lissie",
    render: ({ name, args, status, result }) => (
      <p className="my-1 text-sm text-fur" data-testid="lissie-tool-call">
        {describeToolCall(
          name,
          (args ?? {}) as Record<string, unknown>,
          status === ToolCallStatus.Complete,
          result,
        )}
      </p>
    ),
  },
];
