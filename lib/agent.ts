import { db } from "./db";
import { runEvaluation } from "./agent/graph";
import { callLLM } from "./agent/llm";
import type { PassA, PassB, PassC } from "./agent/passes";

/** Thin orchestrator: upload route calls this inside after(). */
export async function evaluateSubmission(submissionId: string): Promise<void> {
  await runEvaluation(submissionId);
}

function traceSummary(traceJson: string | null, feedbackMd: string | null): string {
  if (!traceJson) return (feedbackMd ?? "").slice(0, 3000);
  try {
    const t = JSON.parse(traceJson) as { passA?: PassA; passB?: PassB; passC?: PassC };
    return [
      `Approach gaps: ${(t.passA?.gaps ?? []).map((g) => g.gap).join("; ")}`,
      `Audit cons: ${(t.passB?.cons ?? []).map((c) => `[${c.severity}] ${c.point} (${c.file})`).join("; ")}`,
      `Verdict: ${t.passC?.finalFeedback ?? ""}`,
    ]
      .join("\n")
      .slice(0, 3000);
  } catch {
    return (feedbackMd ?? "").slice(0, 3000);
  }
}

export async function askFollowUp(submissionId: string, userId: string, question: string): Promise<string> {
  const sub = await db.submission.findFirst({
    where: { id: submissionId, userId },
    include: { problem: true },
  });
  if (!sub) throw new Error("Submission not found");
  if (!process.env.LLM_API_KEY) {
    throw new Error("AI evaluator not configured");
  }
  const userPrompt = [
    `Problem: ${sub.problem.title}`,
    `Candidate approach:\n${sub.explanationText.slice(0, 4000)}`,
    `Interview trace summary:\n${traceSummary(sub.agentTraceJson, sub.feedbackMd)}`,
    `Candidate follow-up question: ${question}`,
    `Answer concisely as the senior interviewer, referencing their code/approach. Return STRICT JSON: {"answer": string}`,
  ].join("\n\n");
  const raw = await callLLM(
    "You are a senior LLD interviewer with 10+ years of experience (Staff level). Be direct and specific.",
    userPrompt,
    { maxTokens: 800, temp: 0.3 }
  );
  try {
    const parsed = JSON.parse(raw) as { answer?: string };
    if (typeof parsed.answer === "string" && parsed.answer) return parsed.answer.slice(0, 4000);
  } catch {
    /* fall through */
  }
  return raw.slice(0, 4000);
}
