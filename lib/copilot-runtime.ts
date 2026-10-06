import "server-only";
import { type BaseEvent, EventType } from "@ag-ui/core";
import { MastraAgent } from "@ag-ui/mastra";
import {
  type AgentRunnerConnectRequest,
  CopilotRuntime,
  type CopilotRuntimeHooks,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import {
  MASTRA_RESOURCE_ID_KEY,
  RequestContext,
} from "@mastra/core/request-context";
import { Observable } from "rxjs";
import { getLissie, lissieThreadId, loadLissieHistory } from "./lissie";
import { getUserId } from "./session";

// The CopilotKit runtime behind /api/copilotkit, with Lissie as its only agent.
// The runtime serves ~25 routes (threads list, any thread's messages, clear all, debug
// events…); the browser needs four. So: resolve the user first (401), then allow only
// info plus run/connect/suggest/stop on the user's own thread, and answer 404 to
// everything else, the same as "doesn't exist".

export const COPILOT_BASE_PATH = "/api/copilotkit";

function notFound(): never {
  throw Response.json(
    { error: { code: "not-found", message: "Not found." } },
    { status: 404 },
  );
}

function guard(userId: string): CopilotRuntimeHooks["onBeforeHandler"] {
  const ownThread = lissieThreadId(userId);
  return async ({ request, route }) => {
    switch (route.method) {
      case "info":
        return;
      case "agent/stop":
        if (route.agentId === "lissie" && route.threadId === ownThread) return;
        break;
      case "agent/run":
      case "agent/connect":
      case "agent/suggest": {
        const body = (await request
          .clone()
          .json()
          .catch(() => null)) as { threadId?: unknown } | null;
        if (route.agentId === "lissie" && body?.threadId === ownThread) return;
        break;
      }
    }
    notFound();
  };
}

/**
 * After a restart the runtime's in-memory event store is empty, but Mastra memory still
 * has the conversation: replay it as one MESSAGES_SNAPSHOT so the chat shows it again.
 */
class MemoryBackedRunner extends InMemoryAgentRunner {
  constructor(private readonly userId: string) {
    super();
  }

  override connect(request: AgentRunnerConnectRequest): Observable<BaseEvent> {
    if (this.getThreadEvents(request.threadId).length > 0) {
      return super.connect(request);
    }
    return new Observable<BaseEvent>((subscriber) => {
      loadLissieHistory(this.userId)
        .then((messages) => {
          if (messages.length > 0) {
            subscriber.next({
              type: EventType.MESSAGES_SNAPSHOT,
              messages,
            } as BaseEvent);
          }
          subscriber.complete();
        })
        .catch((error) => subscriber.error(error));
    });
  }
}

function lissieFor(userId: string): MastraAgent {
  // The memory owner comes from the server-side session, never from the client.
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
  return new MastraAgent({
    agentId: "lissie",
    agent: getLissie(),
    resourceId: userId,
    requestContext,
  });
}

export async function handleCopilotRequest(
  request: Request,
): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json(
      { error: { code: "unauthorized", message: "Sign in first." } },
      { status: 401 },
    );
  }

  const runtime = new CopilotRuntime({
    agents: () => ({ lissie: lissieFor(userId) }),
    runner: new MemoryBackedRunner(userId),
    // The runtime forwards `authorization` and `x-*` headers to the agent, and
    // @ag-ui/mastra passes them on to the model provider: a CLI user's session token
    // would reach OpenRouter. Forward nothing.
    forwardHeaders: { deny: ["authorization"], denyPrefixes: ["x-"] },
  });

  // Belt and braces: the runtime never sees the caller's credentials at all.
  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.delete("cookie");
  // Built from parts: `new Request(request, …)` throws on Next's NextRequest in route handlers.
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const stripped = new Request(request.url, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    signal: request.signal,
  });

  const handler = createCopilotRuntimeHandler({
    runtime,
    basePath: COPILOT_BASE_PATH,
    hooks: { onBeforeHandler: guard(userId) },
  });
  return handler(stripped);
}
