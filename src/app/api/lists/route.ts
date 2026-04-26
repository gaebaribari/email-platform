import { NextRequest } from "next/server";
import { db, dbReady } from "@/lib/db";
import { email_lists, subscribers } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  await dbReady;
  const lists = await db.select().from(email_lists).orderBy(email_lists.id);

  // 각 리스트별 구독자 수 집계
  const counts = await db
    .select({
      list_id: subscribers.list_id,
      count: sql<number>`COUNT(*)`,
    })
    .from(subscribers)
    .groupBy(subscribers.list_id);

  const countMap = new Map(counts.map((c) => [c.list_id, c.count]));

  return Response.json(
    lists.map((list) => ({
      ...list,
      subscriberCount: countMap.get(list.id) || 0,
    }))
  );
}

export async function POST(req: NextRequest) {
  await dbReady;
  const { name, description } = await req.json();

  if (!name?.trim()) {
    return Response.json({ error: "리스트명은 필수입니다" }, { status: 400 });
  }

  const result = await db.insert(email_lists).values({
    name: name.trim(),
    description: description?.trim() || "",
    created_at: new Date().toISOString(),
  });

  return Response.json({ id: result[0].insertId, name });
}

export async function PUT(req: NextRequest) {
  await dbReady;
  const { id, name, description } = await req.json();

  if (!id) return Response.json({ error: "id 필수" }, { status: 400 });

  const updateData: Record<string, string> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description.trim();

  await db.update(email_lists).set(updateData).where(eq(email_lists.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await dbReady;
  const { id } = await req.json();

  if (!id) return Response.json({ error: "id 필수" }, { status: 400 });

  await db.delete(subscribers).where(eq(subscribers.list_id, id));
  await db.delete(email_lists).where(eq(email_lists.id, id));
  return Response.json({ ok: true });
}
