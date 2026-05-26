// 마이그레이션 파이프라인 공용 타입.
//
// 설계 의도:
//  - SourceConfig 는 YAML에서 그대로 읽어온 "매핑 정의"다. 코드가 아니라 데이터다. (포인트 ①)
//  - 파이프라인은 stage(pre → transform → post → reconcile)로 나뉘고, 각 stage가
//    독립된 결과를 남겨서 "어느 단계에서 깨졌는지" 추적 가능하다. (포인트 ②)
//  - 매핑되지 않은 값은 버리지 않고 Exception 으로 집계한다. (포인트 ③)

/** 한 타깃 필드를 원천에서 어떻게 끌어올지 정의 */
export interface FieldRule {
  /** 나열한 원천 컬럼 중 처음으로 값이 있는 것을 채택 (별칭 흡수) */
  from?: string[];
  /** 나열한 원천 컬럼들을 공백으로 이어붙임 (예: First + Last → name) */
  join?: string[];
  /** 적용할 정규화 사전 이름 (normalize 블록의 키) */
  normalize?: string;
}

/** 표준값 -> 동의어 목록 */
export type NormalizeDict = Record<string, string[]>;

/** YAML 한 장 = 소스 하나의 매핑 정의 */
export interface SourceConfig {
  name: string;
  label: string;
  description: string;
  required_columns: string[];
  fields: Record<string, FieldRule>;
  normalize?: Record<string, NormalizeDict>;
}

/** 타깃 도메인 모델 (= Brevo Contact 로 적재될 표준 레코드) */
export interface TargetRecord {
  email: string;
  name: string;
  country: string; // 표준 국가코드 또는 "" / "UNKNOWN"
}

/** 변환 단계에서 표준화하지 못한 원천 값 1건 */
export interface UnmappedValue {
  field: string;
  raw: string;
  rowIndex: number;
}

/** post 검증에서 탈락한 레코드 1건 */
export interface RejectedRecord {
  rowIndex: number;
  record: Partial<TargetRecord>;
  reasons: string[];
}

/** 예외 집계 1행 (포인트 ③의 리포트 단위) */
export interface ExceptionPattern {
  field: string;
  raw: string;
  count: number;
  /** 운영자가 YAML에 추가할 때 참고할 제안 문구 */
  suggestion: string;
}

/** 단계별 통과/탈락 건수 — 대시보드 funnel 의 원천 */
export interface StageStat {
  stage: "pre" | "transform" | "post" | "reconcile";
  label: string;
  ok: boolean;
  in: number;
  out: number;
  detail: string;
}

/** 원천 ↔ 적재 정합성 검증 결과 */
export interface Reconciliation {
  balanced: boolean;
  sourceRows: number;
  loaded: number;
  rejected: number;
  skippedEmpty: number;
  note: string;
}

/** 변환 전후를 나란히 보여주는 표본 1건 */
export interface SamplePair {
  rowIndex: number;
  before: Record<string, string>;
  after: TargetRecord;
}

/** 파이프라인 1회 실행의 전체 결과 (API 응답 = 대시보드 입력) */
export interface MigrationReport {
  source: { name: string; label: string; description: string };
  stages: StageStat[];
  /** pre 단계에서 치명적 오류로 중단된 경우 */
  aborted: boolean;
  abortReason?: string;
  records: TargetRecord[];
  rejected: RejectedRecord[];
  exceptions: ExceptionPattern[];
  reconciliation: Reconciliation;
  samples: SamplePair[];
  /** 정규화 필드별 표준값 후보 (예외값을 어디에 매핑할지 UI 선택지) */
  canonicals: Record<string, string[]>;
}

/** 클라이언트가 세션 중 추가한 매핑(메모리 오버라이드). 필드 -> 표준값 -> 추가 동의어들 */
export type MappingOverrides = Record<string, Record<string, string[]>>;
