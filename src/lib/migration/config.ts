import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { SourceConfig } from "./types";

// 매핑 정의(YAML)는 코드 밖 migration/sources/ 에 산다.
// 새 소스 추가 = 이 폴더에 YAML 한 장 추가. 코드 변경·재배포 없음. (포인트 ①)
const SOURCES_DIR = path.join(process.cwd(), "migration", "sources");

/** 사용 가능한 소스 매핑 목록 (드롭다운용 메타) */
export async function listSources(): Promise<
  Array<Pick<SourceConfig, "name" | "label" | "description">>
> {
  const files = await readdir(SOURCES_DIR);
  const configs = await Promise.all(
    files
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
      .map((f) => loadSource(path.basename(f, path.extname(f))))
  );
  return configs.map(({ name, label, description }) => ({
    name,
    label,
    description,
  }));
}

/** 이름으로 소스 매핑 정의를 읽어 파싱 */
export async function loadSource(name: string): Promise<SourceConfig> {
  // 경로 조작 방지: 파일명에 디렉터리 구분자가 끼어들지 못하게 한다.
  if (!/^[a-z0-9_-]+$/i.test(name)) {
    throw new Error(`잘못된 소스 이름: ${name}`);
  }
  const raw = await readFile(path.join(SOURCES_DIR, `${name}.yaml`), "utf-8");
  const config = parseYaml(raw) as SourceConfig;
  if (!config?.name || !config.fields) {
    throw new Error(`매핑 정의가 올바르지 않습니다: ${name}`);
  }
  return config;
}
