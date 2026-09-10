import { formatDiff, type EvalContext } from "./context";

export class PassError extends Error {
  pass: string;
  raw: string;
  constructor(pass: string, message: string, raw = "") {
    super(message);
    this.pass = pass;
    this.raw = raw;
  }
}

export type PassA = {
  entities: string[];
  patternChoices: { pattern: string; why: string; credible: boolean }[];
  strengths: string[];
  gaps: { gap: string; whyItMatters: string }[];
  questionsForCode: string[];
  approachScore: number;
};

export type PassB = {
  claimVerifications: { claim: string; verdict: string; file: string }[];
  pros: string[];
  cons: { point: string; file: string; severity: string }[];
  improvements: { what: string; why: string; example: string }[];
  codeScores: { oops: number; solid: number; extensibility: number; clarity: number };
};

export type PassC = {
  finalFeedback: string;
  topBlockers: string[];
  scores: { oops: number; solid: number; extensibility: number; clarity: number };
};

export const INTERVIEWER =
  "You are a senior LLD interviewer with 10+ years of experience (Staff level). Be direct and specific. No fluff, no generic advice.";

function baseProblem(ctx: EvalContext): string {
  return [
    `Problem: ${ctx.problemTitle}`,
    ctx.statementMd,
    `Deliverables: ${ctx.deliverables}`,
  ].join("\n\n");
}

export function buildPromptA(ctx: EvalContext): { system: string; user: string } {
  return {
    system: `${INTERVIEWER} You are conducting the approach discussion. Probe the candidate's thinking before seeing any code.`,
    user: [
      baseProblem(ctx),
      `--- Candidate approach (explanation.txt) ---\n${ctx.explanation}`,
      `You only have the approach, not the code. Identify entities/relationships, judge pattern choices, find gaps.`,
      `Return STRICT JSON only: {"entities": string[], "patternChoices": [{"pattern": string, "why": string, "credible": boolean}], "strengths": string[], "gaps": [{"gap": string, "whyItMatters": string}], "questionsForCode": string[] (3-5 pointed questions the code audit must verify), "approachScore": 1-10}`,
    ].join("\n\n"),
  };
}

export function buildPromptB(ctx: EvalContext, a: PassA): { system: string; user: string } {
  return {
    system: `${INTERVIEWER} The code is on the table. Cross-examine the approach against actual classes and files.`,
    user: [
      baseProblem(ctx),
      `--- Candidate approach (explanation.txt) ---\n${ctx.explanation}`,
      `--- Approach review summary ---\nEntities: ${(a.entities ?? []).join(", ")}\nGaps flagged: ${(a.gaps ?? []).map((g) => g.gap).join("; ")}\nQuestions you MUST answer from code:\n${(a.questionsForCode ?? []).map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
      `--- Code files ---\n${ctx.code}`,
      ctx.prevFeedback
        ? `--- Previous version feedback ---\n${ctx.prevFeedback}\nFile changes since then:\n${formatDiff(ctx.diff)}\n(Judge whether this version improved on it.)`
        : "",
      `Audit the code. Verify each approach claim (holds/partial/contradicted). Reference ONLY files present in the code above — never invent filenames. If code contradicts the approach, say so explicitly.`,
      `Return STRICT JSON only: {"claimVerifications": [{"claim": string, "verdict": "holds|partial|contradicted", "file": string}], "pros": string[], "cons": [{"point": string, "file": string, "severity": "high|medium|low"}], "improvements": [{"what": string, "why": string, "example": string}], "codeScores": {"oops": 1-10, "solid": 1-10, "extensibility": 1-10, "clarity": 1-10}}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

export function buildPromptC(ctx: EvalContext, a: PassA, b: PassB): { system: string; user: string } {
  return {
    system: `${INTERVIEWER} You are writing the final interview verdict. Be decisive.`,
    user: [
      `Problem: ${ctx.problemTitle}`,
      `--- Approach summary (score ${a.approachScore}/10) ---\nStrengths: ${(a.strengths ?? []).join("; ")}\nGaps: ${(a.gaps ?? []).map((g) => g.gap).join("; ")}`,
      `--- Code audit findings ---\nPros: ${(b.pros ?? []).join("; ")}\nCons: ${(b.cons ?? []).map((c) => `[${c.severity}] ${c.point} (${c.file})`).join("; ")}\nClaim verdicts: ${(b.claimVerifications ?? []).map((v) => `${v.claim}: ${v.verdict}`).join("; ")}\nTop improvements: ${(b.improvements ?? []).slice(0, 3).map((i) => i.what).join("; ")}`,
      `Merge into a hiring-style verdict. Where approach and code conflict, code evidence wins. Score bar: 8+ would pass a real LLD round, 5-7 fixable gaps, 4 or below needs rework.`,
      `Return STRICT JSON only: {"finalFeedback": string (2-4 sentences: verdict + single highest-leverage next step), "topBlockers": string[] (max 3), "scores": {"oops": 1-10, "solid": 1-10, "extensibility": 1-10, "clarity": 1-10}}`,
    ].join("\n\n"),
  };
}

export function parseStrict<T>(pass: string, raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new PassError(pass, `Pass ${pass} returned non-JSON`, raw);
  }
}
