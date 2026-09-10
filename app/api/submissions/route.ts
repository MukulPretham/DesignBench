import path from "node:path";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ALLOWED_EXTS, deleteSubmissionDir, sanitizeRelPath, saveSubmissionFiles } from "@/lib/storage";
import { evaluateSubmission } from "@/lib/agent";
import { rateLimit } from "@/lib/ratelimit";

const MAX_FILES = 100;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const MAX_PER_FILE_BYTES = 200 * 1024;
const MAX_VERSIONS = 20;

export async function GET(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const problemId = searchParams.get("problemId");
  if (!problemId) {
    return Response.json({ error: "problemId required" }, { status: 400 });
  }
  const submissions = await db.submission.findMany({
    where: { userId, problemId },
    orderBy: { version: "asc" },
    select: {
      id: true,
      version: true,
      status: true,
      feedbackMd: true,
      scoresJson: true,
      fileTreeJson: true,
      createdAt: true,
    },
  });
  return Response.json(submissions);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`upload:${userId}`, 10, 60_000)) {
    return Response.json({ error: "Too many uploads, slow down" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const problemId = form.get("problemId");
  if (typeof problemId !== "string" || !problemId) {
    return Response.json({ error: "problemId required" }, { status: 400 });
  }
  const problem = await db.problem.findUnique({ where: { id: problemId } });
  if (!problem) {
    return Response.json({ error: "Problem not found" }, { status: 404 });
  }

  const rawFiles = form.getAll("files").filter((f): f is File => f instanceof File);
  if (rawFiles.length === 0) {
    return Response.json({ error: "No files uploaded" }, { status: 400 });
  }
  if (rawFiles.length > MAX_FILES) {
    return Response.json(
      { error: `Too many files (max ${MAX_FILES})` },
      { status: 400 }
    );
  }

  const accepted: { relPath: string; bytes: Buffer }[] = [];
  let totalBytes = 0;
  for (const f of rawFiles) {
    const clean = sanitizeRelPath(f.name);
    if (!clean) continue; // skip ignored dirs / unsafe paths
    const ext = path.extname(clean).toLowerCase();
    if (ext && !ALLOWED_EXTS.has(ext)) continue;
    if (f.size > MAX_PER_FILE_BYTES) {
      return Response.json(
        { error: `File too large: ${clean} (max 200KB)` },
        { status: 400 }
      );
    }
    totalBytes += f.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return Response.json(
        { error: "Folder too large (max 3MB)" },
        { status: 400 }
      );
    }
    accepted.push({
      relPath: clean,
      bytes: Buffer.from(await f.arrayBuffer()),
    });
  }

  // Folder pickers send paths prefixed with the selected folder name
  // (e.g. "TestBench/explanation.txt"). If everything shares one top-level
  // folder and no root explanation.txt exists, strip that prefix.
  let explanation = accepted.find(
    (f) => f.relPath.toLowerCase() === "explanation.txt"
  );
  if (!explanation && accepted.length > 0) {
    const tops = accepted.map((f) => f.relPath.split("/")[0].toLowerCase());
    const singleRoot =
      tops.length > 0 &&
      tops.every((t) => t === tops[0]) &&
      accepted.every((f) => f.relPath.includes("/"));
    if (singleRoot) {
      const cut = accepted[0].relPath.indexOf("/") + 1;
      for (const f of accepted) f.relPath = f.relPath.slice(cut);
      explanation = accepted.find(
        (f) => f.relPath.toLowerCase() === "explanation.txt"
      );
    }
  }
  if (!explanation) {
    return Response.json(
      { error: "Folder must contain explanation.txt (select the folder that holds it)" },
      { status: 400 }
    );
  }
  if (accepted.length === 0) {
    return Response.json({ error: "No valid files" }, { status: 400 });
  }

  const last = await db.submission.findFirst({
    where: { userId, problemId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  const submission = await db.submission.create({
    data: {
      userId,
      problemId,
      version,
      status: "PENDING",
      explanationText: "",
      fileTreeJson: "[]",
      storagePath: "",
    },
    select: { id: true },
  });

  try {
    const { storagePath, fileTree } = await saveSubmissionFiles(
      userId,
      submission.id,
      accepted
    );
    await db.submission.update({
      where: { id: submission.id },
      data: {
        explanationText: explanation.bytes.toString("utf-8").slice(0, 20000),
        fileTreeJson: JSON.stringify(fileTree),
        storagePath,
      },
    });
    // Evaluation + retention run after the response, so upload feels instant.
    // Client polls GET thread until status flips PENDING -> DONE.
    after(async () => {
      try {
        await evaluateSubmission(submission.id);
        const all = await db.submission.findMany({
          where: { userId, problemId },
          orderBy: { version: "asc" },
          select: { id: true },
        });
        if (all.length > MAX_VERSIONS) {
          const stale = all.slice(0, all.length - MAX_VERSIONS);
          for (const s of stale) {
            await deleteSubmissionDir(userId, s.id).catch(() => {});
            await db.submission.delete({ where: { id: s.id } }).catch(() => {});
          }
        }
      } catch (e) {
        console.error(`background eval failed for ${submission.id}:`, e);
      }
    });
    return Response.json(
      { id: submission.id, version, status: "PENDING" },
      { status: 201 }
    );
  } catch (e) {
    await db.submission.delete({ where: { id: submission.id } }).catch(() => {});
    return Response.json(
      { error: e instanceof Error ? e.message : "Storage failed" },
      { status: 500 }
    );
  }
}
