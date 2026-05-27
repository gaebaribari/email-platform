import { NextRequest } from "next/server";
import { sendVerificationEmail } from "@/lib/email";
import { signVerifyToken, verifyVerifyToken } from "@/lib/jwt";
import { ensureAttributes, getBrevo, getDefaultFolderId } from "@/lib/brevo";
import { BrevoError } from "@/lib/brevo-error";

// 더블옵트인 1단계: JWT 발급 + 인증 메일 발송. Brevo Contact 생성은 인증 후 단계로 미룬다.
export async function POST(req: NextRequest) {
  const { email, name, list_id, gdpr_consent } = await req.json();

  if (!email?.trim()) {
    return Response.json({ error: "이메일은 필수입니다" }, { status: 400 });
  }
  if (!gdpr_consent) {
    return Response.json(
      { error: "개인정보 수집 동의가 필요합니다" },
      { status: 400 }
    );
  }

  let targetListId: number;
  try {
    targetListId = await resolveListId(list_id);
  } catch (err) {
    console.error("[Brevo] 리스트 조회/생성 실패:", err);
    return Response.json(
      { error: BrevoError.message(err) || "리스트 처리 실패" },
      { status: 500 }
    );
  }

  const token = signVerifyToken({
    email: email.trim().toLowerCase(),
    name: name?.trim() || "",
    list_id: targetListId,
    gdpr_consent: Boolean(gdpr_consent),
  });

  try {
    const result = await sendVerificationEmail(
      email.trim(),
      name?.trim() || "",
      token
    );
    console.log(
      `[Double Opt-in] 인증 메일 ${result.sent ? "발송" : "스킵"}: ${email}`
    );
  } catch (err) {
    console.error("[Brevo] 메일 발송 실패:", err);
    return Response.json(
      { error: "메일 발송에 실패했습니다" },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, message: "인증 메일이 발송되었습니다" });
}

// 더블옵트인 2단계: JWT 검증 → Brevo Contact 생성/업데이트하여 listIds에 추가
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return Response.json({ error: "토큰이 필요합니다" }, { status: 400 });
  }

  const payload = verifyVerifyToken(token);
  if (!payload) {
    return Response.json(
      { error: "유효하지 않거나 만료된 토큰입니다" },
      { status: 400 }
    );
  }

  // 데모 모드: Brevo에 쓰지 않고, 페이로드를 돌려줘 클라이언트가 localStorage에 담게 한다.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return Response.json({
      ok: true,
      demo: true,
      email: payload.email,
      name: payload.name,
      message: "이메일 인증이 완료되었습니다",
    });
  }

  try {
    await ensureAttributes();
    const brevo = getBrevo();
    await brevo.contacts.createContact({
      email: payload.email,
      listIds: [payload.list_id],
      updateEnabled: true,
      attributes: {
        NAME: payload.name,
        GDPR_CONSENT: payload.gdpr_consent,
        VERIFIED_AT: new Date().toISOString().slice(0, 10),
      },
    });
  } catch (err) {
    console.error("[Brevo] Contact 생성/업데이트 실패:", err);
    return Response.json(
      { error: BrevoError.message(err) || "구독 처리에 실패했습니다" },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, message: "이메일 인증이 완료되었습니다" });
}

// 요청한 list_id가 없거나 0이면 첫 번째 리스트(없으면 자동 생성)에 매핑
async function resolveListId(requested: unknown): Promise<number> {
  if (typeof requested === "number" && requested > 0) return requested;
  const brevo = getBrevo();
  const lists = await brevo.contacts.getLists({ limit: 1, offset: 0 });
  const first = lists.lists?.[0];
  if (first?.id) return first.id;
  const folderId = await getDefaultFolderId();
  const created = await brevo.contacts.createList({
    folderId,
    name: "Default Newsletter",
  });
  return created.id;
}
