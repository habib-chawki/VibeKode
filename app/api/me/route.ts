import { errorResponse } from "@/lib/rest";
import { getCurrentUser } from "@/lib/session";

// GET /api/me: who the bearer token or cookie belongs to (CurrentUserSchema).
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return errorResponse(
      "unauthorized",
      "Sign in first: send `Authorization: Bearer <token>` or a session cookie.",
    );
  }
  return Response.json(user);
}
