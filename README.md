# Email Platform

> 자체 DB 없이 **Brevo**를 데이터스토어 겸 발송 인프라로 사용하고, 더블옵트인 인증을 **JWT**로 stateless하게 처리한 뉴스레터 플랫폼. 개인 학습용 재구현 프로젝트.

## 라이브 데모

- https://email-platform-mu.vercel.app

## 핵심 포인트

- **외부 DB 0개.** 모든 영속 상태는 Brevo Contacts/Lists/Email Campaigns에. 1인 운영 부담 최소화.
- **더블옵트인 stateless 처리.** 인증 토큰을 DB row 대신 JWT로. 페이로드(`email`, `name`, `list_id`, `gdpr_consent`)에 서명해서 클릭 시점까지 서버 상태 0. 인증 클릭 시점에야 Brevo Contact 생성 → 미인증 이메일이 데이터에 들어가지 않음.
- **30분 만료.** `exp: 30m`로 stale pending 자동 정리. 별도 cron 불필요.
- **GDPR 동의 모달.** 단순 체크박스가 아니라 "처리방침 → 명시적 동의" 플로우로 다크 패턴 회피.
- **변수 머지 자동 변환.** 에디터의 `{{name}}` → 발송 직전 Brevo 머지 표기 `{{contact.NAME}}`로 변환 후 Brevo가 발송. 우리가 직접 N번 호출하지 않음.
- **데이터 마이그레이션 파이프라인.** 소스마다 컬럼명·값 표기가 제각각인 CSV를 매핑 정의(YAML)로 표준화 → 3단계 검증 → 표준 구독자 모델로 이관. 아래 별도 섹션 참고.

## 데이터 마이그레이션 파이프라인

타 뉴스레터 툴마다 컬럼명·값 표기가 제각각인 이종(異種) 데이터를, **매핑 정의(YAML)** 로 표준화하고 **3단계 검증**을 거쳐 표준 구독자 모델로 이관하는 설정 기반 ETL. 관리자 화면에선 **"구독자 일괄 추가"** 버튼(모달)으로 노출되며, CSV 업로드 또는 샘플 데이터로 실행한다.

### 설계의 핵심 세 가지

1. **매핑을 코드가 아닌 데이터로.** 소스별 컬럼 후보(별칭)·값 정규화 사전을 [`migration/sources/*.yaml`](migration/sources/)에 둔다. 새 소스 = 코드 변경 없이 YAML 한 장. 컬럼 매칭은 **대소문자·공백 무시**, 필수 항목은 특정 컬럼명이 아니라 **"필드가 매핑 가능한가"** 로 검사 → `Email`/`email`/`이메일`/`E-mail` 어떤 표기든 인식.
2. **검증을 3단계로 분리.** `pre`(원천 구조) → `post`(타깃 스키마: 이메일 형식·배치 내 중복) → `reconcile`(원천 = 추가 + 제외 + 빈행 정합성 검산). 어느 단계에서 깨졌는지 추적 가능.
3. **값 정규화 + 예외 집계.** `country`(한국/대한민국/KR → `KR`), `status`(active/subscribed → verified, inactive/pending → unsubscribed) 등을 표준값으로. 표준화 못한 값은 버리지 않고 `(필드, 원값)` 빈도로 집계해 리포트에 남긴다.

```
migration/sources/*.yaml              매핑 정의 (코드 밖 데이터)
src/lib/migration/
  ├ transform.ts                      매핑 적용 + 값 정규화 (대소문자 무시)
  ├ validate.ts                       pre / post / reconcile 3단계 검증
  ├ report.ts                         미매핑 값 → 예외 패턴 집계
  └ pipeline.ts                       stage 오케스트레이션 → 리포트
src/lib/demo-store.ts                 데모 모드 localStorage 데이터스토어
src/components/migration-panel.tsx    일괄 추가 UI (미리보기·제외·추가)
src/components/import-button.tsx      "구독자 일괄 추가" 버튼 + 모달
src/app/api/migration/route.ts        업로드 → 파이프라인 실행 (dry-run)
src/app/api/migration/commit/route.ts 검증 통과분 적재 / 정리
```

