"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, Send, Clock, Variable } from "lucide-react";
import Link from "next/link";
import { campaignSchema, type CampaignFormData } from "@/lib/validation";
import { TEMPLATE_VARIABLES } from "@/lib/types";
import type { EmailList } from "@/lib/types";

export default function NewCampaignPage() {
  const router = useRouter();
  const [lists, setLists] = useState<EmailList[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      template: `<h1>안녕하세요 {{name}}님!</h1>
<p>{{list_name}} 뉴스레터를 구독해주셔서 감사합니다.</p>
<p>이번 주 소식을 전해드립니다.</p>
<br/>
<p>구독을 원치 않으시면 <a href="{{unsubscribe_url}}">여기</a>를 클릭해주세요.</p>`,
    },
  });

  const template = watch("template");
  const subject = watch("subject");

  useEffect(() => {
    fetch("/api/lists")
      .then((res) => res.json())
      .then(setLists);
  }, []);

  // 변수 치환 미리보기
  useEffect(() => {
    let html = template || "";
    for (const v of TEMPLATE_VARIABLES) {
      html = html.replaceAll(v.key, v.example);
    }
    setPreviewHtml(html);
  }, [template]);

  const insertVariable = (key: string) => {
    const textarea = document.querySelector(
      'textarea[name="template"]'
    ) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = template || "";
    const newValue =
      current.substring(0, start) + key + current.substring(end);
    setValue("template", newValue);

    // 커서 위치 복원
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + key.length, start + key.length);
    }, 0);
  };

  const onSubmit = async (data: CampaignFormData) => {
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const { id } = await res.json();
      router.push(`/admin/campaigns/${id}`);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/campaigns"
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold">새 캠페인</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-6">
          {/* 왼쪽: 설정 */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                캠페인명 *
              </label>
              <input
                {...register("name")}
                placeholder="4월 뉴스레터"
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                이메일 제목 *
              </label>
              <input
                {...register("subject")}
                placeholder="[뉴스레터] 이번 주 소식"
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              />
              {errors.subject && (
                <p className="text-xs text-destructive mt-1">
                  {errors.subject.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                이메일 리스트 *
              </label>
              <select
                {...register("list_id", { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background"
              >
                <option value={0}>리스트 선택</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name} ({list.subscriberCount || 0}명)
                  </option>
                ))}
              </select>
              {errors.list_id && (
                <p className="text-xs text-destructive mt-1">
                  {errors.list_id.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                예약 발송 (선택)
              </label>
              <input
                {...register("scheduled_at")}
                type="datetime-local"
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              />
            </div>

            {/* 변수 삽입 버튼 */}
            <div>
              <label className="text-sm font-medium mb-1.5 flex items-center gap-1">
                <Variable className="w-3.5 h-3.5" />
                변수 삽입
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="px-2.5 py-1 text-xs rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                  >
                    {v.label}
                    <span className="text-muted-foreground ml-1 font-mono">
                      {v.key}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 오른쪽: 템플릿 + 미리보기 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">이메일 본문 *</label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {showPreview ? (
                  <EyeOff className="w-3 h-3" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
                {showPreview ? "에디터" : "미리보기"}
              </button>
            </div>

            {showPreview ? (
              <div className="border border-border rounded-md p-4 min-h-[400px] bg-background">
                {subject && (
                  <div className="mb-3 pb-3 border-b border-border">
                    <p className="text-xs text-muted-foreground">제목</p>
                    <p className="font-medium text-sm">{subject}</p>
                  </div>
                )}
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            ) : (
              <>
                <textarea
                  {...register("template")}
                  rows={18}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm font-mono resize-none"
                  placeholder="<h1>안녕하세요 {{name}}님!</h1>"
                />
                {errors.template && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.template.message}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md disabled:opacity-50 hover:opacity-90"
          >
            {watch("scheduled_at") ? (
              <Clock className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {watch("scheduled_at") ? "예약 저장" : "캠페인 저장"}
          </button>
          <Link
            href="/admin/campaigns"
            className="px-4 py-2 border border-border text-sm rounded-md"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}
