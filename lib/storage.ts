import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredFile = { path: string; size: number };

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "__pycache__",
  ".DS_Store",
  ".next",
  "dist",
  "build",
]);

export const ALLOWED_EXTS = new Set([
  ".txt",
  ".md",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".java",
  ".go",
  ".rb",
  ".cs",
  ".cpp",
  ".c",
  ".h",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
]);

export function sanitizeRelPath(raw: string): string | null {
  const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return null;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.some((p) => p === "." || p === "..")) return null;
  if (parts.some((p) => IGNORED_DIRS.has(p))) return null;
  const clean = parts.join("/");
  if (clean.length > 256) return null;
  return clean;
}

function uploadRoot(): string {
  return process.env.UPLOAD_DIR || "./uploads";
}

export async function saveSubmissionFiles(
  userId: string,
  submissionId: string,
  files: { relPath: string; bytes: Buffer }[]
): Promise<{ storagePath: string; fileTree: StoredFile[] }> {
  const base = path.join(uploadRoot(), userId, submissionId);
  await mkdir(base, { recursive: true });
  const tree: StoredFile[] = [];
  for (const f of files) {
    const dest = path.join(base, f.relPath);
    if (!dest.startsWith(base + path.sep) && dest !== base) {
      throw new Error(`Unsafe path: ${f.relPath}`);
    }
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, f.bytes);
    tree.push({ path: f.relPath, size: f.bytes.length });
  }
  tree.sort((a, b) => a.path.localeCompare(b.path));
  return { storagePath: path.join(userId, submissionId), fileTree: tree };
}

export async function deleteSubmissionDir(userId: string, submissionId: string): Promise<void> {
  await rm(path.join(uploadRoot(), userId, submissionId), { recursive: true, force: true });
}
