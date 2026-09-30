import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Doc } from "@/components/Doc";
import { ADMIN_COOKIE, isAdminTokenValid } from "@/lib/admin/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Administration", robots: { index: false, follow: false, nocache: true } };

export default async function Page() {
  if (isAdminTokenValid((await cookies()).get(ADMIN_COOKIE)?.value)) redirect("/admin");
  return (
    <Doc title="Administration">
      <div className="mt-6">
        <LoginForm />
      </div>
    </Doc>
  );
}
