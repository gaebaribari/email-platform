"use client";

import { useState, useEffect } from "react";
import { Users, List, Send, CheckCircle } from "lucide-react";

interface DashboardStats {
  totalSubscribers: number;
  verifiedSubscribers: number;
  pendingSubscribers: number;
  totalLists: number;
  totalCampaigns: number;
  sentCampaigns: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSubscribers: 0,
    verifiedSubscribers: 0,
    pendingSubscribers: 0,
    totalLists: 0,
    totalCampaigns: 0,
    sentCampaigns: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const [subsRes, listsRes, campsRes] = await Promise.all([
        fetch("/api/subscribers"),
        fetch("/api/lists"),
        fetch("/api/campaigns"),
      ]);
      const subs = subsRes.ok ? await subsRes.json() : [];
      const lists = listsRes.ok ? await listsRes.json() : [];
      const camps = campsRes.ok ? await campsRes.json() : [];

      setStats({
        totalSubscribers: subs.length,
        verifiedSubscribers: subs.filter(
          (s: { status: string }) => s.status === "verified"
        ).length,
        pendingSubscribers: subs.filter(
          (s: { status: string }) => s.status === "pending"
        ).length,
        totalLists: lists.length,
        totalCampaigns: camps.length,
        sentCampaigns: camps.filter(
          (c: { status: string }) => c.status === "sent"
        ).length,
      });
    }
    fetchStats();
  }, []);

  const cards = [
    {
      label: "전체 구독자",
      value: stats.totalSubscribers,
      icon: Users,
      color: "text-primary",
    },
    {
      label: "인증 완료",
      value: stats.verifiedSubscribers,
      icon: CheckCircle,
      color: "text-success",
    },
    {
      label: "인증 대기",
      value: stats.pendingSubscribers,
      icon: Users,
      color: "text-warning",
    },
    {
      label: "이메일 리스트",
      value: stats.totalLists,
      icon: List,
      color: "text-primary",
    },
    {
      label: "전체 캠페인",
      value: stats.totalCampaigns,
      icon: Send,
      color: "text-primary",
    },
    {
      label: "발송 완료",
      value: stats.sentCampaigns,
      icon: Send,
      color: "text-success",
    },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-1">대시보드</h1>
      <p className="text-sm text-muted-foreground mb-6">
        이메일 마케팅 현황을 한눈에 확인하세요
      </p>

      <div className="grid grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="p-4 border border-border rounded-lg"
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
