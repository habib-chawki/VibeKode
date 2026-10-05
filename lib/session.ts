import "server-only";
import { auth } from "./auth";

export type CurrentUser = { id: string; name: string; email: string };

// The only place that reads sessions. Accepts a session cookie or an
// `Authorization: Bearer <token>` header; every adapter (pages, REST, agent tools, MCP) uses it.
export async function getCurrentUser(
  request: Request | Headers,
): Promise<CurrentUser | null> {
  const headers = request instanceof Request ? request.headers : request;
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const { id, name, email } = session.user;
  return { id, name, email };
}

export async function getUserId(
  request: Request | Headers,
): Promise<string | null> {
  return (await getCurrentUser(request))?.id ?? null;
}
