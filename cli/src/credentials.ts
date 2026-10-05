import {
  chmodSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// One file, owner-only (0600) in a 0700 directory, in the user's config directory, never
// in the repo. Tokens are keyed by server URL, so a token is only ever sent to the server
// that issued it.

type Saved = { token: string; email: string };
type CredentialsFile = { servers: Record<string, Saved> };

export function configDir(): string {
  if (process.env.TODO_CAT_CONFIG_DIR) return process.env.TODO_CAT_CONFIG_DIR;
  if (process.platform === "win32" && process.env.APPDATA) {
    return join(process.env.APPDATA, "todo-cat");
  }
  return join(
    process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
    "todo-cat",
  );
}

export const credentialsPath = () => join(configDir(), "credentials.json");

function read(): CredentialsFile {
  try {
    const parsed = JSON.parse(readFileSync(credentialsPath(), "utf8"));
    return parsed && typeof parsed.servers === "object"
      ? parsed
      : { servers: {} };
  } catch {
    return { servers: {} };
  }
}

function write(file: CredentialsFile): void {
  const path = credentialsPath();
  if (Object.keys(file.servers).length === 0) {
    rmSync(path, { force: true });
    return;
  }
  mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600); // also tighten a file that existed with looser permissions
}

export function loadCredentials(server: string): Saved | undefined {
  return read().servers[server];
}

export function saveCredentials(server: string, saved: Saved): void {
  const file = read();
  file.servers[server] = saved;
  write(file);
}

export function deleteCredentials(server: string): void {
  const file = read();
  delete file.servers[server];
  write(file);
}
