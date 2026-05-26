import type {
  NormalizeDict,
  SourceConfig,
  TargetRecord,
  UnmappedValue,
} from "./types";

// 변환(Transform): 원천 row → 타깃 도메인 모델.
// 매핑 규칙은 전부 config(YAML)에서 온다. 이 파일에 소스별 분기(if source === ...)는 없다.

/** 동의어 → 표준값 역인덱스를 만든다 (trim + 소문자 매칭) */
function buildLookup(dict: NormalizeDict): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [canonical, synonyms] of Object.entries(dict)) {
    lookup.set(canonical.trim().toLowerCase(), canonical);
    for (const syn of synonyms) {
      lookup.set(syn.trim().toLowerCase(), canonical);
    }
  }
  return lookup;
}

export interface TransformResult {
  records: TargetRecord[];
  unmapped: UnmappedValue[];
  /** 변환 전 원천 row 스냅샷 (샘플 대조용) */
  before: Array<Record<string, string>>;
}

export function transform(
  rows: Array<Record<string, string>>,
  config: SourceConfig
): TransformResult {
  const lookups = new Map<string, Map<string, string>>();
  for (const [dictName, dict] of Object.entries(config.normalize ?? {})) {
    lookups.set(dictName, buildLookup(dict));
  }

  const records: TargetRecord[] = [];
  const unmapped: UnmappedValue[] = [];
  const before: Array<Record<string, string>> = [];

  rows.forEach((row, rowIndex) => {
    const out: Record<string, string> = {};

    for (const [field, rule] of Object.entries(config.fields)) {
      let value = "";

      if (rule.join) {
        // 여러 컬럼을 공백으로 결합 (예: First + Last → name)
        value = rule.join
          .map((col) => (row[col] ?? "").trim())
          .filter(Boolean)
          .join(" ");
      } else if (rule.from) {
        // 별칭 후보 중 처음으로 값이 있는 컬럼 채택
        for (const col of rule.from) {
          const v = (row[col] ?? "").trim();
          if (v) {
            value = v;
            break;
          }
        }
      }

      if (rule.normalize && value) {
        const lookup = lookups.get(rule.normalize);
        const canonical = lookup?.get(value.toLowerCase());
        if (canonical) {
          value = canonical;
        } else {
          // 사전에 없는 값 → 버리지 않고 예외로 적재 (포인트 ③)
          unmapped.push({ field, raw: value, rowIndex });
          value = "UNKNOWN";
        }
      }

      out[field] = value;
    }

    records.push({
      email: out.email ?? "",
      name: out.name ?? "",
      country: out.country ?? "",
    });
    before.push(row);
  });

  return { records, unmapped, before };
}
