import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LissieSays } from "@/components/lissie-says";
import { getUserId } from "@/lib/session";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account · todo-cat" };

export default async function SignupPage() {
  if (await getUserId(await headers())) redirect("/");
  return (
    <LissieSays remark="A new human. She'll allow it, for now.">
      <SignupForm />
    </LissieSays>
  );
}
