import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { db } from "../db";
import { assembleContext, type EvalContext } from "./context";
import { callLLM } from "./llm";
import {
  PassError,
  buildPromptA,
  buildPromptB,
  buildPromptC,
  parseStrict,
  type PassA,
  type PassB,
  type PassC,
} from "./passes";
import { fallbackFeedback, renderFromPasses } from "./render";

/** Max tries per pass node: initial attempt + 2 retries, then fallback. */
const MAX_ATTEMPTS = 3;

const replace = <T>(x: T, y: T): T => (y === undefined ? x : y);

const AgentState = Annotation.Root({
  submissionId: Annotation<string>({ reducer: replace }),
  ctx: Annotation<EvalContext | null>({ reducer: replace, default: () => null }),
  passA: Annotation<PassA | null>({ reducer: replace, default: () => null }),
  passB: Annotation<PassB | null>({ reducer: replace, default: () => null }),
  passC: Annotation<PassC | null>({ reducer: replace, default: () => null }),
  attempts: Annotation<{ A: number; B: number; C: number }>({
    reducer: replace,
    default: () => ({ A: 0, B: 0, C: 0 }),
  }),
  failedPass: Annotation<string | null>({ reducer: replace, default: () => null }),
  error: Annotation<string | null>({ reducer: replace, default: () => null }),
  latencyMs: Annotation<Record<string, number>>({ reducer: replace, default: () => ({}) }),
});

type S = typeof AgentState.State;

function modelName(): string {
  return process.env.LLM_MODEL || "gpt-4o-mini";
}

function traceOf(state: S) {
  return {
    passA: state.passA,
    passB: state.passB,
    passC: state.passC,
    model: modelName(),
    latencyMs: state.latencyMs,
    attempts: state.attempts,
    ...(state.failedPass ? { failedPass: state.failedPass, error: state.error } : {}),
  };
}

// ---------- nodes ----------

async function assemble(state: S): Promise<Partial<S>> {
  const ctx = await assembleContext(state.submissionId);
  return { ctx };
}

async function approachA(state: S): Promise<Partial<S>> {
  const t0 = Date.now();
  const attempts = { ...state.attempts, A: state.attempts.A + 1 };
  try {
    const { system, user } = buildPromptA(state.ctx!);
    const raw = await callLLM(system, user, { maxTokens: 1000, temp: 0.5 });
    const passA = parseStrict<PassA>("A", raw);
    return {
      passA,
      attempts,
      failedPass: null,
      error: null,
      latencyMs: { ...state.latencyMs, A: Date.now() - t0 },
    };
  } catch (e) {
    return {
      attempts,
      failedPass: "A",
      error: e instanceof Error ? e.message : "unknown error",
      latencyMs: { ...state.latencyMs, A: Date.now() - t0 },
    };
  }
}

/** Retry only model flakes (malformed JSON); transport errors go straight to fallback. */
function routeA(state: S): "auditB" | "approachA" | "fallbackStore" {
  if (state.passA) return "auditB";
  const parseFlake = state.error?.includes("non-JSON") ?? false;
  if (parseFlake && state.attempts.A < MAX_ATTEMPTS) return "approachA";
  return "fallbackStore";
}

async function auditB(state: S): Promise<Partial<S>> {
  const t0 = Date.now();
  const attempts = { ...state.attempts, B: state.attempts.B + 1 };
  try {
    const { system, user } = buildPromptB(state.ctx!, state.passA!);
    const raw = await callLLM(system, user, { maxTokens: 2200, temp: 0.3 });
    const passB = parseStrict<PassB>("B", raw);
    return {
      passB,
      attempts,
      failedPass: null,
      error: null,
      latencyMs: { ...state.latencyMs, B: Date.now() - t0 },
    };
  } catch (e) {
    return {
      attempts,
      failedPass: "B",
      error: e instanceof Error ? e.message : "unknown error",
      latencyMs: { ...state.latencyMs, B: Date.now() - t0 },
    };
  }
}

