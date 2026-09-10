"use client";

import { useState } from "react";
import Markdown from "./Markdown";

export default function AskBox({ submissionId }: { submissionId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setError("");
    setAnswer("");
    setLoading(true);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Ask failed");
        return;
      }
      setAnswer(data.answer ?? "");
      setQuestion("");
    } catch {
      setError("Ask failed (network)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-sm font-bold">Ask about your feedback</p>
      <form onSubmit={onAsk} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Why is the dispatcher a con?"
          maxLength={2000}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={!question.trim() || loading}
          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-bold text-black hover:bg-white disabled:opacity-40"
        >
          {loading ? "…" : "Ask"}
        </button>
      </form>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {answer && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <Markdown text={answer} />
        </div>
      )}
    </div>
  );
}
