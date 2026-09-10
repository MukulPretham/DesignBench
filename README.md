# DesignBench — LLD Practice Platform

Signup → pick an LLD problem → upload a folder (`explanation.txt` + code) →
a LangGraph 3-pass senior-interviewer panel (approach → code audit → verdict)
reviews it → iterate per version. Ask follow-up questions on any verdict.

## Run locally

```bash
npm install
cp .env.example .env   # fill DATABASE_URL + LLM_* (see below)
npx prisma db push
npx tsx prisma/seed.ts # 5 LLD problems
npm run dev            # http://localhost:3000
```

Build check: `npm run build`.

## Environment

| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres. Neon pooler URLs must append `&pgbouncer=true&connection_limit=5` |
| `NEXTAUTH_SECRET` | yes | Any random string; placeholder ok for local dev |
| `NEXTAUTH_URL` | local | `http://localhost:3000` |
| `LLM_API_KEY` | for real reviews | Without it, evaluations return an honest automatic template |
| `LLM_MODEL` | no | Tested with `gemini-3.5-flash-lite` |
| `LLM_BASE_URL` | no | OpenAI-compatible; e.g. `https://generativelanguage.googleapis.com/v1beta/openai` |
| `UPLOAD_DIR` | no | Default `./uploads` (gitignored; code bytes live here, metadata in DB) |

## Key decisions

- **Next.js App Router + Postgres (Prisma 6).** Single repo, server components for
  pages, route handlers for APIs. Prisma pinned to v6 — v8's platform CLI didn't fit.
- **LangGraph `StateGraph`, linear A→B→C with retries.** Typed agent state, conditional
  edges retry malformed model JSON (max 3 tries) then fall back honestly. Plain `fetch`
  calls inside nodes — no LangChain model layer, fewer moving parts against the free tier.
- **Instant uploads, background eval.** `POST /api/submissions` returns `201 PENDING`;
  the graph runs in `after()`; the client polls until `DONE`. No stuck spinners.
- **Local-disk storage** (`uploads/{userId}/{submissionId}/`, path-preserving,
  `TestBench/`-style prefixes stripped). DB holds trees, explanations, feedback, traces.
- **Versioned threads, 20-version retention.** Oldest pruned automatically.

## Limitations

- Free-tier model latency: a full 3-pass eval takes ~1–2 min (poll window is 3 min).
- No code execution or tests — review is static (approach + code reading).
- `Ask` answers are ephemeral (not persisted); upload feedback is stored.
- Single-region Neon free Postgres; in-memory rate limits (10/min) reset on restart.
- Folder upload only (`webkitdirectory`); no zip, no GitHub import yet.

## AI usage

See [AI_USAGE.md](./AI_USAGE.md) for the documented AI-assisted decisions.
