import { db } from "@/lib/db";

export async function GET() {
  const problems = await db.problem.findMany({
    orderBy: { title: "asc" },
    select: {
      slug: true,
      title: true,
      difficulty: true,
      tags: true,
      _count: { select: { submissions: true } },
    },
  });
  return Response.json(problems);
}
