import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { lissieThreadId } from "@/lib/lissie";
import { getCurrentUser } from "@/lib/session";
import { LissieChat } from "./lissie-chat";
import { SignOutButton } from "./sign-out-button";

// The session check runs here, on the server: no session, no Lissie.
export default async function Home() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <p className="min-w-0 truncate text-sm text-fur" title={user.email}>
          Signed in as {user.email}
        </p>
        <SignOutButton />
      </header>
      <h1 className="max-w-[20ch] font-display text-4xl leading-[1.05] font-bold tracking-tight text-ink md:text-5xl">
        Hello, {user.name}. Lissie has been expecting you.
      </h1>
      <LissieChat threadId={lissieThreadId(user.id)} />
    </main>
  );
}
