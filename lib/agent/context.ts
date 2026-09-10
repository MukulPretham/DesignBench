import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../db";

export const EXPLANATION_CAP = 8000;
export const CODE_TOTAL_CAP = 30000;
export const MAX_CODE_FILES = 50;
export const PREV_FEEDBACK_CAP = 1000;

export type FileEntry = { path: string; size: number };

export type FileDiff = {
  added: string[];
  removed: string[];
  modified: string[];
};

export type EvalContext = {
  submissionId: string;
  userId: string;
  problemId: string;
  version: number;
  problemTitle: string;
  statementMd: string;
  deliverables: string;
  explanation: string;
  code: string;
  fileCount: number;
  prevFeedback: string;
  diff: FileDiff;
};

function uploadRoot(): string {
  return process.env.UPLOAD_DIR || "./uploads";
}

function parseTree(json: string): FileEntry[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Zero-LLM-cost file-list diff vs the previous version's tree. */
export function fileListDiff(prev: FileEntry[], curr: FileEntry[]): FileDiff {
  const prevMap = new Map(prev.map((f) => [f.path, f.size]));
  const currMap = new Map(curr.map((f) => [f.path, f.size]));
  const added = [...currMap.keys()].filter((p) => !prevMap.has(p));
  const removed = [...prevMap.keys()].filter((p) => !currMap.has(p));
  const modified = [...currMap.keys()].filter(
    (p) => prevMap.has(p) && prevMap.get(p) !== currMap.get(p)
  );
  return { added, removed, modified };
}

export function formatDiff(diff: FileDiff): string {
  const parts: string[] = [];
  if (diff.added.length > 0) parts.push(`Added: ${diff.added.join(", ")}`);
  if (diff.removed.length > 0) parts.push(`Removed: ${diff.removed.join(", ")}`);
  if (diff.modified.length > 0) parts.push(`Modified: ${diff.modified.join(", ")}`);
  return parts.length > 0 ? parts.join("\n") : "(no file changes vs previous version)";
}

/** Assemble once, share across all passes. */
export async function assembleContext(submissionId: string): Promise<EvalContext> {
  const sub = await db.submission.findUnique({
    where: { id: submissionId },
    include: { problem: true },
  });
  if (!sub) throw new Error("Submission not found");

  const tree = parseTree(sub.fileTreeJson);
  const codeFiles = tree
    .filter((f) => !f.path.toLowerCase().endsWith("explanation.txt"))
    .slice(0, MAX_CODE_FILES);

  let codeBudget = CODE_TOTAL_CAP;
  const chunks: string[] = [];
  let omitted = 0;
  for (const f of codeFiles) {
    if (codeBudget <= 0) {
      omitted++;
      continue;
    }
    try {
      const raw = await readFile(path.join(uploadRoot(), sub.storagePath, f.path), "utf-8");
      const slice = raw.slice(0, codeBudget);
      codeBudget -= slice.length;
      chunks.push(`--- ${f.path} ---\n${slice}`);
      if (raw.length > slice.length) chunks.push(`[... truncated ${f.path} ...]`);
    } catch {
      omitted++;
    }
  }
  if (omitted > 0) chunks.push(`[${omitted} file(s) omitted from review]`);

  const prev =
    sub.version > 1
      ? await db.submission.findFirst({
          where: { userId: sub.userId, problemId: sub.problemId, version: sub.version - 1 },
          select: { feedbackMd: true, fileTreeJson: true },
        })
      : null;

  const diff = prev ? fileListDiff(parseTree(prev.fileTreeJson), tree) : { added: [], removed: [], modified: [] };

  return {
    submissionId: sub.id,
    userId: sub.userId,
    problemId: sub.problemId,
    version: sub.version,
    problemTitle: sub.problem.title,
    statementMd: sub.problem.statementMd,
    deliverables: sub.problem.deliverables,
    explanation: sub.explanationText.slice(0, EXPLANATION_CAP),
    code: chunks.join("\n\n"),
    fileCount: tree.length,
    prevFeedback: (prev?.feedbackMd ?? "").slice(0, PREV_FEEDBACK_CAP),
    diff,
  };
}
