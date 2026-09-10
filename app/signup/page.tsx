import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SignupForm from "@/components/SignupForm";

export default async function SignupPage() {
  const session = await auth();
  if ((session?.user as { id?: string } | undefined)?.id) redirect("/problems");
  return <SignupForm />;
}
