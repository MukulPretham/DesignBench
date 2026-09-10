"use client";

import { useState } from "react";
import Markdown from "./Markdown";

type ThreadItem = {
  id: string;
  version: number;
  status: string;
  feedbackMd: string | null;
  scoresJson: string | null;
  fileTreeJson: string;
  explanationText: string;
  createdAt: string;
};

function scores(scoresJson: string | null): { label: string; value: number }[] {
  if (!scoresJson) return [];
  try {
    const s = JSON.parse(scoresJson) as Record<string, number>;
    const rows: [string, string][] = [
      ["oops", "OOP"],
      ["solid", "SOLID"],
      ["extensibility", "Ext"],
      ["clarity", "Clarity"],
    ];
    return rows
      .filter(([k]) => typeof s[k] === "number")
      .map(([k, label]) => ({ label, value: s[k] }));
  } catch {
    return [];
  }
}

function scoreColor(v: number): string {
  if (v >= 8) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  if (v >= 5) return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-rose-500/15 text-rose-300 border-rose-500/40";
}

function fileList(fileTreeJson: string): { path: string; size: number }[] {
  try {
    return JSON.parse(fileTreeJson || "[]");
  } catch {
    return [];
  }
}

function VersionBox({
  item,
  open,
  onToggle,
}: {
  item: ThreadItem;
  open: boolean;
  onToggle: () => void;
}) {
  const files = fileList(item.fileTreeJson);
  const sc = scores(item.scoresJson);
  const avg =
    sc.length > 0
      ? (sc.reduce((a, s) => a + s.value, 0) / sc.length).toFixed(1)
      : null;
  const pending = item.status === "PENDING";
  return (
    <div
      className={`overflow-hidden rounded-xl border transition ${
        open ? "border-indigo-500/50" : "border-zinc-800 hover:border-zinc-600"
      } bg-zinc-900/60`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-black">v{item.version}</span>
          <span
            className={`rounded-full border px-2 py-px text-xs font-semibold ${
              pending
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {pending ? "Evaluating…" : "Reviewed"}
          </span>
          {avg && (
            <span className="text-xs font-semibold text-zinc-300">
              avg {avg}/10
            </span>
          )}
          <span className="text-xs text-zinc-500">
            {new Date(item.createdAt).toLocaleString()}
          </span>
        </span>
        <span className="text-xs text-zinc-500">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-zinc-800 p-4">
          {sc.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sc.map((s) => (
                <span
                  key={s.label}
                  className={`rounded-md border px-2 py-0.5 text-xs font-bold ${scoreColor(s.value)}`}
                >
                  {s.label} {s.value}
                </span>
              ))}
            </div>
          )}
          <details className="rounded-lg bg-zinc-950/70 p-2.5">
            <summary className="cursor-pointer text-xs font-bold text-zinc-300">
              Files ({files.length}) + explanation.txt
            </summary>
            <ul className="slim-scroll mt-1.5 max-h-32 list-disc overflow-y-auto pl-5 text-xs text-zinc-400">
              {files.map((f) => (
                <li key={f.path} className="truncate">
                  {f.path}{" "}
                  <span className="opacity-50">
                    ({(f.size / 1024).toFixed(1)} KB)
                  </span>
                </li>
              ))}
            </ul>
            <pre className="slim-scroll mt-2 max-h-48 overflow-y-auto rounded bg-black/40 p-2 text-xs whitespace-pre-wrap text-zinc-300">
              {item.explanationText || "(no explanation)"}
            </pre>
          </details>
          {item.feedbackMd ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <Markdown text={item.feedbackMd} />
            </div>
          ) : (
            <p className="animate-pulse text-sm text-indigo-300">
              Panel is deliberating — this expands automatically when done…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatThread({ items }: { items: ThreadItem[] }) {
  const [openId, setOpenId] = useState<string | null>(
    items.length > 0 ? items[items.length - 1].id : null
  );
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center">
        <p className="text-2xl">📁</p>
        <p className="mt-2 text-sm font-semibold">No attempts yet</p>
        <p className="mt-1 text-sm text-zinc-400">
          Upload a folder with <code className="rounded bg-zinc-800 px-1">explanation.txt</code> + code
          above to start your first interview round.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        {items.length} {items.length === 1 ? "round" : "rounds"} — click a version to expand
      </p>
      {items.map((s) => (
        <VersionBox
          key={s.id}
          item={s}
          open={openId === s.id}
          onToggle={() => setOpenId(openId === s.id ? null : s.id)}
        />
      ))}
    </div>
  );
}
