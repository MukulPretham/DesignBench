import type { PassB, PassC } from "./passes";

type Scores = { oops: number; solid: number; extensibility: number; clarity: number };

export function fallbackFeedback(fileCount: number, explanationLen: number): { feedbackMd: string; scoresJson: string } {
  const feedbackMd = [
    "## Pros",
    `- Approach documented in explanation.txt (${explanationLen} chars).`,
    `- Submitted ${fileCount} file(s) with a recognizable structure.`,
    "## Cons",
    "- [high] Automatic review only: add an LLM API key for a real senior-interviewer review.",
    "## Improvements",
    "1. Split responsibilities so each class has one reason to change — e.g. separate pricing/fee logic into a strategy class.",
    "2. State your concurrency assumptions explicitly (what breaks with two threads parking at once?).",
    "3. Add one extension scenario (new vehicle type / pricing rule) and show it needs no core rewrite.",
    "## Final feedback",
    "Good start on structure. Next iteration: tighten SOLID adherence and document trade-offs. (Automatic review — AI evaluator unavailable.)",
    "## Scores",
    "OOP: 5/10, SOLID: 5/10, Extensibility: 5/10, Clarity: 5/10",
  ].join("\n");
  return {
    feedbackMd,
    scoresJson: JSON.stringify({ oops: 5, solid: 5, extensibility: 5, clarity: 5 }),
  };
}

const num = (v: unknown) =>
  typeof v === "number" && v >= 1 && v <= 10 ? Math.round(v) : 5;

/** Deterministic renderer: graph output JSON → version-box markdown. UI untouched. */
export function renderFromPasses(b: PassB, c: PassC): { feedbackMd: string; scoresJson: string } {
  const pros = (b.pros ?? []).map((p) => `- ${p}`).join("\n") || "- (none noted)";
  const cons =
    (b.cons ?? [])
      .map((x) => `- [${x.severity ?? "medium"}] ${x.point ?? ""}${x.file ? ` (${x.file})` : ""}`)
      .join("\n") || "- (none noted)";
  const improvements =
    (b.improvements ?? [])
      .map(
        (im, i) =>
          `${i + 1}. ${im.what ?? ""} — ${im.why ?? ""}${im.example ? ` Example: ${im.example}` : ""}`
      )
      .join("\n") || "(none suggested)";
  const blockers =
    (c.topBlockers ?? []).map((t) => `- ${t}`).join("\n") || null;
  const scores: Scores = {
    oops: num(c.scores?.oops),
    solid: num(c.scores?.solid),
    extensibility: num(c.scores?.extensibility),
    clarity: num(c.scores?.clarity),
  };
  const feedbackMd = [
    "## Pros",
    pros,
    "## Cons",
    cons,
    "## Improvements",
    improvements,
    ...(blockers ? ["## Top blockers", blockers] : []),
    "## Final feedback",
    c.finalFeedback ?? "(no verdict returned)",
    "## Scores",
    `OOP: ${scores.oops}/10, SOLID: ${scores.solid}/10, Extensibility: ${scores.extensibility}/10, Clarity: ${scores.clarity}/10`,
  ].join("\n");
  return { feedbackMd, scoresJson: JSON.stringify(scores) };
}
