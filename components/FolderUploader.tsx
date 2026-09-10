"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_FILES = 100;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const POLL_MS = 3000;
const POLL_TIMEOUT_MS = 180000;

const rel = (f: File) =>
  (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;

export default function FolderUploader({ problemId }: { problemId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "uploading" | "evaluating">("idle");

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const picked = Array.from(e.target.files ?? []);
    // reset so picking the same folder again still fires onChange
    e.target.value = "";
    if (picked.length === 0) return;
    if (picked.length > MAX_FILES) {
      setError(`Too many files (max ${MAX_FILES})`);
      return;
    }
    const total = picked.reduce((n, f) => n + f.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      setError("Folder too large (max 3MB)");
      return;
    }
    const hasExplanation = picked.some((f) =>
      rel(f).toLowerCase().endsWith("explanation.txt")
    );
    if (!hasExplanation) {
      setError("Folder must contain explanation.txt");
      return;
    }
    setFiles(picked);
  }

  async function waitForDone(version: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < POLL_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      try {
        const res = await fetch(
          `/api/submissions?problemId=${problemId}`,
          { cache: "no-store" }
        );
        if (!res.ok) continue;
        const list = (await res.json()) as { version: number; status: string }[];
        const mine = list.find((s) => s.version === version);
        if (mine && mine.status !== "PENDING") return true;
      } catch {
        /* keep polling */
      }
    }
    return false;
  }

  async function onUpload() {
    if (files.length === 0 || phase !== "idle") return;
    setError("");
    setPhase("uploading");
    try {
      const form = new FormData();
      form.append("problemId", problemId);
      for (const f of files) form.append("files", f, rel(f));
      const res = await fetch("/api/submissions", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        setPhase("idle");
        return;
      }
      // Upload stored instantly; evaluation runs in background.
      const version = data.version as number;
      setFiles([]);
      setPhase("evaluating");
      router.refresh();
      const done = await waitForDone(version);
      if (!done) {
        setError("Taking longer than expected — refresh the page to check.");
      }
      router.refresh();
    } catch {
      setError("Upload failed (network)");
    } finally {
      setPhase("idle");
    }
  }

  const total = files.reduce((n, f) => n + f.size, 0);
  const busy = phase !== "idle";

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">Submit your solution</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50"
        >
          Choose folder…
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        // @ts-expect-error webkitdirectory is non-standard but supported
        webkitdirectory=""
        multiple
        onChange={onPick}
        className="hidden"
      />
      <p className="text-xs text-zinc-400">
        Select the folder holding <code className="rounded bg-zinc-800 px-1 text-zinc-200">explanation.txt</code> + code.
        Max {MAX_FILES} files / 3MB.
      </p>
      {files.length > 0 && (
        <div className="rounded-lg bg-zinc-950/70 p-2.5 text-xs text-zinc-300">
          <p className="font-semibold text-zinc-200">
            {files.length} files · {(total / 1024).toFixed(1)} KB — ready
          </p>
          <ul className="slim-scroll mt-1 max-h-24 list-disc overflow-y-auto pl-5 text-zinc-400">
            {files.slice(0, 8).map((f) => (
              <li key={rel(f)} className="truncate">
                {rel(f)}
              </li>
            ))}
            {files.length > 8 && <li>…and {files.length - 8} more</li>}
          </ul>
        </div>
      )}
      {phase === "evaluating" && (
        <p className="animate-pulse text-sm font-medium text-indigo-300">
          Interview panel deliberating… feedback lands below shortly.
        </p>
      )}
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <button
        onClick={onUpload}
        disabled={files.length === 0 || busy}
        className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-40"
      >
        {phase === "uploading"
          ? "Uploading…"
          : phase === "evaluating"
            ? "Evaluating…"
            : `Upload & get feedback${files.length > 0 ? ` (${files.length} files)` : ""}`}
      </button>
    </div>
  );
}
