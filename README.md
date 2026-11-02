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

## Architecture & how it works

### System overview

```
Browser ── fetch / multipart POST ──▶ Next.js (App Router, Node runtime)
  /signup /login              lib/auth.ts    Auth.js v5 Credentials (bcrypt-12, JWT)
  /problems                   lib/db.ts      Prisma 6 → Postgres (Neon pooler)
  /problems/[slug]            lib/storage.ts local disk: uploads/{userId}/{submissionId}/
                              lib/ratelimit  in-memory 10/min guards
                              lib/agent/*    LangGraph StateGraph → Gemini (OpenAI-compat)
```

No edge middleware (removed — it bloated the edge bundle past 1 MB).
Auth is enforced server-side: pages `redirect("/login")`, APIs return 401.

### Request flows

**Auth.** `POST /api/auth/signup` (zod-validated, bcrypt-12 hash) → auto
`signIn("credentials")` → JWT session cookie. `authorize()` compares hashes and
rate-limits per email. Session is read via `auth()` in every page/route.

**Problems.** Seeded rows (`npx tsx prisma/seed.ts`). `GET /api/problems` lists;
`/problems/[slug]` server-renders statement markdown (left) + the user's
version thread (right). List page annotates each card with `Attempted · vN`.

**Upload → evaluate (the core loop).**
1. Client (`FolderUploader`) picks a directory (`webkitdirectory`), pre-checks
   `explanation.txt` + caps (100 files / 3MB / 200KB per file), sends
   `multipart/form-data` with relative paths preserved.
2. `POST /api/submissions`: auth → validate `problemId` → sanitize paths
   (blocks `..`, drops `node_modules/.git/__pycache__`, allowlists code exts)
   → strip shared top-level folder prefix (`TestBench/x` → `x`) → `version =
   max+1` → write to `uploads/{userId}/{submissionId}/` → persist
   `explanationText + fileTreeJson + storagePath` as `PENDING`.
3. Route returns `201 {id, version, PENDING}` **immediately**; the agent graph
   runs in `after()` (background). Client polls `GET
   /api/submissions?problemId=` every 3s until status flips `DONE`, then
   re-renders. Poll timeout 3 min, then "refresh to check".
4. Retention: after each eval, versions beyond the latest 20 are pruned
   (rows + dirs).

**Ask follow-ups.** `POST /api/submissions/[id]/ask {question}` answers from the
stored interview trace summary (gaps + cons + verdict). Ephemeral — not persisted.

### The agent graph (`lib/agent/`)

```
assembleContext ─▶ approachA ─▶ auditB ─▶ verdictC ─▶ store
                      │ retry     │ retry     │ retry   (malformed JSON only,
                      └───────────┴───────────┴──▶ fallbackStore  max 3 tries)
```

- `context.ts` — assembles once per eval: explanation (8k chars), code
  (30k chars / 50 files, `--- path ---` headers), previous verdict (1k),
  zero-cost file-list diff vs vN-1. Shared by all nodes.
- **Pass A — approach interview** (`temp 0.5`): entities, pattern choices +
  credibility, gaps, `approachScore`, and 3–5 `questionsForCode` the audit must
  answer. No code seen.
- **Pass B — code audit** (`temp 0.3`): answers A's questions against actual
  files, verifies claims (holds/partial/contradicted), emits pros, severity-tagged
  cons with file cites, improvements with examples. May reference **only** files
  in the provided tree — the anti-hallucination guardrail.
- **Pass C — verdict synthesis** (`temp 0.2`): merges A+B (code evidence beats
  claims), top-3 blockers, hire-style verdict + single next step, final scores
  (bar: 8+ pass, 5–7 fixable, ≤4 rework).
- `store` renders the deterministic markdown template (Pros/Cons/Improvements/
  Top blockers/Final/Scores) and writes `DONE + feedbackMd + scoresJson +
  agentTraceJson` (per-pass outputs, latencies, retry counts — the future eval
  harness). `fallbackStore` writes the honest automatic template annotated with
  the failing node + reason. No key at all → fallback without invoking the graph.

### Data model (Prisma)

