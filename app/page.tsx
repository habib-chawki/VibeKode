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
    // Viewport-high: the header and the chat input stay put, only the messages scroll.
    <main className="mx-auto flex h-dvh w-full max-w-screen-2xl flex-col gap-6 overflow-hidden px-4 py-6 md:px-10 md:py-8">
      <header className="flex shrink-0 items-center justify-between gap-4">
        <p className="min-w-0 truncate text-sm text-fur" title={user.email}>
          Signed in as {user.email}
        </p>
        <SignOutButton />
      </header>
      <h1 className="max-w-[20ch] shrink-0 font-display text-3xl leading-[1.05] font-bold tracking-tight text-ink md:text-5xl">
        Hello, {user.name}. Lissie has been expecting you.
      </h1>
      <LissieChat threadId={lissieThreadId(user.id)} />
    </main>
  );
}
