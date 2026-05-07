import { NextRequest } from "next/server";
import { getBrevo, getDefaultFolderId } from "@/lib/brevo";
import { BrevoError } from "@/lib/brevo-error";

export async function GET() {
  try {
    const brevo = getBrevo();
    const res = await brevo.contacts.getLists({ limit: 50, offset: 0 });
    const lists = res.lists ?? [];
    return Response.json(
      lists.map((l) => ({
        id: l.id,
        name: l.name,
        description: "",
        created_at: "",
        subscriberCount: l.totalSubscribers,
      }))
    );
  } catch (err) {
    return Response.json({ error: BrevoError.message(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) {
    return Response.json({ error: "리스트명은 필수입니다" }, { status: 400 });
  }
  try {
    const brevo = getBrevo();
    const folderId = await getDefaultFolderId();
    const created = await brevo.contacts.createList({
      folderId,
      name: name.trim(),
    });
    return Response.json({ id: created.id, name });
  } catch (err) {
    return Response.json({ error: BrevoError.message(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { id, name } = await req.json();
  if (!id) return Response.json({ error: "id 필수" }, { status: 400 });
  try {
    const brevo = getBrevo();
    await brevo.contacts.updateList({
      listId: Number(id),
      ...(typeof name === "string" ? { name: name.trim() } : {}),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: BrevoError.message(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return Response.json({ error: "id 필수" }, { status: 400 });
  try {
    const brevo = getBrevo();
    await brevo.contacts.deleteList({ listId: Number(id) });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: BrevoError.message(err) }, { status: 500 });
  }
}
