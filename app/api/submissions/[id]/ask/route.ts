import { z } from "zod";
import { auth } from "@/lib/auth";
import { askFollowUp } from "@/lib/agent";

const askSchema = z.object({
  question: z.string().min(1).max(2000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = askSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "question required" }, { status: 400 });
  }
  try {
    const answer = await askFollowUp(id, userId, parsed.data.question);
    return Response.json({ answer });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "Submission not found" ? 404 : msg === "AI evaluator not configured" ? 503 : 500;
    return Response.json({ error: msg }, { status });
  }
}
