# Email Platform

> 자체 DB 없이 **Brevo**를 데이터스토어 겸 발송 인프라로 사용하고, 더블옵트인 인증을 **JWT**로 stateless하게 처리한 뉴스레터 플랫폼. 개인 학습용 재구현 프로젝트.

## 핵심 포인트

- **외부 DB 0개.** 모든 영속 상태는 Brevo Contacts/Lists/Email Campaigns에. 1인 운영 부담 최소화.
- **더블옵트인 stateless 처리.** 인증 토큰을 DB row 대신 JWT로. 페이로드(`email`, `name`, `list_id`, `gdpr_consent`)에 서명해서 클릭 시점까지 서버 상태 0. 인증 클릭 시점에야 Brevo Contact 생성 → 미인증 이메일이 데이터에 들어가지 않음.
- **30분 만료.** `exp: 30m`로 stale pending 자동 정리. 별도 cron 불필요.
- **GDPR 동의 모달.** 단순 체크박스가 아니라 "처리방침 → 명시적 동의" 플로우로 다크 패턴 회피.
- **변수 머지 자동 변환.** 에디터의 `{{name}}` → 발송 직전 Brevo 머지 표기 `{{contact.NAME}}`로 변환 후 Brevo가 발송. 우리가 직접 N번 호출하지 않음.

## 기술 스택

| Layer | Choice |
|---|---|
| Frontend / Backend | Next.js 16 (App Router, Route Handlers) |
| Form / Validation | react-hook-form + zod |
| Email / Data Store | Brevo (`@getbrevo/brevo` SDK 5.x) |
| Auth Token | JWT (`jsonwebtoken`) |
| UI | Tailwind 4, lucide-react |

## 문서

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 시스템 구성도, 더블옵트인 플로우, 데이터 모델 매핑, 트레이드오프
- [docs/INTERVIEW.md](docs/INTERVIEW.md) — 의사결정 배경 (왜 외부 DB를 안 썼나, 왜 JWT인가, 보안 고려사항 등)

## 주요 라우트

```
GET  /subscribe                       구독 폼 (GDPR 동의 모달)
GET  /subscribe/verify?token=<JWT>    인증 결과
GET  /admin                           대시보드
     /admin/lists                     리스트 CRUD
     /admin/subscribers               구독자 관리 + CSV import/export
     /admin/campaigns                 캠페인 작성/예약/발송

POST /api/subscribe                   더블옵트인 1단계 (JWT 발급 + 메일)
GET  /api/subscribe?token=<JWT>       더블옵트인 2단계 (Brevo Contact 생성)
*    /api/lists | /api/subscribers | /api/campaigns
POST /api/campaigns/[id]/send         Brevo sendEmailCampaignNow
```
