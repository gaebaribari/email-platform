import { NextRequest } from "next/server";
import { ensureAttributes, getBrevo } from "@/lib/brevo";
import { BrevoError } from "@/lib/brevo-error";
import type { TargetRecord } from "@/lib/migration/types";

export const runtime = "nodejs";

// 공개 데모에선 방문자가 실제 Brevo 계정을 오염시키지 못하도록 쓰기를 시뮬레이션한다.
// (읽기는 그대로 실데이터. 로컬/실운영에선 DEMO_MODE 미설정 → 실제 적재.)
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// 정규화한 country 를 Brevo Contact 속성으로 보존하기 위해 COUNTRY 속성을 보장한다.
let _countryEnsured = false;
async function ensureCountryAttribute() {
  if (_countryEnsured) return;
  const brevo = getBrevo();
  try {
    await brevo.contacts.createAttribute({
      attributeCategory: "normal",
      attributeName: "COUNTRY",
      type: "text",
    });
  } catch {
    // 이미 존재하면 무시
  }
  _countryEnsured = true;
}

// 마이그레이션 commit: 검증을 통과한 레코드만 실제로 Brevo에 적재한다.
// 메일은 보내지 않는다 (createContact 만 호출) → 발송 쿼터에 영향 없음.
export async function POST(req: NextRequest) {
  try {
    const { records } = (await req.json()) as { records?: TargetRecord[] };
    if (!Array.isArray(records) || records.length === 0) {
      return Response.json({ error: "records 가 비어 있습니다" }, { status: 400 });
    }

    if (DEMO_MODE) {
      // Brevo에 쓰지 않고 성공만 흉내낸다.
      const added = records.filter((r) => r.email?.includes("@")).length;
      return Response.json({ added, duplicates: 0, errors: [], demo: true });
    }

    await ensureAttributes();
    await ensureCountryAttribute();
    const brevo = getBrevo();

    const result = { added: 0, duplicates: 0, errors: [] as string[] };
    for (const rec of records) {
      const email = rec.email?.trim();
      if (!email || !email.includes("@")) continue;
      try {
        await brevo.contacts.createContact({
          email,
          updateEnabled: true,
          attributes: {
            NAME: rec.name?.trim() || "",
            COUNTRY: rec.country || "",
            GDPR_CONSENT: true,
            VERIFIED_AT: new Date().toISOString().slice(0, 10),
          },
        });
        result.added++;
      } catch (err) {
        const msg = BrevoError.message(err);
        if (msg.toLowerCase().includes("already")) result.duplicates++;
        else result.errors.push(`${email}: ${msg}`);
      }
    }
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: BrevoError.message(err) }, { status: 500 });
  }
}

// 정리용: 방금 적재한 레코드를 이메일로 일괄 삭제 (테스트 데이터 청소).
export async function DELETE(req: NextRequest) {
  try {
    const { emails } = (await req.json()) as { emails?: string[] };
    if (!Array.isArray(emails) || emails.length === 0) {
      return Response.json({ error: "emails 가 비어 있습니다" }, { status: 400 });
    }
    if (DEMO_MODE) {
      return Response.json({ deleted: emails.length, demo: true });
    }
    const brevo = getBrevo();
    let deleted = 0;
    for (const email of emails) {
      try {
        await brevo.contacts.deleteContact({
          identifier: email,
          identifierType: "email_id",
        });
        deleted++;
      } catch {
        // 이미 없으면 무시
      }
    }
    return Response.json({ deleted });
  } catch (err) {
    return Response.json({ error: BrevoError.message(err) }, { status: 500 });
  }
}
