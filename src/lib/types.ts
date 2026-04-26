export interface EmailList {
  id: number;
  name: string;
  description: string;
  created_at: string;
  subscriberCount?: number;
}

export interface Subscriber {
  id: number;
  email: string;
  name: string;
  list_id: number;
  status: "pending" | "verified" | "unsubscribed";
  token: string;
  gdpr_consent: boolean;
  subscribed_at: string;
  verified_at: string;
}

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

// 이메일 템플릿 변수
export const TEMPLATE_VARIABLES = [
  { key: "{{name}}", label: "이름", example: "홍길동" },
  { key: "{{email}}", label: "이메일", example: "user@example.com" },
  { key: "{{list_name}}", label: "리스트명", example: "뉴스레터" },
  { key: "{{unsubscribe_url}}", label: "수신거부 링크", example: "#" },
] as const;
