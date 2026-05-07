// 이메일 리스트 (Brevo Lists)
export interface EmailList {
  id: number;
  name: string;
  description: string; // Brevo는 description을 지원하지 않음. UI용 placeholder.
  created_at: string;
  subscriberCount?: number;
}

// 구독자 (Brevo Contact)
// 더블옵트인 1단계의 pending 상태는 JWT 안에만 존재하고 Brevo Contact으로는 만들어지지 않는다.
// 따라서 status는 verified | unsubscribed 둘만 존재한다.
export interface Subscriber {
  id: number;
  email: string;
  name: string;
  list_id: number;
  list_ids: number[];
  status: "verified" | "unsubscribed";
  gdpr_consent: boolean;
  subscribed_at: string;
  verified_at: string;
}

// 캠페인 (Brevo Email Campaign)
export interface Campaign {
  id: number;
  name: string;
  subject: string;
  list_id: number;
  template: string;
  status: "draft" | "scheduled" | "sent";
  scheduled_at: string;
  sent_at: string;
  sent_count: number;
  created_at: string;
  listName?: string;
}

// 이메일 템플릿 변수 (Brevo의 메일 머지 표기법으로 발송 시 변환됨)
export const TEMPLATE_VARIABLES = [
  { key: "{{name}}", label: "이름", example: "홍길동" },
  { key: "{{email}}", label: "이메일", example: "user@example.com" },
  { key: "{{unsubscribe_url}}", label: "수신거부 링크", example: "#" },
] as const;
