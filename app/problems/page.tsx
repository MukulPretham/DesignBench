import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Navbar from "@/components/Navbar";
import DifficultyBadge from "@/components/DifficultyBadge";

export default async function ProblemsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const problems = await db.problem.findMany({
    orderBy: { title: "asc" },
    select: { id: true, slug: true, title: true, difficulty: true, tags: true },
  });

  const attempted = userId
    ? await db.submission.groupBy({
        by: ["problemId"],
        where: { userId },
        _max: { version: true },
      })
    : [];
  const attemptedMap = new Map(attempted.map((a) => [a.problemId, a._max.version]));

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">LLD Problems</h1>
          <p className="mt-1 text-zinc-400">
            {problems.length} rounds · upload a folder per attempt · iterate to hire-bar.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {problems.map((p) => {
            const lastVersion = attemptedMap.get(p.id);
            return (
              <li key={p.slug}>
                <Link
                  href={`/problems/${p.slug}`}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-indigo-500/60 hover:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-bold">{p.title}</h2>
                    <DifficultyBadge level={p.difficulty} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm">
                    {lastVersion ? (
                      <span className="font-semibold text-emerald-300">
                        ✓ Attempted · v{lastVersion} — continue →
                      </span>
                    ) : (
                      <span className="text-zinc-500">Not attempted — start →</span>
                    )}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
