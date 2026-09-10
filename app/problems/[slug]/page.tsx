import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Navbar from "@/components/Navbar";
import DifficultyBadge from "@/components/DifficultyBadge";
import ProblemPane from "@/components/ProblemPane";
import ChatThread from "@/components/ChatThread";
import FolderUploader from "@/components/FolderUploader";
import AskBox from "@/components/AskBox";

export default async function SolvePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const problem = await db.problem.findUnique({ where: { slug } });
  if (!problem) notFound();

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const thread = userId
    ? await db.submission.findMany({
        where: { userId, problemId: problem.id },
        orderBy: { version: "asc" },
        select: {
          id: true,
          version: true,
          status: true,
          feedbackMd: true,
          scoresJson: true,
          fileTreeJson: true,
          explanationText: true,
          createdAt: true,
        },
      })
    : [];

  const items = thread.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
  }));
  const latestId = thread.length > 0 ? thread[thread.length - 1].id : null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 py-4">
          <Link
            href="/problems"
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            ← Problems
          </Link>
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">
            {problem.title}
          </h1>
          <DifficultyBadge level={problem.difficulty} />
          <div className="flex flex-wrap gap-1.5">
            {problem.tags.map((t) => (
              <span
                key={t}
                className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
              >
                {t}
              </span>
            ))}
          </div>
          {thread.length > 0 && (
            <span className="ml-auto rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
              v{thread.length} · {thread.length === 1 ? "attempt" : "attempts"}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-4 pb-6 md:h-[calc(100vh-130px)] md:flex-row">
          <section className="slim-scroll rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 md:w-[42%] md:overflow-y-auto">
            <ProblemPane statementMd={problem.statementMd} />
            <div className="mt-6 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3">
              <h2 className="text-sm font-bold text-indigo-300">What to submit</h2>
              <p className="mt-1 text-sm text-zinc-300">{problem.deliverables}</p>
            </div>
          </section>
          <section className="slim-scroll space-y-4 md:w-[58%] md:overflow-y-auto md:pr-1">
            <FolderUploader problemId={problem.id} />
            {latestId && <AskBox submissionId={latestId} />}
            <ChatThread items={items} />
          </section>
        </div>
      </main>
    </>
  );
}
