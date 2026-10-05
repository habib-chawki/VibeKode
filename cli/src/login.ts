import { CLI_CLIENT_ID } from "@todo-cat/contract";
import { z } from "zod";
import { serverUrl } from "./api";
import { CliError, EXIT } from "./errors";

// RFC 8628 device authorization against Better Auth's endpoints. These are Better Auth's
// protocol, not our contract, so their shapes are declared here.

const DeviceCodeSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  verification_uri_complete: z.string().optional(),
  expires_in: z.number(),
  interval: z.number().default(5),
});

const TokenSchema = z.object({ access_token: z.string() });
const OAuthErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

async function post(
  path: string,
  body: unknown,
): Promise<{ status: number; json: unknown }> {
  try {
    const response = await fetch(`${serverUrl()}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return {
      status: response.status,
      json: text ? JSON.parse(text) : undefined,
    };
  } catch {
    throw new CliError(
      "unreachable",
      `Can't reach the todo-cat server at ${serverUrl()}. Is it running?`,
      EXIT.unreachable,
    );
  }
}

const absolute = (uri: string) => new URL(uri, `${serverUrl()}/`).toString();
const spaced = (code: string) =>
  code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Prints the code and URL on stderr (never opens a browser) and polls until approved. */
export async function deviceLogin(
  say: (line: string) => void,
): Promise<string> {
  const start = await post("/device/code", { client_id: CLI_CLIENT_ID });
  const code = DeviceCodeSchema.safeParse(start.json);
  if (!code.success) {
    throw new CliError(
      "unexpected-response",
      `The server didn't start a device login (HTTP ${start.status}).`,
      EXIT.unreachable,
    );
  }
  const {
    device_code,
    user_code,
    verification_uri,
    verification_uri_complete,
  } = code.data;
  say(
    `To sign in, open ${absolute(verification_uri)} and enter the code ${spaced(user_code)}`,
  );
  if (verification_uri_complete)
    say(`or open ${absolute(verification_uri_complete)}`);
  say("Waiting for approval in the browser…");

  let interval = code.data.interval;
  const deadline = Date.now() + code.data.expires_in * 1000;
  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    const poll = await post("/device/token", {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code,
      client_id: CLI_CLIENT_ID,
    });
    const token = TokenSchema.safeParse(poll.json);
    if (token.success) return token.data.access_token;
    const error = OAuthErrorSchema.safeParse(poll.json);
    const kind = error.success ? error.data.error : "unexpected";
    if (kind === "authorization_pending") continue;
    if (kind === "slow_down") {
      interval += 5;
      continue;
    }
    if (kind === "access_denied") {
      throw new CliError(
        "login-denied",
        "The login was denied in the browser.",
        EXIT.loginFailed,
      );
    }
    if (kind === "expired_token") break;
    throw new CliError(
      "unexpected-response",
      `Login failed: ${error.success ? (error.data.error_description ?? kind) : `HTTP ${poll.status}`}`,
      EXIT.unreachable,
    );
  }
  throw new CliError(
    "login-expired",
    "The code expired before it was approved. Run `todo-cat login` again.",
    EXIT.loginFailed,
  );
}

/** Ends the session on the server, so the token is useless even if the file leaks. */
export async function revokeSession(token: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${serverUrl()}/api/auth/sign-out`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
  } catch {
    throw new CliError(
      "unreachable",
      `Signed out locally, but couldn't reach ${serverUrl()} to revoke the session.`,
      EXIT.unreachable,
    );
  }
  if (!response.ok && response.status !== 401) {
    throw new CliError(
      "unexpected-response",
      `Signed out locally, but the server refused to revoke the session (HTTP ${response.status}).`,
      EXIT.unreachable,
    );
  }
}
