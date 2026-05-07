import { NextRequest } from "next/server";
import { getBrevo, SENDER } from "@/lib/brevo";
import { BrevoError } from "@/lib/brevo-error";
import { rewriteTemplateVarsForBrevo } from "@/lib/template";

export async function GET() {
  try {
    const brevo = getBrevo();
    const res = await brevo.emailCampaigns.getEmailCampaigns({
      type: "classic",
      limit: 50,
      offset: 0,
    });
    const lists = await brevo.contacts.getLists({ limit: 50, offset: 0 });
    const listMap = new Map((lists.lists ?? []).map((l) => [l.id, l.name]));

    return Response.json(
      (res.campaigns ?? []).map((c) => {
        const listId = c.recipients?.lists?.[0] ?? 0;
        return {
          id: c.id,
          name: c.name,
          subject: c.subject ?? "",
          list_id: listId,
          template: c.htmlContent ?? "",
          status: mapStatus(c.status),
          scheduled_at: c.scheduledAt ?? "",
          sent_at: c.sentDate ?? "",
          sent_count: c.statistics?.globalStats?.sent ?? 0,
          created_at: c.createdAt,
          listName: listMap.get(listId) ?? "",
        };
      })
    );
  } catch (err) {
    return Response.json({ error: BrevoError.message(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { name, subject, list_id, template, scheduled_at } = await req.json();
  if (!name?.trim()) {
    return Response.json({ error: "캠페인명 필수" }, { status: 400 });
  }
  if (!list_id) {
    return Response.json({ error: "리스트 선택 필수" }, { status: 400 });
  }
  try {
    const brevo = getBrevo();
    const created = await brevo.emailCampaigns.createEmailCampaign({
      name: name.trim(),
      subject: subject?.trim() || name.trim(),
      htmlContent: rewriteTemplateVarsForBrevo(template || ""),
      sender: SENDER,
      recipients: { listIds: [Number(list_id)] },
      ...(scheduled_at ? { scheduledAt: toIsoZ(scheduled_at) } : {}),
    });
    return Response.json({ id: created.id });
  } catch (err) {
    return Response.json({ error: BrevoError.message(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { id, name, subject, list_id, template, scheduled_at } = await req.json();
  if (!id) return Response.json({ error: "id 필수" }, { status: 400 });
  try {
    const brevo = getBrevo();
    await brevo.emailCampaigns.updateEmailCampaign({
      campaignId: Number(id),
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(subject !== undefined ? { subject: subject.trim() } : {}),
      ...(template !== undefined
        ? { htmlContent: rewriteTemplateVarsForBrevo(template) }
        : {}),
      ...(list_id !== undefined
        ? { recipients: { listIds: [Number(list_id)] } }
        : {}),
      ...(scheduled_at ? { scheduledAt: toIsoZ(scheduled_at) } : {}),
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
    await brevo.emailCampaigns.deleteEmailCampaign({ campaignId: Number(id) });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: BrevoError.message(err) }, { status: 500 });
  }
}

function mapStatus(s: string | undefined): "draft" | "scheduled" | "sent" {
  if (s === "sent") return "sent";
  if (s === "queued" || s === "in_process") return "scheduled";
  return "draft";
}

// "2026-05-07T14:30" 같은 datetime-local 입력을 Brevo가 요구하는 ISO Z 형식으로 변환
function toIsoZ(value: string): string {
  if (!value) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toISOString();
}
