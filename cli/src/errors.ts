// Exit codes are part of the CLI's interface: agents branch on them. Listed in --help.
export const EXIT = {
  ok: 0,
  unexpected: 1,
  usage: 2,
  unauthorized: 3,
  notFound: 4,
  validation: 5,
  unreachable: 6,
  loginFailed: 7,
} as const;

export const EXIT_CODE_HELP = `Exit codes:
  0  success
  1  unexpected error
  2  usage error (unknown command or option, bad value, delete without --yes)
  3  not signed in, or the session expired or was revoked
  4  todo not found
  5  validation failed (invalid title, date or change; checked locally and by the server)
  6  server unreachable or answered with something unexpected
  7  login denied or the code expired`;

/** An error with a stable code (the API's where there is one) and an exit code. */
export class CliError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
  }
}

export const notSignedIn = () =>
  new CliError(
    "unauthorized",
    "Not signed in. Run `todo-cat login` first.",
    EXIT.unauthorized,
  );
