"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Eye, Loader2 } from "lucide-react";
import type { Campaign, Subscriber } from "@/lib/types";
import { TEMPLATE_VARIABLES } from "@/lib/types";

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const campsRes = await fetch("/api/campaigns");
      const camps = await campsRes.json();
      const found = camps.find((c: Campaign) => c.id === Number(id));
      setCampaign(found || null);

      if (found) {
        const subsRes = await fetch(
          `/api/subscribers?list_id=${found.list_id}&status=verified`
        );
        if (subsRes.ok) setSubscribers(await subsRes.json());
      }
    }
    fetchData();
  }, [id]);

  const handleSend = async () => {
    if (
      !confirm(
        `${subscribers.length}명에게 이메일을 발송하시겠습니까?`
      )
    )
      return;

    setSending(true);
    const res = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });

    if (res.ok) {
      const data = await res.json();
      alert(`${data.sent_count}명에게 발송 완료!`);
      // 캠페인 상태 갱신
      const campsRes = await fetch("/api/campaigns");
      const camps = await campsRes.json();
      setCampaign(camps.find((c: Campaign) => c.id === Number(id)) || null);
    } else {
      alert("발송에 실패했습니다");
    }
    setSending(false);
  };

  const renderPreview = () => {
    if (!campaign) return "";
    let html = campaign.template;
    for (const v of TEMPLATE_VARIABLES) {
      html = html.replaceAll(v.key, v.example);
    }
    return html;
  };

  if (!campaign) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        로딩 중...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/campaigns"
          className="p-1.5 rounded-md hover:bg-muted"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{campaign.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {campaign.listName && `${campaign.listName} · `}
            대상: {subscribers.length}명 · 상태: {campaign.status}
          </p>
        </div>
        {campaign.status !== "sent" && (
          <button
            onClick={handleSend}
            disabled={sending || subscribers.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md disabled:opacity-50 hover:opacity-90"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sending ? "발송 중..." : `${subscribers.length}명에게 발송`}
          </button>
        )}
      </div>

      {/* 캠페인 정보 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 border border-border rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">제목</p>
          <p className="text-sm font-medium">{campaign.subject}</p>
        </div>
        <div className="p-4 border border-border rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">
            {campaign.status === "sent" ? "발송일" : "예약일"}
          </p>
          <p className="text-sm font-medium">
            {campaign.sent_at
              ? new Date(campaign.sent_at).toLocaleString("ko-KR")
              : campaign.scheduled_at
                ? new Date(campaign.scheduled_at).toLocaleString("ko-KR")
                : "미정"}
          </p>
        </div>
        {campaign.sent_count > 0 && (
          <div className="p-4 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">발송 수</p>
            <p className="text-sm font-medium">{campaign.sent_count}명</p>
          </div>
        )}
      </div>

      {/* 미리보기 */}
      <div className="border border-border rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <span className="text-sm font-medium flex items-center gap-1.5">
            <Eye className="w-4 h-4" />
            이메일 미리보기
          </span>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs text-primary hover:underline"
          >
            {showPreview ? "접기" : "펼치기"}
          </button>
        </div>
        {showPreview && (
          <div className="p-6">
            <div className="mb-3 pb-3 border-b border-border">
              <p className="text-xs text-muted-foreground">제목</p>
              <p className="font-medium">{campaign.subject}</p>
            </div>
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderPreview() }}
            />
          </div>
        )}
      </div>

      {/* 발송 대상 목록 */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-3">
          발송 대상 ({subscribers.length}명)
        </h3>
        {subscribers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            인증 완료된 구독자가 없습니다
          </p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                    이메일
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                    이름
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub) => (
                  <tr key={sub.id} className="border-t border-border">
                    <td className="px-4 py-2">{sub.email}</td>
                    <td className="px-4 py-2">{sub.name || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
