import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Browser-side client for the auth forms and the /device approval page (same origin).
export const authClient = createAuthClient({
  plugins: [deviceAuthorizationClient()],
});
