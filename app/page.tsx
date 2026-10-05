import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

// The session check runs here, on the server: no session, no list.
export default async function Home() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <header className="flex items-center justify-between gap-4">
        <p className="min-w-0 truncate text-sm text-fur" title={user.email}>
          Signed in as {user.email}
        </p>
        <SignOutButton />
      </header>
      <h1 className="max-w-[18ch] font-display text-5xl leading-[1.05] font-bold tracking-tight text-ink">
        Hello, {user.name}. Lissie has been expecting you.
      </h1>
      <p className="max-w-prose text-lg text-fur">
        Your list is empty. She finds that suspicious.
      </p>
    </main>
  );
}
