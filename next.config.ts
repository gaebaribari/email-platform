import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // /api/migration 이 런타임에 migration/sources/*.yaml 을 fs로 읽는다.
  // 동적 경로라 자동 추적이 안 되므로 서버리스 번들에 명시적으로 포함시킨다 (Vercel 배포 대비).
  outputFileTracingIncludes: {
    "/api/migration": ["./migration/sources/**"],
  },
};

export default nextConfig;