function routeB(state: S): "verdictC" | "auditB" | "fallbackStore" {
  if (state.passB) return "verdictC";
  const parseFlake = state.error?.includes("non-JSON") ?? false;
  if (parseFlake && state.attempts.B < MAX_ATTEMPTS) return "auditB";
  return "fallbackStore";
}

async function verdictC(state: S): Promise<Partial<S>> {
  const t0 = Date.now();
  const attempts = { ...state.attempts, C: state.attempts.C + 1 };
  try {
    const { system, user } = buildPromptC(state.ctx!, state.passA!, state.passB!);
    const raw = await callLLM(system, user, { maxTokens: 600, temp: 0.2 });
    const passC = parseStrict<PassC>("C", raw);
    return {
      passC,
      attempts,
      failedPass: null,
      error: null,
      latencyMs: { ...state.latencyMs, C: Date.now() - t0 },
    };
  } catch (e) {
    return {
      attempts,
      failedPass: "C",
      error: e instanceof Error ? e.message : "unknown error",
      latencyMs: { ...state.latencyMs, C: Date.now() - t0 },
    };
  }
}

function routeC(state: S): "store" | "verdictC" | "fallbackStore" {
  if (state.passC) return "store";
  const parseFlake = state.error?.includes("non-JSON") ?? false;
  if (parseFlake && state.attempts.C < MAX_ATTEMPTS) return "verdictC";
  return "fallbackStore";
}

async function store(state: S): Promise<Partial<S>> {
  const fb = renderFromPasses(state.passB!, state.passC!);
  await db.submission.update({
    where: { id: state.submissionId },
    data: {
      status: "DONE",
      feedbackMd: fb.feedbackMd,
      scoresJson: fb.scoresJson,
      agentTraceJson: JSON.stringify(traceOf(state)),
    },
  });
  return {};
}

async function fallbackStore(state: S): Promise<Partial<S>> {
  const ctx = state.ctx;
  const fb = fallbackFeedback(ctx?.fileCount ?? 0, ctx?.explanation.length ?? 0);
  const reason = state.error ?? "unknown error";
  console.error(
    `evaluateSubmission ${state.submissionId} failed at node ${state.failedPass}: ${reason}`
  );
  await db.submission.update({
    where: { id: state.submissionId },
    data: {
      status: "DONE",
      feedbackMd: `${fb.feedbackMd}\n\n_AI evaluator error at pass ${state.failedPass} (logged): ${reason}_`,
      scoresJson: fb.scoresJson,
      agentTraceJson: JSON.stringify(traceOf(state)),
    },
  });
  return {};
}

// ---------- graph ----------

function buildGraph() {
  return new StateGraph(AgentState)
    .addNode("assemble", assemble)
    .addNode("approachA", approachA)
    .addNode("auditB", auditB)
    .addNode("verdictC", verdictC)
    .addNode("store", store)
    .addNode("fallbackStore", fallbackStore)
    .addEdge(START, "assemble")
    .addEdge("assemble", "approachA")
    .addConditionalEdges("approachA", routeA, {
      auditB: "auditB",
      approachA: "approachA",
      fallbackStore: "fallbackStore",
    })
    .addConditionalEdges("auditB", routeB, {
      verdictC: "verdictC",
      auditB: "auditB",
      fallbackStore: "fallbackStore",
    })
    .addConditionalEdges("verdictC", routeC, {
      store: "store",
      verdictC: "verdictC",
      fallbackStore: "fallbackStore",
    })
    .addEdge("store", END)
    .addEdge("fallbackStore", END)
    .compile();
}

const app = buildGraph();

/** Entry point used by the upload route (runs inside after()). */
export async function runEvaluation(submissionId: string): Promise<void> {
  if (!process.env.LLM_API_KEY) {
    const ctx = await assembleContext(submissionId);
    const fb = fallbackFeedback(ctx.fileCount, ctx.explanation.length);
    await db.submission.update({
      where: { id: submissionId },
      data: { status: "DONE", feedbackMd: fb.feedbackMd, scoresJson: fb.scoresJson },
    });
    return;
  }
  await app.invoke({ submissionId });
}
