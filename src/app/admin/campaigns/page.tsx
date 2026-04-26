"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Send, Clock, FileEdit, Trash2 } from "lucide-react";
import type { Campaign } from "@/lib/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Send }> = {
  draft: { label: "초안", color: "text-muted-foreground bg-muted", icon: FileEdit },
  scheduled: { label: "예약됨", color: "text-warning bg-warning/10", icon: Clock },
  sent: { label: "발송완료", color: "text-success bg-success/10", icon: Send },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const fetchCampaigns = async () => {
    const res = await fetch("/api/campaigns");
    if (res.ok) setCampaigns(await res.json());
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("캠페인을 삭제하시겠습니까?")) return;
    await fetch("/api/campaigns", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchCampaigns();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">캠페인</h1>
          <p className="text-sm text-muted-foreground mt-1">
            이메일 캠페인을 생성하고 발송하세요
          </p>
        </div>
        <Link
          href="/admin/campaigns/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" />
          새 캠페인
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          캠페인이 없습니다
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((campaign) => {
            const config = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
            const Icon = config.icon;
            return (
              <div
                key={campaign.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:shadow-sm transition-shadow"
              >
                <Link
                  href={`/admin/campaigns/${campaign.id}`}
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm truncate">
                      {campaign.name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${config.color}`}
                    >
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>제목: {campaign.subject || "(없음)"}</span>
                    {campaign.listName && <span>리스트: {campaign.listName}</span>}
                    {campaign.sent_count > 0 && (
                      <span>{campaign.sent_count}명 발송</span>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(campaign.id)}
                  className="p-1.5 rounded hover:bg-destructive/10 ml-2"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
