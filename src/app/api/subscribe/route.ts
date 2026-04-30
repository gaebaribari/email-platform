import { NextRequest } from "next/server";
import { db, dbReady } from "@/lib/db";
import { subscribers } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { sendVerificationEmail } from "@/lib/email";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30분

// POST: 구독 신청 (더블옵트인 1단계 - pending 상태로 저장)
export async function POST(req: NextRequest) {
  await dbReady;
  const body = await req.json();
  const { email: rawEmail, name, list_id, gdpr_consent } = body;

  if (!rawEmail?.trim()) {
    return Response.json({ error: "이메일은 필수입니다" }, { status: 400 });
  }

  if (!gdpr_consent) {
    return Response.json(
      { error: "개인정보 수집에 동의해주세요" },
      { status: 400 }
    );
  }

  const email = rawEmail.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  // 중복 체크 (같은 리스트에 같은 이메일)
  const existing = await db
    .select()
    .from(subscribers)
    .where(
      and(eq(subscribers.email, email), eq(subscribers.list_id, list_id || 1))
    );

  if (existing.length > 0) {
    const sub = existing[0];
    if (sub.status === "verified") {
      return Response.json(
        { error: "이미 구독 중인 이메일입니다" },
        { status: 409 }
      );
    }
    // pending 상태면 토큰 갱신
    const newToken = randomUUID();
    await db
      .update(subscribers)
      .set({
        token: newToken,
        token_expires_at: expiresAt,
        subscribed_at: new Date().toISOString(),
      })
      .where(eq(subscribers.id, sub.id));

    try {
      const result = await sendVerificationEmail(
        email,
        sub.name || "",
        newToken
      );
      if (!result.sent) {
        console.log(`  (dev fallback) 인증 링크: ${result.verifyUrl}`);
      }
      return Response.json({
        ok: true,
        message: "인증 메일이 재발송되었습니다 (30분 내 인증)",
      });
    } catch (err) {
      console.error("[Brevo] 메일 재발송 실패:", err);
      return Response.json(
        { error: "메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요." },
        { status: 502 }
      );
    }
  }

  // 새 구독자 등록 (pending)
  const token = randomUUID();
  const now = new Date().toISOString();

  await db.insert(subscribers).values({
    email,
    name: name?.trim() || "",
    list_id: list_id || 1,
    status: "pending",
    token,
    token_expires_at: expiresAt,
    gdpr_consent: true,
    subscribed_at: now,
  });

  try {
    const result = await sendVerificationEmail(email, name?.trim() || "", token);
    if (!result.sent) {
      console.log(`  (dev fallback) 인증 링크: ${result.verifyUrl}`);
    }
    return Response.json({
      ok: true,
      message: "인증 메일이 발송되었습니다 (30분 내 인증)",
    });
  } catch (err) {
    console.error("[Brevo] 메일 발송 실패:", err);
    return Response.json(
      { error: "메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 502 }
    );
  }
}

// GET: 이메일 인증 (더블옵트인 2단계 - verified로 변경)
export async function GET(req: NextRequest) {
  await dbReady;
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return Response.json({ error: "토큰이 없습니다" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.token, token));

  if (rows.length === 0) {
    return Response.json(
      { error: "유효하지 않은 인증 링크입니다" },
      { status: 404 }
    );
  }

  const sub = rows[0];
  if (sub.status === "verified") {
    return Response.json({ ok: true, message: "이미 인증된 이메일입니다" });
  }

  // 토큰 만료 체크 (30분)
  if (
    sub.token_expires_at &&
    new Date(sub.token_expires_at).getTime() < Date.now()
  ) {
    return Response.json(
      {
        error:
          "인증 링크가 만료되었습니다 (발송 후 30분 경과).\n다시 구독 신청해주세요.",
      },
      { status: 410 }
    );
  }

  await db
    .update(subscribers)
    .set({
      status: "verified",
      verified_at: new Date().toISOString(),
      token: "",
      token_expires_at: "",
    })
    .where(eq(subscribers.id, sub.id));

  return Response.json({ ok: true, message: "이메일 인증이 완료되었습니다" });
}
