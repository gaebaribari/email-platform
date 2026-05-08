# Architecture — Email Platform

## 한 줄 요약
자체 DB 없이 **Brevo를 백엔드 데이터스토어**로 사용하고, 더블옵트인 인증은 **JWT 토큰**으로 stateless하게 처리하는 Next.js 기반 뉴스레터 플랫폼.

---

## 시스템 구성

```
┌────────────────────────────────────────────────────────────┐
│  Browser                                                    │
│  ─ /subscribe        구독 신청 폼 (GDPR 동의 모달 포함)     │
│  ─ /subscribe/verify 인증 완료 안내                          │
│  ─ /admin/*          리스트·구독자·캠페인 관리              │
└─────────────────┬──────────────────────────────────────────┘
                  │ fetch
                  ▼
┌────────────────────────────────────────────────────────────┐
│  Next.js Route Handlers (src/app/api/**)                    │
│  ─ /api/subscribe          POST(JWT 발급+메일) / GET(검증)  │
│  ─ /api/lists              CRUD                             │
│  ─ /api/subscribers        CRUD + CSV import                │
│  ─ /api/campaigns          CRUD                             │
│  ─ /api/campaigns/[id]/send                                 │
└─────────────────┬──────────────────────────────────────────┘
                  │ @getbrevo/brevo SDK 5.x (BrevoClient)
                  ▼
┌────────────────────────────────────────────────────────────┐
│  Brevo                                                      │
│  ─ Contacts (= 구독자)        attributes: NAME, GDPR_…     │
│  ─ Lists (= 이메일 리스트)                                   │
│  ─ Email Campaigns (= 캠페인)                                │
│  ─ Transactional Emails (= 인증 메일)                        │
└────────────────────────────────────────────────────────────┘
```

데이터베이스를 직접 운영하지 않는다. 모든 영속 상태는 Brevo 안에 있고, 우리 서버는 Next.js 라우트 핸들러로 SDK를 호출만 한다.

---

## 더블옵트인 플로우

```
사용자가 이메일 입력
       │
       ▼
POST /api/subscribe ──────────────────────┐
  payload: {email, name, list_id,         │  ① JWT 발급
            gdpr_consent}                  │     payload: {email, name,
       │                                    │              list_id,
       ▼                                    │              gdpr_consent}
  signVerifyToken(payload)                 │     exp: 30m
       │                                    │     issuer: "email-platform"
       ▼                                    │
  Brevo Transactional API로 메일 발송      │  ② 인증 메일에는 토큰만 들어감
  본문에 https://…/verify?token=<JWT>     │     (Brevo Contact 아직 안 만듦)
       │                                    │
       ▼                                    │
  사용자 → 이메일 → 링크 클릭             │
       │                                    │
       ▼                                    │
GET /api/subscribe?token=<JWT> ───────────┘
  verifyVerifyToken(token)
       │
       │ 유효하면 payload 복원
       ▼
  Brevo contacts.createContact({
    email, listIds: [list_id],
    updateEnabled: true,                   ③ 인증 시점에 비로소 Brevo Contact 생성
    attributes: {NAME, GDPR_CONSENT,
                 VERIFIED_AT}
  })
       │
       ▼
  /subscribe/verify 페이지에 성공 표시
```

### 왜 이런 구조?

1. **인증 안 된 이메일은 Brevo에 들어가지 않는다.** Brevo의 contact 한도(무료 플랜 300/일 발송, 컨택트 무제한이지만 정리된 상태 유지)가 깨끗해진다.
2. **서버는 stateless.** "토큰 발급 → 어딘가에 저장 → 클릭 시 조회"가 아니라 "토큰 자체에 정보를 서명해서 넣는다." 검증할 때 별도 조회가 필요 없다.
3. **만료를 토큰이 강제한다.** `exp: 30m`만 박아두면 따로 cron으로 stale pending 정리할 필요가 없다. (피싱 위험 최소화 목적으로 짧게 둠)

---

## Brevo 데이터 모델 매핑

| 도메인 개념 | Brevo 리소스 | 비고 |
|---|---|---|
| 이메일 리스트 | `Lists` (folder 안에 위치) | description 필드 없음. UI에선 빈 문자열로 채움 |
| 구독자 | `Contacts` | attributes로 NAME / GDPR_CONSENT / VERIFIED_AT 저장 |
| 구독자 status | `emailBlacklisted` 플래그 | true면 "수신거부", 아니면 "인증완료" |
| 캠페인 | `Email Campaigns` (`type: "classic"`) | recipients.lists에 대상 listId 배열 |
| 인증 메일 | `Transactional Emails` (`sendTransacEmail`) | 캠페인이 아닌 1:1 트랜잭셔널 |

