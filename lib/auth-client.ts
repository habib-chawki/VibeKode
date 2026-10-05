import { createAuthClient } from "better-auth/react";

// Browser-side client for the sign-up, sign-in and sign-out forms (same origin).
export const authClient = createAuthClient();
