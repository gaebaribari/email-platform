import Link from "next/link";
import { Mail, Shield, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <Mail className="w-6 h-6 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Email Platform</h1>
        <p className="text-sm text-muted-foreground mb-8">
          더블옵트인 이메일 마케팅 플랫폼
        </p>

        <div className="space-y-3">
          <Link
            href="/subscribe"
            className="flex items-center gap-3 p-4 bg-background border border-border rounded-lg hover:shadow-sm transition-shadow text-left"
          >
            <Shield className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">뉴스레터 구독</p>
              <p className="text-xs text-muted-foreground">
                더블옵트인으로 안전하게 구독하기
              </p>
            </div>
          </Link>

          <Link
            href="/admin"
            className="flex items-center gap-3 p-4 bg-background border border-border rounded-lg hover:shadow-sm transition-shadow text-left"
          >
            <Users className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">관리자 대시보드</p>
              <p className="text-xs text-muted-foreground">
                구독자 관리 및 통계 확인
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
