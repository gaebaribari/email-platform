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
- **데이터 마이그레이션 파이프라인.** 소스마다 제각각인 레거시 export를 매핑 정의(YAML)로 표준화 → 3단계 검증 → 구독자 모델로 이관. 아래 별도 섹션 참고.

## 데이터 마이그레이션 파이프라인

이종(異種) 원천 데이터(폐기된 CRM, 타 뉴스레터 툴 export 등)를 표준 구독자 모델로 옮기는 설정 기반 ETL. `/admin/migration`에서 업로드/실행하고 단계별 결과를 대시보드로 본다.

설계의 핵심 세 가지:

1. **매핑을 코드가 아닌 데이터로.** 소스별 컬럼 매핑·값 정규화 규칙을 [`migration/sources/*.yaml`](migration/sources/)에 둔다. 새 소스 추가 = 코드 변경 없이 YAML 한 장 추가. 비개발자도 작성 가능한 형태라 신규 온보딩 속도를 좌우한다.
2. **검증을 3단계로 분리.** 변환 *전*(원천 구조), *후*(타깃 스키마), *적재 검산*(원천=적재+탈락+빈행 정합성)으로 나눠 "어느 단계에서 깨졌는지" 추적 가능하게 한다. "옮긴 뒤에 잘못을 발견"하는 사고를 막는 구조.
3. **예외 패턴 로거.** 표준화하지 못한 값을 버리지 않고 `(필드, 원값)` 빈도로 집계해 리포트한다. 운영자가 그 값을 YAML에 한 줄 추가하면 다음 이관부터 자동 처리 → 반복되는 예외 케이스가 점진적으로 사라진다.

```
migration/sources/*.yaml             ① 매핑 정의 (코드 밖 데이터)
src/lib/migration/
  ├ transform.ts                      매핑 적용 + 값 정규화
  ├ validate.ts                       ② pre / post / reconcile 3단계 검증
  ├ report.ts                         ③ 미매핑 값 → 예외 패턴 집계
  └ pipeline.ts                       stage 오케스트레이션 → 리포트
src/app/api/migration/route.ts        업로드 → 파이프라인 실행 (dry-run)
src/app/api/migration/commit/route.ts 검증 통과분을 Brevo Contact으로 적재 (Load) / 정리
src/app/admin/migration/page.tsx      단계별 funnel · 예외 패턴 · 변환 전후 대조 대시보드
```

> 샘플 데이터([`public/migration-samples/`](public/migration-samples/))로 바로 실행해볼 수 있다. 오타·다국어 표기·중복 이메일·잘못된 형식·이름 분리(First/Last) 등 실제 레거시 데이터의 지저분함을 의도적으로 담았다.

### 시연(demo) 흐름

`/admin/migration` → 소스 선택 → **"샘플 데이터로 실행"** → 대시보드에서 단계별 결과 확인.

- **Extract → Transform → Validate (dry-run).** 업로드/실행은 검증·변환·리포트까지만 수행하고 아무것도 저장하지 않는다. "이렇게 옮겨진다"를 적재 전에 미리 본다.
- **Load (실 적재).** 대시보드의 **"N건 적재"** 버튼이 검증 통과분만 Brevo Contact으로 적재한다(`createContact`만 호출 — 메일 발송 없음 → 발송 쿼터 영향 0). 정규화한 `country`는 `COUNTRY` 속성으로 보존된다. 옆의 **"적재분 삭제"**로 방금 넣은 테스트 데이터를 한 번에 정리할 수 있다.
- **③ 예외 → 매핑 → 재실행 루프 (핵심 시연).** 예외 테이블에서 미매핑 값(예: `country = 독일`)을 표준값(`KR`)에 매핑하면 **그 자리에서 재실행**되어 해당 예외가 사라진다. 반복되는 예외를 매핑에 흡수시켜 온보딩을 점진적으로 자동화하는 과정을 라이브로 보여주는 부분.

> **매핑 편집의 영속화 범위 (의도적 설계).** 위 "예외 → 매핑 추가"는 편집한 규칙을 **클라이언트 메모리에 들고 매 실행 요청에 함께 전송**하는 방식이다(새로고침하면 초기화). 디스크의 YAML을 직접 쓰지 않으므로 서버리스(Vercel) 배포에서도 동작한다. "비개발자가 화면에서 매핑을 작성한다"는 ①의 확장을 **서버 상태 없이** 시연하기 위한 선택이며, 운영 환경에서 매핑을 영구 저장하려면 파일 쓰기 대신 KV/DB 영속화로 가는 것이 자연스럽다(이 프로젝트의 "외부 DB 0개" 컨셉과의 트레이드오프).

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
