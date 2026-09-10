"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-md border border-zinc-700 px-3 py-1 text-sm opacity-80 hover:bg-zinc-800 hover:opacity-100"
    >
      Sign out
    </button>
  );
}
