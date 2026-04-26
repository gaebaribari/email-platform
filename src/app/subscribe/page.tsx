"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, CheckCircle, AlertCircle } from "lucide-react";
import { subscribeSchema, type SubscribeFormData } from "@/lib/validation";

export default function SubscribePage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubscribeFormData>({
    resolver: zodResolver(subscribeSchema),
  });

  const onSubmit = async (data: SubscribeFormData) => {
    setError("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, list_id: 1 }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "구독 신청에 실패했습니다");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("네트워크 오류가 발생했습니다");
    }
  };

  if (submitted) {
    return (
      <div className="min-h-full flex items-center justify-center bg-muted/30 px-4">
        <div className="max-w-sm w-full text-center">
          <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">인증 메일을 확인해주세요</h2>
          <p className="text-sm text-muted-foreground">
            입력하신 이메일로 인증 링크를 발송했습니다.
            <br />
            링크를 클릭하시면 구독이 완료됩니다.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            메일이 보이지 않으면 스팸함을 확인해주세요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-muted/30 px-4">
      <div className="max-w-sm w-full">
        <div className="bg-background border border-border rounded-xl p-6 shadow-sm">
          {/* 헤더 */}
          <div className="text-center mb-6">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-lg font-bold">뉴스레터 구독</h1>
            <p className="text-xs text-muted-foreground mt-1">
              최신 마케팅 인사이트를 받아보세요
            </p>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* 이름 */}
            <div>
              <label className="text-sm font-medium mb-1 block">이름</label>
              <input
                {...register("name")}
                type="text"
                placeholder="홍길동"
                className={`w-full px-3 py-2 border rounded-md text-sm outline-none transition-colors ${
                  errors.name
                    ? "border-destructive focus:ring-1 focus:ring-destructive"
                    : "border-border focus:ring-1 focus:ring-primary"
                }`}
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* 이메일 */}
            <div>
              <label className="text-sm font-medium mb-1 block">이메일</label>
              <input
                {...register("email")}
                type="email"
                placeholder="email@example.com"
                className={`w-full px-3 py-2 border rounded-md text-sm outline-none transition-colors ${
                  errors.email
                    ? "border-destructive focus:ring-1 focus:ring-destructive"
                    : "border-border focus:ring-1 focus:ring-primary"
                }`}
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* GDPR 동의 */}
            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  {...register("gdpr_consent")}
                  type="checkbox"
                  className="mt-0.5 rounded"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  개인정보 수집 및 이용에 동의합니다. 수집된 이메일은
                  뉴스레터 발송 목적으로만 사용되며, 언제든지 구독을
                  해지할 수 있습니다.
                </span>
              </label>
              {errors.gdpr_consent && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.gdpr_consent.message}
                </p>
              )}
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="p-2 bg-destructive/5 border border-destructive/20 rounded-md">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {/* 제출 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-md disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {isSubmitting ? "처리 중..." : "구독하기"}
            </button>
          </form>

          <p className="text-[10px] text-muted-foreground text-center mt-4">
            구독 시 인증 메일이 발송됩니다 (더블옵트인)
          </p>
        </div>
      </div>
    </div>
  );
}
