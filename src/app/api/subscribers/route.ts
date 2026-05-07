import { NextRequest } from "next/server";
import { ensureAttributes, getBrevo, normalizeContact, statusOf } from "@/lib/brevo";
import { BrevoError } from "@/lib/brevo-error";

// Brevo Contacts 기준으로 구독자 목록을 반환 (search/status는 클라이언트측 필터)
export async function GET(req: NextRequest) {
  const listId = req.nextUrl.searchParams.get("list_id");
  const search = req.nextUrl.searchParams.get("search")?.toLowerCase() ?? "";
  const status = req.nextUrl.searchParams.get("status");

  try {
    const brevo = getBrevo();
    const limit = 500;
    const res = listId
      ? await brevo.contacts.getContactsFromList({ listId: Number(listId), limit, offset: 0 })
      : await brevo.contacts.getContacts({ limit, offset: 0 });

    const contacts = (res.contacts ?? []).map((c) =>
      normalizeContact(c as never)
    );

    const filtered = contacts.filter((c) => {
      const s = statusOf(c);
      if (status && s !== status) return false;
      if (search) {
        const haystack = `${c.email} ${c.name}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    return Response.json(
      filtered.map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        list_ids: c.list_ids,
        list_id: c.list_ids[0] ?? 0,
        status: statusOf(c),
        gdpr_consent:
          typeof c.attributes.GDPR_CONSENT === "boolean"
            ? c.attributes.GDPR_CONSENT
            : true,
        subscribed_at: c.createdAt,
        verified_at:
          typeof c.attributes.VERIFIED_AT === "string"
            ? c.attributes.VERIFIED_AT
            : c.createdAt,
      }))
    );
  } catch (err) {
    return Response.json({ error: BrevoError.message(err) }, { status: 500 });
  }
}

// 단일 추가 또는 CSV 일괄 추가 (어드민용 - 인증 절차 생략, GDPR_CONSENT=true로 가정)
export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    await ensureAttributes();
    const brevo = getBrevo();

    if (Array.isArray(body.subscribers)) {
      const targetList = body.list_id ? Number(body.list_id) : undefined;
      const results = { added: 0, duplicates: 0, errors: [] as string[] };

      for (const sub of body.subscribers) {
        const email = sub.email?.trim();
        if (!email || !email.includes("@")) continue;

        const listIds = targetList ? [targetList] : sub.list_id ? [Number(sub.list_id)] : [];
        try {
          await brevo.contacts.createContact({
            email,
            listIds,
            updateEnabled: true,
            attributes: {
              NAME: sub.name?.trim() || "",
              GDPR_CONSENT: true,
              VERIFIED_AT: new Date().toISOString().slice(0, 10),
            },
          });
          results.added++;
        } catch (err) {
          const msg = BrevoError.message(err);
          if (msg.toLowerCase().includes("already")) results.duplicates++;
          else results.errors.push(`${email}: ${msg}`);
        }
      }
      return Response.json(results);
    }

    const { email, name, list_id } = body;
    if (!email?.trim()) {
      return Response.json({ error: "이메일 필수" }, { status: 400 });
    }
    await brevo.contacts.createContact({
      email: email.trim(),
      listIds: list_id ? [Number(list_id)] : [],
      updateEnabled: true,
      attributes: {
        NAME: name?.trim() || "",
        GDPR_CONSENT: true,
        VERIFIED_AT: new Date().toISOString().slice(0, 10),
      },
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: BrevoError.message(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { id, email } = await req.json();
  if (!id && !email) {
    return Response.json({ error: "id 또는 email 필수" }, { status: 400 });
  }
  try {
    const brevo = getBrevo();
    if (id) {
      await brevo.contacts.deleteContact({
        identifier: Number(id),
        identifierType: "contact_id",
      });
    } else {
      await brevo.contacts.deleteContact({
        identifier: email,
        identifierType: "email_id",
      });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: BrevoError.message(err) }, { status: 500 });
  }
}