- `User(id, email unique, passwordHash, name?, createdAt)` → `Submission[]`
- `Problem(id, slug unique, title, difficulty, tags[], statementMd, deliverables)` → `Submission[]`
- `Submission(id, userId, problemId, version, explanationText, fileTreeJson,
  storagePath, status PENDING|DONE|FAILED, feedbackMd?, scoresJson?,
  agentTraceJson?, createdAt)` · unique `(userId, problemId, version)`
- The chat thread is derived: `Submission[] ORDER BY version` (no message table).

### UI map

- `app/page.tsx` landing hero · `app/problems` cards (difficulty pills, tags,
  attempted state) · `app/problems/[slug]` split view (statement pane +
  uploader + ask + collapsible version boxes with score chips).
- `components/Markdown.tsx` — shared GitHub-style renderer (typography plugin)
  for statements, feedback, and answers. `Navbar` adapts to session.

## AI usage report

Tools used: Gemini (free tier, via API + web chat), ChatGPT, Muse Spark (in-editor agent).
How I worked: AI drafted options and boilerplate; I decided architecture, verified every
claim by running the app, and rejected suggestions that didn't fit the constraints.

### 1. Prisma version choice — rejected AI's default, verified manually
The AI-generated scaffold installed Prisma 8, whose CLI has no `generate` / `db push`
(they moved under platform commands). The assistant initially kept trying v8 commands.
I rejected that path: I checked `prisma --help` output myself, saw the CLI surface had
changed, and downgraded to pinned Prisma 6, which restored the classic workflow.
Why: the v8 platform model (projects, branches, cloud coupling) was wrong for a
single Postgres on Neon. Lesson applied: pin exact versions (`-E`) for fast-moving
ORM/agent libraries.

### 2. Neon pooler + Prisma connection exhaustion — accepted with modification
After load testing I hit `P2024: timed out fetching a connection` (pool limit 17).
AI diagnosis (pooler endpoint needs `pgbouncer=true`, app opens a client per HMR
instance + polling) was correct and I accepted the fix, but I modified the numbers:
AI suggested `connection_limit=15`; I set `5` because the pooler is shared and the
app's queries are short-lived. I also eased client polling 2s → 3s on my own
judgement to reduce churn. Verified with 6 rapid sequential page loads, all 200.

### 3. LangGraph adoption — accepted the shape, rejected the machinery
AI proposed the 3-pass interviewer (approach → code audit → verdict) and I accepted
the *architecture*, but rejected the first implementation sketch that pulled in
LangChain chat models (`ChatOpenAI` + structured-output helpers). Reason: our Gemini
free-tier key was already proven working over plain `fetch` to the OpenAI-compatible
endpoint, and swapping model layers would have meant re-verifying auth, JSON mode,
and error shapes. So: LangGraph `StateGraph` for orchestration (typed state,
conditional retry edges), plain fetch inside nodes. State machine where it pays,
boring HTTP where it doesn't.

### 4. Gemini model selection — AI suggestion was stale, corrected by experiment
The assistant's first recommendation (`gemini-2.0-flash`) 404'd. Instead of trusting
docs from memory, I probed the API directly with curl across candidate model names
and found the 2.x line retired; `gemini-3.5-flash-lite` returned 200. I also isolated
a second 404 to a double slash in our constructed URL (`openai/` + `/chat/...`) by
testing payloads field-by-field, then fixed it in `.env` and added a trailing-slash
guard in code. Accepted: nothing on authority; every endpoint claim earned via curl.

### 5. Upload UX (blocking eval → background + poll) — my call, AI implemented
Users reported the Upload button "hanging". My decision: evaluation must leave the
request path (respond `201 PENDING` immediately, run the graph in `after()`, client
polls). I rejected the AI's alternative (server-sent events) as over-engineering for
a 1–2 min job — polling the existing thread endpoint needed no new protocol and
degrades gracefully ("refresh to check" past timeout). AI did the refactor; I
verified PENDING-then-DONE timing across five live uploads before keeping it.

### Standing rules I kept throughout
- No AI claim merged without a live run (every phase ended in `npm run build` + curl E2E).
- Secrets never pasted into prompts beyond the local `.env`; the committed repo contains no keys.
- When docs and behavior disagreed (Prisma 8 CLI, Gemini model names), behavior won.
