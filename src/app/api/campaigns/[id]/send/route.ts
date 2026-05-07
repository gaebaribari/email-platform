import { getBrevo } from "@/lib/brevo";
import { BrevoError } from "@/lib/brevo-error";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const campaignId = Number(id);
  if (!campaignId) {
    return Response.json({ error: "잘못된 캠페인 id" }, { status: 400 });
  }

  try {
    const brevo = getBrevo();
    const campaign = await brevo.emailCampaigns.getEmailCampaign({ campaignId });
    if (campaign.status === "sent") {
      return Response.json(
        { error: "이미 발송된 캠페인입니다" },
        { status: 400 }
      );
    }

    // 발송 대상자 수: 캠페인 recipients 리스트 안의 contact 수 합
    const targetListIds = campaign.recipients?.lists ?? [];
    let recipientCount = 0;
    for (const lid of targetListIds) {
      const list = await brevo.contacts.getList({ listId: lid });
      recipientCount += list.totalSubscribers ?? 0;
    }

    if (recipientCount === 0) {
      return Response.json(
        { error: "발송 대상 구독자가 없습니다" },
        { status: 400 }
      );
    }

    await brevo.emailCampaigns.sendEmailCampaignNow({ campaignId });

    return Response.json({
      ok: true,
      sent_count: recipientCount,
      sent_at: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: BrevoError.message(err) }, { status: 500 });
  }
}
