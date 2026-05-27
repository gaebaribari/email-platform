"use client";

import { useState, useEffect } from "react";
import {
  Users,
  CheckCircle,
  XCircle,
  Search,
  Trash2,
  Download,
} from "lucide-react";
import { ImportButton } from "@/components/import-button";
import {
  DEMO_MODE,
  getDemoSubscribers,
  deleteDemoSubscriber,
} from "@/lib/demo-store";
import type { Subscriber } from "@/lib/types";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle }
> = {
  verified: {
    label: "인증완료",
    color: "text-success bg-success/10",
    icon: CheckCircle,
  },
  unsubscribed: {
    label: "수신거부",
    color: "text-destructive bg-destructive/10",
    icon: XCircle,
  },
};

export default function AdminDashboard() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const fetchData = async () => {
    let list: Subscriber[];
    if (DEMO_MODE) {
      list = getDemoSubscribers();
      if (statusFilter) list = list.filter((s) => s.status === statusFilter);
      if (search) {
        const q = search.toLowerCase();
        list = list.filter((s) =>
          `${s.email} ${s.name}`.toLowerCase().includes(q)
        );
      }
    } else {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/subscribers?${params}`);
      list = res.ok ? await res.json() : [];
    }
    // 최근 추가된 구독자가 위로 오도록 정렬
    list = [...list].sort((a, b) =>
      (b.subscribed_at || "").localeCompare(a.subscribed_at || "")
    );
    setSubscribers(list);
    setSelected(new Set());
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const handleDelete = async (id: number) => {
    if (!confirm("이 구독자를 삭제하시겠습니까?")) return;
    if (DEMO_MODE) {
      deleteDemoSubscriber(id);
      fetchData();
      return;
    }
    await fetch("/api/subscribers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  };

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected =
    subscribers.length > 0 && subscribers.every((s) => selected.has(s.id));

  const toggleSelectAll = () =>
    setSelected(allSelected ? new Set() : new Set(subscribers.map((s) => s.id)));

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}명을 삭제하시겠습니까?`)) return;
    const ids = [...selected];
    if (DEMO_MODE) {
      ids.forEach(deleteDemoSubscriber);
    } else {
      for (const id of ids) {
        await fetch("/api/subscribers", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      }
    }
    fetchData();
  };

  // CSV 가져오기는 검증·정규화가 포함된 데이터 마이그레이션 파이프라인(/admin/migration)으로 일원화했다.

  const handleExport = () => {
    const headers = ["email", "name", "status", "subscribed_at", "verified_at"];
    const rows = subscribers.map((s) =>
      headers.map((h) => String(s[h as keyof Subscriber] || ""))
    );
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscribers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const verifiedCount = subscribers.filter(
    (s) => s.status === "verified"
  ).length;
  const unsubscribedCount = subscribers.filter(
    (s) => s.status === "unsubscribed"
  ).length;

  const cards = [
    {
      label: "전체 구독자",
      value: subscribers.length,
      icon: Users,
      color: "text-primary",
    },
    {
      label: "인증 완료",
      value: verifiedCount,
      icon: CheckCircle,
      color: "text-success",
    },
    {
      label: "수신 거부",
      value: unsubscribedCount,
      icon: XCircle,
      color: "text-destructive",
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 대시보드 */}
      <h1 className="text-xl font-bold mb-1">대시보드</h1>
      <p className="text-sm text-muted-foreground mb-5">
        이메일 마케팅 현황을 한눈에 확인하세요
      </p>
      <div className="grid grid-cols-3 gap-4 mb-10">
        {cards.map((card) => (
          <div key={card.label} className="p-4 border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-xs text-muted-foreground">
                {card.label}
              </span>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* 구독자 관리 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">구독자 관리</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {subscribers.length}명의 구독자
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-destructive/30 text-destructive text-sm rounded-md hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              선택 삭제 ({selected.size})
            </button>
          )}
          <ImportButton onComplete={fetchData} />
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-sm rounded-md hover:bg-muted"
          >
            <Download className="w-3.5 h-3.5" />
            내보내기
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="이메일, 이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-border rounded-md text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-md text-sm bg-background"
        >
          <option value="">전체 상태</option>
          <option value="verified">인증완료</option>
          <option value="unsubscribed">수신거부</option>
        </select>
      </div>

      {/* 테이블 */}
      {subscribers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm border border-border rounded-lg">
          구독자가 없습니다
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-primary cursor-pointer align-middle"
                  />
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">
                  이메일
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">
                  이름
                </th>
                <th className="text-center px-4 py-2.5 font-medium text-xs text-muted-foreground">
                  상태
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">
                  구독일
                </th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((sub) => {
                const config =
                  STATUS_CONFIG[sub.status] || STATUS_CONFIG.verified;
                const Icon = config.icon;
                return (
                  <tr
                    key={sub.id}
                    className="border-t border-border hover:bg-muted/20"
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(sub.id)}
                        onChange={() => toggleSelect(sub.id)}
                        className="w-4 h-4 accent-primary cursor-pointer align-middle"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-medium">{sub.email}</td>
                    <td className="px-4 py-2.5">{sub.name || "-"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${config.color}`}
                      >
                        <Icon className="w-3 h-3" />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {sub.subscribed_at
                        ? new Date(sub.subscribed_at).toLocaleDateString(
                            "ko-KR"
                          )
                        : "-"}
                    </td>
                    <td className="px-2 py-2.5">
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="p-1 rounded hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
