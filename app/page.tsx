import Link from "next/link";
import Navbar from "@/components/Navbar";

const STEPS = [
  {
    n: "01",
    title: "Pick a design problem",
    body: "Parking Lot, Splitwise, Elevator, BookMyShow — classic LLD rounds with full briefs.",
  },
  {
    n: "02",
    title: "Upload your folder",
    body: "Your explanation.txt plus code. Every upload becomes a versioned submission.",
  },
  {
    n: "03",
    title: "Get interviewed",
    body: "A 3-pass senior-interviewer panel probes your approach, audits your code, and delivers a verdict.",
  },
  {
    n: "04",
    title: "Iterate to hire-bar",
    body: "Fix the blockers, re-upload, and watch the verdict judge whether you improved.",
  },
];

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="py-16 text-center sm:py-24">
          <p className="mb-4 inline-block rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
            LLD INTERVIEW PRACTICE
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
            Design it. Defend it.{" "}
            <span className="text-indigo-400">Get hired for it.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-zinc-400">
            Not LeetCode for LLD. Upload your approach and code, and a
            senior-interviewer agent grills it — approach, SOLID, concurrency,
            extensibility — version after version.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-600 px-6 py-2.5 font-semibold text-white hover:bg-indigo-500"
            >
              Start practicing
            </Link>
            <Link
              href="/problems"
              className="rounded-lg border border-zinc-700 px-6 py-2.5 font-semibold hover:bg-zinc-800"
            >
              Browse problems
            </Link>
          </div>
        </section>
        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
            >
              <p className="text-sm font-black text-indigo-400">{s.n}</p>
              <h2 className="mt-2 font-bold">{s.title}</h2>
              <p className="mt-1 text-sm text-zinc-400">{s.body}</p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
