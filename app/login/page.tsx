import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if ((session?.user as { id?: string } | undefined)?.id) redirect("/problems");
  return <LoginForm />;
}
