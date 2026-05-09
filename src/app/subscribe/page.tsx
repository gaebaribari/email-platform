"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, CheckCircle, AlertCircle, X, PartyPopper } from "lucide-react";
import { subscribeSchema, type SubscribeFormData } from "@/lib/validation";

export default function SubscribePage() {
  const [submitted, setSubmitted] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // 메일 발송 후, 다른 탭의 verify 페이지에서 인증이 끝나면 신호를 받아 화면을 갱신한다.
  useEffect(() => {
    if (!submitted || verified) return;
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel("email-platform-verified");
      ch.onmessage = (e) => {
        if (e.data?.verified) setVerified(true);
      };
    } catch {
      // BroadcastChannel 미지원 브라우저는 폴백 없이 그대로 둠
    }
    return () => {
      ch?.close();
    };
  }, [submitted, verified]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SubscribeFormData>({
    resolver: zodResolver(subscribeSchema),
  });

  const consent = watch("gdpr_consent");

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

  if (verified) {
    return (
      <div className="min-h-full flex items-center justify-center bg-muted/30 px-4">
        <div className="max-w-sm w-full text-center">
          <PartyPopper className="w-12 h-12 text-success mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">구독이 완료되었습니다!</h2>
          <p className="text-sm text-muted-foreground">
            인증이 확인되었어요. 이제부터 뉴스레터를 받아보실 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-full flex items-center justify-center bg-muted/30 px-4">
        <div className="max-w-sm w-full text-center">
          <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">인증 메일을 확인해주세요</h2>
          <p className="text-sm text-muted-foreground">
            입력하신 이메일로 인증 링크를 발송했습니다.
            <br />
            <strong className="text-foreground">30분 이내</strong>에 링크를 클릭하시면 구독이 완료됩니다.
          </p>
          <div className="mt-5 p-3 bg-muted/40 border border-border rounded-md text-center">
            <p className="text-xs font-medium mb-1">메일이 안 보이나요?</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              무료 발송 환경을 사용 중이라 메일이{" "}
              <strong className="text-foreground">스팸함</strong>으로 분류될 수
              있습니다.
              <br />
              받은편지함에 없으면 스팸함도 꼭 확인해주세요.
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-4">
            인증 후 이 페이지가 자동으로 갱신됩니다 (같은 브라우저 한정)
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

            {/* 동의 체크박스 — 클릭 시 모달 띄우기 */}
            <div>
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded cursor-pointer"
                  checked={consent === true}
                  onClick={(e) => {
                    // 아직 동의 안 한 상태에서 클릭 → 모달 띄우고 체크는 막음
                    if (!consent) {
                      e.preventDefault();
                      setModalOpen(true);
                    }
                    // 이미 동의한 상태에서 클릭 → 자연스럽게 해제됨 (재동의 필요)
                  }}
                  onChange={(e) => {
                    // 해제 시에만 발동
                    if (!e.target.checked) {
                      setValue("gdpr_consent", false as never, { shouldValidate: true });
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  <button
                    type="button"
                    className="text-foreground font-medium underline underline-offset-2 hover:text-primary"
                    onClick={() => setModalOpen(true)}
                  >
                    개인정보 처리방침
                  </button>
                  을 읽고 동의합니다. (필수)
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

          <p className="text-[10px] text-muted-foreground text-center mt-4 leading-relaxed">
            구독 시 인증 메일이 발송됩니다 (더블옵트인)
            <br />
            메일이 스팸함으로 분류될 수 있으니 함께 확인해주세요
          </p>
        </div>
      </div>

      {/* 개인정보 처리방침 모달 */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-background rounded-xl max-w-md w-full max-h-[80vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-bold">개인정보 처리방침</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 약관 본문 (스크롤) */}
            <div className="p-5 overflow-y-auto flex-1 text-xs text-muted-foreground space-y-3 leading-relaxed">
              <p>
                <strong className="text-foreground">1. 수집 항목</strong>
                <br />
                이름, 이메일 주소
              </p>
              <p>
                <strong className="text-foreground">2. 수집·이용 목적</strong>
                <br />
                뉴스레터 발송 및 마케팅 정보 제공
              </p>
              <p>
                <strong className="text-foreground">3. 보관 기간</strong>
                <br />
                구독 해지 시까지. 해지 즉시 파기됩니다.
              </p>
              <p>
                <strong className="text-foreground">4. 제3자 제공</strong>
                <br />
                이메일 발송 위탁(Sendgrid/Brevo) 외 어떠한 제3자에게도 제공하지 않습니다.
              </p>
              <p>
                <strong className="text-foreground">5. 정보 주체의 권리</strong>
                <br />
                언제든지 열람, 정정, 삭제, 처리 정지, 구독 해지를 요구할 수 있습니다.
                <br />
                <span className="text-[11px]">
                  (GDPR Art. 15-22, CCPA §1798.100-1798.135)
                </span>
              </p>
              <p>
                <strong className="text-foreground">6. CAN-SPAM Act 준수</strong>
                <br />
                모든 발송 메일 하단에 수신거부(unsubscribe) 링크가 포함됩니다.
              </p>
              <p>
                <strong className="text-foreground">7. 문의</strong>
                <br />
                privacy@example.com
              </p>
            </div>

            {/* 버튼 */}
            <div className="p-4 border-t border-border flex gap-2">
              <button
                type="button"
                className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-muted/50 transition-colors"
                onClick={() => setModalOpen(false)}
              >
                닫기
              </button>
              <button
                type="button"
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                onClick={() => {
                  setValue("gdpr_consent", true as never, { shouldValidate: true });
                  setModalOpen(false);
                }}
              >
                동의하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
