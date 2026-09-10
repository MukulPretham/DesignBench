# AI Usage Report — DesignBench

Tools used: Gemini (free tier, via API + web chat), ChatGPT, Muse Spark (in-editor agent).
How I worked: AI drafted options and boilerplate; I decided architecture, verified every
claim by running the app, and rejected suggestions that didn't fit the constraints.

## 1. Prisma version choice — rejected AI's default, verified manually
The AI-generated scaffold installed Prisma 8, whose CLI has no `generate` / `db push`
(they moved under platform commands). The assistant initially kept trying v8 commands.
I rejected that path: I checked `prisma --help` output myself, saw the CLI surface had
changed, and downgraded to pinned Prisma 6, which restored the classic workflow.
Why: the v8 platform model (projects, branches, cloud coupling) was wrong for a
single Postgres on Neon. Lesson applied: pin exact versions (`-E`) for fast-moving
ORM/agent libraries.

## 2. Neon pooler + Prisma connection exhaustion — accepted with modification
After load testing I hit `P2024: timed out fetching a connection` (pool limit 17).
AI diagnosis (pooler endpoint needs `pgbouncer=true`, app opens a client per HMR
instance + polling) was correct and I accepted the fix, but I modified the numbers:
AI suggested `connection_limit=15`; I set `5` because the pooler is shared and the
app's queries are short-lived. I also eased client polling 2s → 3s on my own
judgement to reduce churn. Verified with 6 rapid sequential page loads, all 200.

## 3. LangGraph adoption — accepted the shape, rejected the machinery
AI proposed the 3-pass interviewer (approach → code audit → verdict) and I accepted
the *architecture*, but rejected the first implementation sketch that pulled in
LangChain chat models (`ChatOpenAI` + structured-output helpers). Reason: our Gemini
free-tier key was already proven working over plain `fetch` to the OpenAI-compatible
endpoint, and swapping model layers would have meant re-verifying auth, JSON mode,
and error shapes. So: LangGraph `StateGraph` for orchestration (typed state,
conditional retry edges), plain fetch inside nodes. State machine where it pays,
boring HTTP where it doesn't.

## 4. Gemini model selection — AI suggestion was stale, corrected by experiment
The assistant's first recommendation (`gemini-2.0-flash`) 404'd. Instead of trusting
docs from memory, I probed the API directly with curl across candidate model names
and found the 2.x line retired; `gemini-3.5-flash-lite` returned 200. I also isolated
a second 404 to a double slash in our constructed URL (`openai/` + `/chat/...`) by
testing payloads field-by-field, then fixed it in `.env` and added a trailing-slash
guard in code. Accepted: nothing on authority; every endpoint claim earned via curl.

## 5. Upload UX (blocking eval → background + poll) — my call, AI implemented
Users reported the Upload button "hanging". My decision: evaluation must leave the
request path (respond `201 PENDING` immediately, run the graph in `after()`, client
polls). I rejected the AI's alternative (server-sent events) as over-engineering for
a 1–2 min job — polling the existing thread endpoint needed no new protocol and
degrades gracefully ("refresh to check" past timeout). AI did the refactor; I
verified PENDING-then-DONE timing across five live uploads before keeping it.

## Standing rules I kept throughout
- No AI claim merged without a live run (every phase ended in `npm run build` + curl E2E).
- Secrets never pasted into prompts beyond the local `.env`; the committed repo contains no keys.
- When docs and behavior disagreed (Prisma 8 CLI, Gemini model names), behavior won.
