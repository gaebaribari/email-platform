import { z } from "zod";
import type {
  RejectedRecord,
  Reconciliation,
  TargetRecord,
} from "./types";

// 검증을 3단계로 분리한다. 마이그레이션에서 가장 위험한 건 "옮긴 뒤에 잘못을 발견"하는 것.
// 어느 단계에서 깨졌는지 추적 가능하도록 pre / post / reconcile 로 나눈다. (포인트 ②)

// ── 1단계: pre (사전) — 변환 전에 원천 구조를 검사. 실패 시 파이프라인 중단. ──
export interface PreResult {
  ok: boolean;
  missingColumns: string[];
  detail: string;
}

export function preValidate(
  headers: string[],
  requiredColumns: string[]
): PreResult {
  // 대소문자·공백 무시로 필수 컬럼 존재 여부를 본다.
  const present = new Set(headers.map((h) => h.trim().toLowerCase()));
  const missing = requiredColumns.filter(
    (c) => !present.has(c.trim().toLowerCase())
  );
  return {
    ok: missing.length === 0,
    missingColumns: missing,
    detail:
      missing.length === 0
        ? `필수 컬럼 ${requiredColumns.length}개 모두 존재`
        : `필수 컬럼 누락: ${missing.join(", ")}`,
  };
}

// ── 2단계: post (사후) — 변환 결과를 타깃 스키마로 검사. 적재 전에 불량 레코드를 걸러낸다. ──
const targetSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  country: z.string(),
  status: z.string(),
});

export interface PostResult {
  valid: TargetRecord[];
  rejected: RejectedRecord[];
  /** 매핑 필드가 전부 비어 정보가 없는 행 — 오류가 아니라 의도적으로 건너뜀 */
  skippedEmpty: number;
}

function isEmptyRecord(r: TargetRecord): boolean {
  return !r.email && !r.name && (r.country === "" || r.country === "UNKNOWN");
}

export function postValidate(records: TargetRecord[]): PostResult {
  const valid: TargetRecord[] = [];
  const rejected: RejectedRecord[] = [];
  const seenEmail = new Set<string>();
  let skippedEmpty = 0;

  records.forEach((record, rowIndex) => {
    if (isEmptyRecord(record)) {
      skippedEmpty++;
      return;
    }

    const reasons: string[] = [];

    const parsed = targetSchema.safeParse(record);
    if (!parsed.success) {
      if (!record.email) reasons.push("이메일 없음");
      else reasons.push("이메일 형식 오류");
    }

    const key = record.email.trim().toLowerCase();
    if (key && seenEmail.has(key)) {
      reasons.push("배치 내 중복 이메일");
    }

    if (reasons.length > 0) {
      rejected.push({ rowIndex, record, reasons });
      return;
    }
    seenEmail.add(key);
    valid.push(record);
  });

  return { valid, rejected, skippedEmpty };
}

// ── 3단계: reconcile (정합성) — 원천 = 적재 + 탈락 + 빈행 이 맞아떨어지는지 검산. ──
// 변환 과정에서 행이 소리 없이 사라지는 누락(silent drop)을 잡는다.
export function reconcile(
  sourceRows: number,
  loaded: number,
  rejected: number,
  skippedEmpty: number
): Reconciliation {
  const accounted = loaded + rejected + skippedEmpty;
  const balanced = accounted === sourceRows;
  return {
    balanced,
    sourceRows,
    loaded,
    rejected,
    skippedEmpty,
    note: balanced
      ? `원천 ${sourceRows}행 = 적재 ${loaded} + 탈락 ${rejected} + 빈행 ${skippedEmpty} (정합)`
      : `불일치: 원천 ${sourceRows} ≠ 합계 ${accounted}. ${
          sourceRows - accounted
        }행이 추적되지 않음`,
  };
}
