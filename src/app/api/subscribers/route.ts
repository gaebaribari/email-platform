import { NextRequest } from "next/server";
import { db, dbReady } from "@/lib/db";
import { subscribers } from "@/lib/schema";
import { eq, like, and, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  await dbReady;
  const listId = req.nextUrl.searchParams.get("list_id");
  const search = req.nextUrl.searchParams.get("search");
  const status = req.nextUrl.searchParams.get("status");

  const conditions = [];

  if (listId) conditions.push(eq(subscribers.list_id, Number(listId)));
  if (status) conditions.push(eq(subscribers.status, status));
  if (search) {
    conditions.push(
      or(
        like(subscribers.email, `%${search}%`),
        like(subscribers.name, `%${search}%`)
      )
    );
  }

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(subscribers)
          .where(and(...conditions))
          .orderBy(subscribers.id)
      : await db.select().from(subscribers).orderBy(subscribers.id);

  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  await dbReady;
  const body = await req.json();

  // 일괄 추가 (CSV import용)
  if (Array.isArray(body.subscribers)) {
    const now = new Date().toISOString();
    const results = { added: 0, duplicates: 0, errors: [] as string[] };

    for (const sub of body.subscribers) {
      if (!sub.email?.trim()) continue;

      // 중복 체크
      const existing = await db
        .select()
        .from(subscribers)
        .where(
          and(
            eq(subscribers.email, sub.email.trim()),
            eq(subscribers.list_id, sub.list_id || body.list_id || 1)
          )
        );

      if (existing.length > 0) {
        results.duplicates++;
        continue;
      }

      await db.insert(subscribers).values({
        email: sub.email.trim(),
        name: sub.name?.trim() || "",
        list_id: sub.list_id || body.list_id || 1,
        status: "verified", // CSV import는 이미 동의한 것으로 간주
        gdpr_consent: true,
        subscribed_at: now,
        verified_at: now,
      });
      results.added++;
    }

    return Response.json(results);
  }

  // 단일 추가
  const { email, name, list_id } = body;
  if (!email?.trim()) {
    return Response.json({ error: "이메일 필수" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await db.insert(subscribers).values({
    email: email.trim(),
    name: name?.trim() || "",
    list_id: list_id || 1,
    status: "verified",
    gdpr_consent: true,
    subscribed_at: now,
    verified_at: now,
  });

  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await dbReady;
  const { id } = await req.json();
  if (!id) return Response.json({ error: "id 필수" }, { status: 400 });

  await db.delete(subscribers).where(eq(subscribers.id, id));
  return Response.json({ ok: true });
}
