"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { TextField } from "@/components/ui/text-field";
import { TextLink } from "@/components/ui/text-link";
import { authClient } from "@/lib/auth-client";

type Step = "enter" | "confirm" | "approved" | "denied";

/** Codes are shown as ABCD-EFGH; the server wants them without the dash. */
function normalize(code: string): string {
  return code.trim().replace(/[\s-]/g, "").toUpperCase();
}

/** The code as `todo-cat login` prints it, so the two can be compared at a glance. */
function asPrinted(code: string): string {
  const plain = normalize(code);
  return plain.length === 8 ? `${plain.slice(0, 4)}-${plain.slice(4)}` : plain;
}

const backToList = (
  <TextLink href="/" className="self-start">
    Back to your list
  </TextLink>
);

export function DeviceApproval({
  initialCode,
  email,
}: {
  initialCode: string;
  email: string;
}) {
  const [code, setCode] = useState(initialCode);
  const [step, setStep] = useState<Step>("enter");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Checking the code claims it for this session; only this session can then decide.
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.device({
      query: { user_code: normalize(code) },
    });
    setPending(false);
    if (error) {
      setError(
        "That code is unknown or expired. Run `todo-cat login` again for a new one.",
      );
      return;
    }
    setStep("confirm");
  }

  async function decide(approve: boolean) {
    setPending(true);
    setError(null);
    const userCode = normalize(code);
    const { error } = approve
      ? await authClient.device.approve({ userCode })
      : await authClient.device.deny({ userCode });
    setPending(false);
    if (error) {
      setError(
        "Couldn't record your answer. The code may have expired; start over in the terminal.",
      );
      return;
    }
    setStep(approve ? "approved" : "denied");
  }

  if (step === "approved") {
    return (
      <div className="flex flex-col gap-5">
        <p role="status" className="text-lg text-ink">
          Approved. The todo-cat CLI is signed in as {email}; go back to your
          terminal.
        </p>
        {backToList}
      </div>
    );
  }
  if (step === "denied") {
    return (
      <div className="flex flex-col gap-5">
        <p role="status" className="text-lg text-ink">
          Denied. Nothing was signed in. If you didn't start this, you can
          ignore it.
        </p>
        {backToList}
      </div>
    );
  }
  if (step === "confirm") {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-base text-ink">
          The <strong>todo-cat CLI</strong> wants to read and change your todos
          as <strong>{email}</strong>, with this code:
        </p>
        <p className="rounded-lg border border-fur/40 bg-surface px-4 py-3 text-center font-mono text-2xl font-semibold tracking-[0.12em] text-ink">
          {asPrinted(code)}
        </p>
        <p className="text-sm text-fur">
          Only approve if you just ran <code>todo-cat login</code> yourself and
          this code matches your terminal. Never approve a code someone sent
          you.
        </p>
        <FormError message={error} />
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => decide(true)} disabled={pending}>
            Approve
          </Button>
          <Button
            variant="quiet"
            onClick={() => decide(false)}
            disabled={pending}
          >
            Deny
          </Button>
        </div>
      </div>
    );
  }
  return (
    <form onSubmit={verify} className="flex flex-col gap-5">
      <TextField
        label="Code from your terminal"
        name="user_code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        hint="It looks like ABCD-EFGH."
        required
      />
      <FormError message={error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
