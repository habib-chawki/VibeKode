import { ErrorBodySchema } from "@todo-cat/contract";
import type { z } from "zod";
import { CliError, EXIT } from "./errors";

export const DEFAULT_SERVER = "http://localhost:3000";

export function serverUrl(): string {
  return (process.env.TODO_CAT_URL || DEFAULT_SERVER).replace(/\/+$/, "");
}

const EXIT_BY_CODE: Record<string, number> = {
  unauthorized: EXIT.unauthorized,
  "todo-not-found": EXIT.notFound,
  "validation-failed": EXIT.validation,
};

type Options = { token?: string; body?: unknown };

/** One HTTP call; the response is parsed with a contract schema, errors become CliErrors. */
export async function call<T>(
  method: string,
  path: string,
  schema: z.ZodType<T> | null,
  { token, body }: Options = {},
): Promise<T> {
  const server = serverUrl();
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${server}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new CliError(
      "unreachable",
      `Can't reach the todo-cat server at ${server}. Is it running? (set TODO_CAT_URL to use another one)`,
      EXIT.unreachable,
    );
  }

  const text = await response.text();
  const json = text ? safeJson(text) : undefined;
  if (!response.ok) {
    const error = ErrorBodySchema.safeParse(json);
    if (error.success) {
      const { code, message } = error.data.error;
      throw new CliError(code, message, EXIT_BY_CODE[code] ?? EXIT.unexpected);
    }
    throw new CliError(
      "unexpected-response",
      `The server answered ${response.status} without an error body.`,
      EXIT.unreachable,
    );
  }
  if (!schema) return undefined as T;
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new CliError(
      "unexpected-response",
      `The server's response doesn't match the contract: ${parsed.error.message}`,
      EXIT.unreachable,
    );
  }
  return parsed.data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
