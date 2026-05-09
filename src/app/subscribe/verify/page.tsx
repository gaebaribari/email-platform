"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("유효하지 않은 인증 링크입니다");
      return;
    }

    fetch(`/api/subscribe?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage("이메일 인증이 완료되었습니다!");
          // 같은 브라우저의 다른 탭(폼 페이지)에 인증 완료 신호 전달
          try {
            const ch = new BroadcastChannel("email-platform-verified");
            ch.postMessage({ verified: true });
            ch.close();
          } catch {
            // BroadcastChannel 미지원 브라우저는 그냥 무시
          }
        } else {
          setStatus("error");
          setMessage(data.error || "인증에 실패했습니다");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("네트워크 오류가 발생했습니다");
      });
  }, [token]);

  return (
    <div className="min-h-full flex items-center justify-center bg-muted/30 px-4">
      <div className="max-w-sm w-full text-center">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="text-lg font-bold">인증 처리 중...</h2>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">{message}</h2>
            <p className="text-sm text-muted-foreground">
              이제부터 뉴스레터를 받아보실 수 있습니다.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">인증 실패</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{message}</p>
          </>
        )}

        <Link
          href="/"
          className="inline-block mt-6 text-sm text-primary hover:underline"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
