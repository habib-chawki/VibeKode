import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LissieSays } from "@/components/lissie-says";
import { getCurrentUser } from "@/lib/session";
import { DeviceApproval } from "./device-approval";

export const metadata: Metadata = { title: "Approve a device · todo-cat" };

// Where `todo-cat login` sends its human. Approving needs a signed-in session, so the
// code survives the detour through /login.
export default async function DevicePage(props: PageProps<"/device">) {
  const raw = (await props.searchParams).user_code;
  const userCode = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const user = await getCurrentUser(await headers());
  if (!user) {
    const back = userCode
      ? `/device?user_code=${encodeURIComponent(userCode)}`
      : "/device";
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }
  return (
    <LissieSays remark="Something in a terminal wants in. Was it you?">
      <DeviceApproval initialCode={userCode} email={user.email} />
    </LissieSays>
  );
}
