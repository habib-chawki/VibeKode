import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LissieSays } from "@/components/lissie-says";
import { safeNext } from "@/lib/safe-next";
import { getUserId } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · todo-cat" };

export default async function LoginPage(props: PageProps<"/login">) {
  const next = safeNext((await props.searchParams).next);
  if (await getUserId(await headers())) redirect(next);
  return (
    <LissieSays remark="Back already? She noticed you were gone.">
      <LoginForm next={next} />
    </LissieSays>
  );
}
