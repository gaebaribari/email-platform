import { db, dbReady } from "@/lib/db";
import { campaigns, subscribers } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbReady;
  const { id } = await params;
  const campaignId = Number(id);

  // 캠페인 조회
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));

  if (!campaign) {
    return Response.json({ error: "캠페인을 찾을 수 없습니다" }, { status: 404 });
  }

  if (campaign.status === "sent") {
    return Response.json({ error: "이미 발송된 캠페인입니다" }, { status: 400 });
  }

  // 인증 완료된 구독자만 조회
  const verifiedSubs = await db
    .select()
    .from(subscribers)
    .where(
      and(
        eq(subscribers.list_id, campaign.list_id),
        eq(subscribers.status, "verified")
      )
    );

  if (verifiedSubs.length === 0) {
    return Response.json(
      { error: "발송 대상 구독자가 없습니다" },
      { status: 400 }
    );
  }

  // 각 구독자에게 변수 치환하여 이메일 발송 (시뮬레이션)
  for (const sub of verifiedSubs) {
    let html = campaign.template;
    html = html.replaceAll("{{name}}", sub.name || "구독자");
    html = html.replaceAll("{{email}}", sub.email);
    html = html.replaceAll("{{list_name}}", "뉴스레터");
    html = html.replaceAll("{{unsubscribe_url}}", `/api/subscribe/unsubscribe?email=${sub.email}`);

    // 실제로는 Sendgrid/Brevo API 호출
    console.log(`[Email Send] To: ${sub.email}, Subject: ${campaign.subject}`);
    console.log(`  Template variables replaced for: ${sub.name || sub.email}`);
  }

  // 캠페인 상태 업데이트
  const now = new Date().toISOString();
  await db
    .update(campaigns)
    .set({
      status: "sent",
      sent_at: now,
      sent_count: verifiedSubs.length,
    })
    .where(eq(campaigns.id, campaignId));

  return Response.json({
    ok: true,
    sent_count: verifiedSubs.length,
    sent_at: now,
  });
}
