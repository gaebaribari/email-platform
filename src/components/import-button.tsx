"use client";

import { useState, useEffect } from "react";
import { UserPlus, X } from "lucide-react";
import { MigrationPanel } from "./migration-panel";

// "구독자 일괄 추가" 버튼 — 클릭하면 마이그레이션 파이프라인을 모달로 띄운다.
// 추가가 끝나면 모달을 닫고 onComplete()로 부모에게 알린다(목록 새로고침용).
export function ImportButton({ onComplete }: { onComplete?: () => void }) {
  const [open, setOpen] = useState(false);

  // Esc로 닫기 + 열려 있는 동안 배경 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-sm rounded-md hover:bg-muted"
      >
        <UserPlus className="w-3.5 h-3.5" />
        구독자 일괄 추가
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="데이터 마이그레이션"
        >
          <div
            className="relative bg-background rounded-lg shadow-xl w-full max-w-4xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="닫기"
              className="absolute top-3 right-3 z-10 p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <MigrationPanel
              onAdded={() => {
                setOpen(false);
                onComplete?.();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
