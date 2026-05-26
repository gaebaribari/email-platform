import { MigrationPanel } from "@/components/migration-panel";

// 모달과 동일한 UI를 직접 URL로도 열 수 있게 라우트로 노출 (공유 컴포넌트 재사용).
export default function MigrationPage() {
  return <MigrationPanel />;
}
