import type {
  MigrationReport,
  SamplePair,
  SourceConfig,
  StageStat,
  TargetRecord,
} from "./types";
import { transform } from "./transform";
import { preValidate, postValidate, reconcile } from "./validate";
import { aggregateExceptions } from "./report";

// 오케스트레이터: 한 번의 마이그레이션 실행을 stage 순서대로 엮는다.
//   pre → transform → post → reconcile
// 각 stage의 in/out 건수를 StageStat 으로 남겨 대시보드 funnel 의 입력이 된다.

const SAMPLE_SIZE = 5;

function pickSamples(
  before: Array<Record<string, string>>,
  records: TargetRecord[],
  validSet: Set<number>
): SamplePair[] {
  const indices = [...validSet].slice(0, SAMPLE_SIZE);
  return indices.map((rowIndex) => ({
    rowIndex,
    before: before[rowIndex],
    after: records[rowIndex],
  }));
}

export function runPipeline(
  rows: Array<Record<string, string>>,
  headers: string[],
  config: SourceConfig
): MigrationReport {
  const sourceMeta = {
    name: config.name,
    label: config.label,
    description: config.description,
  };
  const stages: StageStat[] = [];

  // 정규화를 쓰는 필드별 표준값 후보 (UI에서 예외값을 매핑할 선택지)
  const canonicals: Record<string, string[]> = {};
  for (const [field, rule] of Object.entries(config.fields)) {
    if (rule.normalize && config.normalize?.[rule.normalize]) {
      canonicals[field] = Object.keys(config.normalize[rule.normalize]);
    }
  }

  // ── pre ──
  const pre = preValidate(headers, config);
  stages.push({
    stage: "pre",
    label: "사전 검증 (원천 구조)",
    ok: pre.ok,
    in: rows.length,
    out: pre.ok ? rows.length : 0,
    detail: pre.detail,
  });

  if (!pre.ok) {
    // 구조가 깨졌으면 변환 전에 중단 — 잘못된 데이터를 옮기지 않는다.
    return {
      source: sourceMeta,
      stages,
      aborted: true,
      abortReason: pre.detail,
      records: [],
      rejected: [],
      exceptions: [],
      reconciliation: reconcile(rows.length, 0, 0, 0),
      samples: [],
      canonicals,
    };
  }

  // ── transform ──
  const { records, unmapped, before } = transform(rows, config);
  stages.push({
    stage: "transform",
    label: "변환 (매핑 + 정규화)",
    ok: true,
    in: rows.length,
    out: records.length,
    detail: `${records.length}건 변환, 미매핑 값 ${unmapped.length}건 발생`,
  });

  // ── post ──
  const { valid, rejected, skippedEmpty } = postValidate(records);
  stages.push({
    stage: "post",
    label: "사후 검증 (타깃 스키마)",
    ok: rejected.length === 0,
    in: records.length,
    out: valid.length,
    detail: `통과 ${valid.length} / 탈락 ${rejected.length} / 빈행 ${skippedEmpty}`,
  });

  // ── reconcile ──
  const reconciliation = reconcile(
    rows.length,
    valid.length,
    rejected.length,
    skippedEmpty
  );
  stages.push({
    stage: "reconcile",
    label: "정합성 검증 (건수 검산)",
    ok: reconciliation.balanced,
    in: rows.length,
    out: valid.length,
    detail: reconciliation.note,
  });

  // valid 레코드의 원천 인덱스를 복원해 샘플 대조에 사용
  const rejectedIdx = new Set(rejected.map((r) => r.rowIndex));
  const validSet = new Set<number>();
  records.forEach((r, i) => {
    if (!rejectedIdx.has(i) && r.email) validSet.add(i);
  });

  return {
    source: sourceMeta,
    stages,
    aborted: false,
    records: valid,
    rejected,
    exceptions: aggregateExceptions(unmapped),
    reconciliation,
    samples: pickSamples(before, records, validSet),
    canonicals,
  };
}
