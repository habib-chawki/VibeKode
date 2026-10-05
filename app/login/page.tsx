import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LissieSays } from "@/components/lissie-says";
import { getUserId } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · todo-cat" };

export default async function LoginPage() {
  if (await getUserId(await headers())) redirect("/");
  return (
    <LissieSays remark="Back already? She noticed you were gone.">
      <LoginForm />
    </LissieSays>
  );
}
