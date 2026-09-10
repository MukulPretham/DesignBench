import Link from "next/link";
import { auth } from "@/lib/auth";
import SignOutButton from "./SignOutButton";

export default async function Navbar() {
  const session = await auth();
  const email = session?.user?.email as string | undefined;

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href={email ? "/problems" : "/"} className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-sm font-black text-white">
            D
          </span>
          <span className="font-bold tracking-tight">DesignBench</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {email ? (
            <>
              <Link href="/problems" className="opacity-70 hover:opacity-100">
                Problems
              </Link>
              <span className="hidden max-w-48 truncate opacity-50 sm:inline">{email}</span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="opacity-70 hover:opacity-100">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
