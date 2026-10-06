import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
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
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-fur/20 pb-4">
        <Wordmark />
        <div className="flex min-w-0 items-center gap-3">
          <p
            className="hidden min-w-0 truncate text-sm text-fur sm:block"
            title={user.email}
          >
            {user.email}
          </p>
          <SignOutButton />
        </div>
      </header>
      {/* Phones need the height for the list and the chat, but the page still needs its h1. */}
      <h1 className="sr-only max-w-[24ch] shrink-0 text-balance font-display text-2xl leading-[1.05] font-bold tracking-tight text-ink sm:not-sr-only md:text-4xl">
        Hello, {user.name}. Lissie has been expecting you.
      </h1>
      <LissieChat threadId={lissieThreadId(user.id)} />
    </main>
  );
}