### 커스텀 attribute 자동 생성
앱 첫 사용 시 `ensureAttributes()`가 한 번만 실행되어 NAME(text) / GDPR_CONSENT(boolean) / VERIFIED_AT(date)를 Brevo에 등록한다. 이미 존재하면 무시.

### 폴더 자동 확보
Brevo Lists는 반드시 폴더 안에 있어야 한다. `getDefaultFolderId()`는 `BREVO_FOLDER_ID`가 있으면 그걸 쓰고, 없으면 `BREVO_FOLDER_NAME`(기본 "newsletter") 폴더를 찾거나 만든다.

---

## 템플릿 변수 변환

에디터에서는 직관적인 표기법을 쓰고, 발송 직전(`createEmailCampaign`/`updateEmailCampaign`)에 Brevo의 메일 머지 표기법으로 자동 변환한다.

| 에디터 표기 | Brevo 표기 | 의미 |
|---|---|---|
| `{{name}}` | `{{contact.NAME}}` | 커스텀 attribute |
| `{{email}}` | `{{contact.EMAIL}}` | 빌트인 |
| `{{unsubscribe_url}}` | `{{ unsubscribe }}` | Brevo가 제공하는 빌트인 unsubscribe 링크 |

`src/lib/template.ts`의 `rewriteTemplateVarsForBrevo()` 한 함수에서 처리.

---

## 모듈 구성

```
src/lib/
  brevo.ts            BrevoClient 싱글톤, sender, 폴더/attribute 보장
  brevo-error.ts      BrevoError → 사용자 메시지 추출
  email.ts            sendVerificationEmail (트랜잭셔널)
  jwt.ts              signVerifyToken / verifyVerifyToken (30m)
  template.ts         에디터 표기법 → Brevo 표기법 변환
  types.ts            UI에서 쓰는 도메인 타입
  validation.ts       zod 스키마 (구독 폼, 리스트, 캠페인)

src/app/api/
  subscribe/route.ts            POST(메일 발송) + GET(인증)
  lists/route.ts                GET / POST / PUT / DELETE
  subscribers/route.ts          GET (filter) / POST (단건 + CSV) / DELETE
  campaigns/route.ts            CRUD
  campaigns/[id]/send/route.ts  sendEmailCampaignNow

src/app/
  subscribe/page.tsx            구독 폼 + GDPR 동의 모달
  subscribe/verify/page.tsx     /api/subscribe?token=... 호출
  admin/                        관리자 페이지들
```

---

## 환경변수

| 키 | 용도 |
|---|---|
| `BREVO_API_KEY` | Brevo API 키 (필수) |
| `BREVO_SENDER_EMAIL` | 발송자 이메일 (Brevo에서 verified) |
| `BREVO_SENDER_NAME` | 발송자 표시 이름 |
| `BREVO_FOLDER_ID` / `BREVO_FOLDER_NAME` | 리스트가 들어갈 폴더 (선택) |
| `JWT_SECRET` | 인증 토큰 서명키 (필수, 32바이트 이상 권장) |
| `APP_BASE_URL` | 인증 메일 안의 링크 도메인 |

---

## 트레이드오프

### 우리가 얻은 것
- **외부 DB 0개.** 인프라가 단순. Vercel + Brevo만으로 운영 가능.
- **인증 메일 인프라 무료.** Brevo 무료 플랜(300/일)으로 충분.
- **콘텐츠 관리 분리.** 비개발자도 Brevo 대시보드에서 컨택트/캠페인을 직접 볼 수 있음.

### 우리가 포기한 것
- **"pending" 상태가 사라짐.** 인증 전에는 어디에도 저장 안 되므로 "인증 안 한 사용자 N명" 같은 통계 불가. (대신 30분 후 자동 만료)
- **Brevo 응답 latency.** 모든 admin 페이지 조회가 외부 API call. 캐싱 안 함.
- **Brevo Lists에 description 없음.** UI상으로는 빈 값.
- **벤더 락인.** Brevo가 망하거나 가격 정책 바뀌면 마이그레이션 비용 발생.