> 샘플 데이터([`public/migration-samples/`](public/migration-samples/))로 바로 실행해볼 수 있다. 오타·다국어 국가 표기·중복 이메일·잘못된 형식·다양한 상태값 등 실제 레거시 데이터의 지저분함을 의도적으로 담았다.

### 결과 화면 (사용자 관점)

엔진의 내부(검증 단계·정규화 로직)는 노출하지 않고, 결과만 사람의 언어로 보여준다.

- **불러온 데이터 미리보기** — 업로드/샘플 원본을 표로 확인
- **제외된 항목** — 이메일 형식 오류·중복·빈 이메일 등을 *사람이 읽는 사유*로 표시
- **"N명을 추가할 수 있어요" → "N명 추가하기"** — 추가하면 구독자 목록 상단에 반영(최신순), 행 체크박스로 선택 삭제

### 데모 모드 (`NEXT_PUBLIC_DEMO_MODE=true`)

공개 배포(Vercel)에서 방문자가 **실제 Brevo 계정을 오염시키지 못하도록**, 데이터 저장소를 Brevo 대신 **브라우저 localStorage**로 전환한다.

- **방문자별 격리** — 자기 브라우저에만 저장. 빈 상태에서 시작 → 추가하면 그 브라우저의 목록만 채워짐
- **전 경로 일관 처리** — 일괄 추가, 공개 폼 구독(더블옵트인 인증), 삭제까지 모두 localStorage 기준
- **실모드**(플래그 off, Brevo 키 설정) — 실제 Brevo Contact으로 적재(`createContact`만 호출, 메일 발송 0). 정규화한 `country`는 `COUNTRY` 속성으로 보존

> 즉 "데모는 완전히 격리된 모래상자, 실서비스는 Brevo"로 분리. 같은 코드가 환경변수 하나로 두 모드를 오간다.

## 기술 스택

| Layer | Choice |
|---|---|
| Frontend / Backend | Next.js 16 (App Router, Route Handlers) |
| Form / Validation | react-hook-form + zod |
| Email / Data Store | Brevo (`@getbrevo/brevo` SDK 5.x) |
| Auth Token | JWT (`jsonwebtoken`) |
| 마이그레이션 | YAML 매핑 정의(`yaml`), CSV 파싱(`papaparse`), zod 검증 |
| UI | Tailwind 4, lucide-react |

## 문서

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 시스템 구성도, 더블옵트인 플로우, 데이터 모델 매핑, 트레이드오프
- [docs/INTERVIEW.md](docs/INTERVIEW.md) — 의사결정 배경 (왜 외부 DB를 안 썼나, 왜 JWT인가, 보안 고려사항 등)

## 주요 라우트

```
GET  /subscribe                       구독 폼 (GDPR 동의 모달)
GET  /subscribe/verify?token=<JWT>    인증 결과
GET  /admin                           대시보드 (구독자 목록 + 일괄 추가/내보내기)
     /admin/lists                     리스트 CRUD
     /admin/subscribers               구독자 관리 (검색·필터·선택 삭제)
     /admin/migration                 구독자 일괄 추가 패널 (모달과 동일 UI)
     /admin/campaigns                 캠페인 작성/예약/발송

POST /api/subscribe                   더블옵트인 1단계 (JWT 발급 + 메일)
GET  /api/subscribe?token=<JWT>       더블옵트인 2단계 (인증 → 적재 / 데모면 localStorage)
GET  /api/migration                   매핑 소스 목록
POST /api/migration                   업로드 데이터 파이프라인 실행 (dry-run 리포트)
POST /api/migration/commit            검증 통과분 적재 / DELETE 로 정리
*    /api/lists | /api/subscribers | /api/campaigns
POST /api/campaigns/[id]/send         Brevo sendEmailCampaignNow
```
