import "server-only";
import type { ErrorBody, ErrorCode } from "@todo-cat/contract";
import { getUserId } from "./session";
import { TodoError } from "./todo-service";

// Shared plumbing for the REST adapter (app/api/todos): resolve the user, parse input
// with a contract schema, map service errors. No business rules here.

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  "todo-not-found": 404,
  "validation-failed": 400,
};

export function errorResponse(code: ErrorCode, message: string): Response {
  const body: ErrorBody = { error: { code, message } };
  return Response.json(body, { status: STATUS[code] });
}

/** Thrown inside a handler to answer 400 `validation-failed`. */
class ValidationError extends Error {}

type Schema<T> = {
  safeParse(input: unknown):
    | { success: true; data: T }
    | {
        success: false;
        error: { issues: { path: PropertyKey[]; message: string }[] };
      };
};

export function parse<T>(schema: Schema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ValidationError(
    result.error.issues
      .map((i) => `${i.path.map(String).join(".") || "input"}: ${i.message}`)
      .join("; "),
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("The request body must be JSON.");
  }
}

/**
 * Resolves the user first (no user: 401, even for bad input), then runs the handler
 * and maps errors to the error body.
 */
export async function withUser(
  request: Request,
  handler: (userId: string) => Promise<Response>,
): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return errorResponse(
      "unauthorized",
      "Sign in first: send `Authorization: Bearer <token>` or a session cookie.",
    );
  }
  try {
    return await handler(userId);
  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse("validation-failed", error.message);
    }
    if (error instanceof TodoError)
      return errorResponse(error.code, error.message);
    throw error;
  }
}
