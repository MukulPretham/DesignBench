import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const problem = await db.problem.findUnique({ where: { slug } });
  if (!problem) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(problem);
}
