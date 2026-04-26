import { NextRequest } from "next/server";
import { db, dbReady } from "@/lib/db";
import { campaigns, email_lists } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  await dbReady;
  const rows = await db.select().from(campaigns).orderBy(campaigns.id);

  // 리스트명 조인
  const lists = await db.select().from(email_lists);
  const listMap = new Map(lists.map((l) => [l.id, l.name]));

  return Response.json(
    rows.map((c) => ({ ...c, listName: listMap.get(c.list_id) || "" }))
  );
}

export async function POST(req: NextRequest) {
  await dbReady;
  const { name, subject, list_id, template, scheduled_at } = await req.json();

  if (!name?.trim()) {
    return Response.json({ error: "캠페인명 필수" }, { status: 400 });
  }

  const result = await db.insert(campaigns).values({
    name: name.trim(),
    subject: subject?.trim() || "",
    list_id: list_id || 1,
    template: template || "",
    status: scheduled_at ? "scheduled" : "draft",
    scheduled_at: scheduled_at || "",
    created_at: new Date().toISOString(),
  });

  return Response.json({ id: result[0].insertId });
}

export async function PUT(req: NextRequest) {
  await dbReady;
  const { id, ...fields } = await req.json();

  if (!id) return Response.json({ error: "id 필수" }, { status: 400 });

  const updateData: Record<string, string | number> = {};
  if (fields.name !== undefined) updateData.name = fields.name.trim();
  if (fields.subject !== undefined) updateData.subject = fields.subject.trim();
  if (fields.list_id !== undefined) updateData.list_id = fields.list_id;
  if (fields.template !== undefined) updateData.template = fields.template;
  if (fields.status !== undefined) updateData.status = fields.status;
  if (fields.scheduled_at !== undefined) updateData.scheduled_at = fields.scheduled_at;

  await db.update(campaigns).set(updateData).where(eq(campaigns.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await dbReady;
  const { id } = await req.json();
  if (!id) return Response.json({ error: "id 필수" }, { status: 400 });

  await db.delete(campaigns).where(eq(campaigns.id, id));
  return Response.json({ ok: true });
}
