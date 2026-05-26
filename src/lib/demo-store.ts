import type { Subscriber } from "./types";

// 데모 모드: 공개 배포에서 Brevo(실계정) 대신 브라우저 localStorage를 데이터스토어로 쓴다.
//  - 방문자마다 격리(자기 브라우저에만 저장) → 계정 오염 0, 세션처럼 동작
//  - 빈 상태에서 시작 → 샘플/CSV로 추가하면 그 브라우저의 목록이 찬다
// NEXT_PUBLIC_ 접두사라 클라이언트·서버 양쪽에서 읽힌다.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const KEY = "demo_subscribers";

export function getDemoSubscribers(): Subscriber[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Subscriber[];
  } catch {
    return [];
  }
}

function save(list: Subscriber[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

interface IncomingRecord {
  email: string;
  name: string;
  country?: string;
}

// 마이그레이션으로 추가된 레코드를 데모 목록에 병합한다.
// 상태는 전부 인증완료가 아니라 일부를 수신거부로 섞어 현실감을 준다.
export function addDemoSubscribers(records: IncomingRecord[]): number {
  const existing = getDemoSubscribers();
  const byEmail = new Map(existing.map((s) => [s.email.toLowerCase(), s]));
  let nextId = existing.reduce((m, s) => Math.max(m, s.id), 0) + 1;
  const now = new Date().toISOString();

  records.forEach((r, i) => {
    const email = r.email.trim();
    if (!email) return;
    // 약 1/4 을 수신거부로 (결정적이라 매번 동일하게 재현)
    const status: Subscriber["status"] =
      i % 4 === 3 ? "unsubscribed" : "verified";
    const prev = byEmail.get(email.toLowerCase());
    byEmail.set(email.toLowerCase(), {
      id: prev?.id ?? nextId++,
      email,
      name: r.name || "",
      list_id: 0,
      list_ids: [],
      status,
      gdpr_consent: true,
      subscribed_at: now,
      verified_at: status === "verified" ? now : "",
    });
  });

  save([...byEmail.values()]);
  return records.length;
}

export function deleteDemoSubscriber(id: number) {
  save(getDemoSubscribers().filter((s) => s.id !== id));
}

export function deleteDemoByEmails(emails: string[]) {
  const set = new Set(emails.map((e) => e.toLowerCase()));
  save(getDemoSubscribers().filter((s) => !set.has(s.email.toLowerCase())));
}
