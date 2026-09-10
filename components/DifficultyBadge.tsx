const COLORS: Record<string, string> = {
  Easy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  Medium: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  Hard: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

export default function DifficultyBadge({ level }: { level: string }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        COLORS[level] ?? "border-zinc-600 bg-zinc-800 text-zinc-300"
      }`}
    >
      {level}
    </span>
  );
}
