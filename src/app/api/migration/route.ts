import { NextRequest } from "next/server";
import { listSources, loadSource } from "@/lib/migration/config";
import { runPipeline } from "@/lib/migration/pipeline";
import type { MappingOverrides, SourceConfig } from "@/lib/migration/types";

// 세션 중 UI에서 추가한 매핑을 config 사본에 병합한다 (메모리 오버라이드 — 파일을 쓰지 않음).
// 디스크의 YAML은 그대로 두고, 이번 실행에만 적용된다. 새로고침하면 초기화. (옵션 B)
function applyOverrides(config: SourceConfig, overrides?: MappingOverrides) {
  if (!overrides) return;
  for (const [field, byCanonical] of Object.entries(overrides)) {
    const dict = config.fields[field]?.normalize;
    if (!dict || !config.normalize?.[dict]) continue;
    for (const [canonical, syns] of Object.entries(byCanonical)) {
      const existing = config.normalize[dict][canonical] ?? [];
      config.normalize[dict][canonical] = [...existing, ...syns];
    }
  }
}

// YAML을 파일시스템에서 읽으므로 Node.js 런타임이 필요하다 (edge 불가).
export const runtime = "nodejs";

// 사용 가능한 소스 매핑 목록 (드롭다운용)
export async function GET() {
  try {
    return Response.json({ sources: await listSources() });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// 마이그레이션 dry-run 실행: 업로드된 원천 데이터를 파이프라인에 통과시켜 리포트를 반환.
// (실제 Brevo 적재는 별도 단계 — 여기서는 검증·변환 결과만 보여준다.)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { source, rows, headers, overrides } = body as {
      source?: string;
      rows?: Array<Record<string, string>>;
      headers?: string[];
      overrides?: MappingOverrides;
    };

    if (!source || !Array.isArray(rows) || !Array.isArray(headers)) {
      return Response.json(
        { error: "source, rows, headers 가 필요합니다" },
        { status: 400 }
      );
    }

    const config = await loadSource(source);
    applyOverrides(config, overrides);
    const report = runPipeline(rows, headers, config);
    return Response.json(report);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
