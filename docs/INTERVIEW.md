# 면접 대비 노트 — Email Platform

이 문서는 포트폴리오로 이 프로젝트를 들고 면접 갔을 때 어떤 질문이 나올지, 그리고 어떤 의도로 이런 결정을 했는지 정리한 것이다.

---

## 30초 엘리베이터 피치

> "더블옵트인 기반 뉴스레터 구독·캠페인 발송 플랫폼입니다. 외부 DB 없이 Brevo를 데이터 저장소 겸 발송 인프라로 쓰고, 인증 토큰은 서버 상태 없이 JWT로 처리해서 stateless하게 만들었습니다. Next.js Route Handlers로 백엔드를 구성했고, 관리자 페이지에서 리스트·구독자·캠페인 CRUD와 CSV 임포트를 지원합니다."

---

## 예상 질문 & 답변

### Q1. 왜 외부 DB를 안 쓰고 Brevo에 다 넣었어요?

**핵심 답:**
- 이 프로젝트의 모든 데이터(구독자, 리스트, 캠페인)는 결국 메일 발송을 위한 데이터다. 그러면 발송 인프라가 곧 데이터의 1차 source-of-truth여도 된다.
- DB를 따로 두면 (1) DB 호스팅 비용, (2) Brevo 동기화 로직, (3) 두 시스템의 일관성 책임이 늘어난다. 1인 개발/MVP 단계에서는 과한 비용.
- 무료 호스팅 옵션도 적었다. (Vercel 위 Next.js + 무료 MySQL은 옵션이 거의 없었음 — TiDB Serverless, Aiven 1개월 trial 정도)

**역질문 받을 만한 것:** "그럼 Brevo가 down 되면?"
→ 사용자 입장에서는 메일 자체가 안 나가니까 어차피 서비스가 실질적으로 죽는 상황. DB가 따로 있다고 가용성이 올라가지 않는다. 단, 제품이 커져서 "발송 외 분석/세그먼트" 등이 늘어나면 그때 자체 DB로 옮길 수 있게 추상화 레이어(`src/lib/brevo.ts`)는 분리해뒀다.

---

### Q2. 더블옵트인 인증을 왜 JWT로? DB의 token 컬럼이 표준 아닌가요?

**핵심 답:**
- DB의 token 컬럼 방식의 전제는 "token으로 사용자 행을 빠르게 조회할 수 있다"이다. 그런데 우리 데이터스토어인 Brevo는 **attribute 값으로 contact를 검색하는 API가 약하다.** email/contact_id로만 빠르게 조회된다.
- 그래서 token으로 검색하지 말고, **token 자체가 정보를 담고 있게** 하면 조회 자체가 필요 없어진다. 그게 JWT.
- 부수효과로 (1) 만료시간(`exp: 24h`)이 자동 강제, (2) issuer 검증으로 위변조 차단, (3) 서버는 완전히 stateless해진다.

**구체 코드:**
```ts
// src/lib/jwt.ts
export function signVerifyToken(payload: VerifyTokenPayload): string {
  return jwt.sign(payload, SECRET, {
    expiresIn: "24h",
    issuer: "email-platform",
  });
}
```

**페이로드에 뭘 넣었나:**
- `email`, `name`, `list_id`, `gdpr_consent`
- 즉, "이 사람이 인증을 완료했을 때 만들어줘야 할 Brevo Contact의 모든 정보"가 토큰 안에 들어있다.
- 인증 클릭 시점에야 Brevo Contact을 만든다 → 미인증 이메일이 Brevo에 들어가지 않음.

**약한 점도 솔직하게:**
- JWT는 **취소(revoke)가 어렵다.** 만료 전에는 무효화 못 함. 우리 케이스는 24시간이라 영향 작음.
- 비밀키 유출 시 모든 토큰이 위험. → `JWT_SECRET` 환경변수로 분리 + 운영 시 rotation 가능.

---

### Q3. JWT 안에 list_id를 넣으면, 사용자가 토큰을 디코딩해서 list_id를 바꿔치기할 수 있지 않나요?

**핵심 답:** 못 한다. JWT는 "암호화"가 아니라 "**서명**"이다.
- 누구나 base64 디코딩으로 페이로드를 **읽을 수**는 있지만, `JWT_SECRET`이 없으면 **서명을 다시 만들 수 없다.**
- 페이로드를 1바이트라도 바꾸면 서명 검증이 실패한다.
- 그래서 list_id 같은 값도 안전하게 넣을 수 있다.

**민감 정보는?:** JWT에 비밀번호나 진짜 PII는 절대 넣지 않는다 — 디코딩으로 읽을 수 있으니까. 우리는 사용자가 본인 이메일/이름만 넣고 있어서 노출되어도 본인 정보일 뿐.

---

### Q4. Brevo Contact의 status를 어떻게 표현했어요? Brevo에는 verified/pending/unsubscribed 같은 상태 필드가 없을 텐데.

**핵심 답:**
- **pending은 만들지 않았다.** 인증 안 된 사용자는 Brevo에 contact 자체가 안 들어간다. 그 상태는 JWT 안에만 존재하고 24시간 후 사라진다.
- **verified vs unsubscribed는 `emailBlacklisted` 플래그로 구분.** Brevo 내장 필드를 그대로 활용.
- `src/lib/brevo.ts`의 `statusOf()` 한 함수가 contact를 받아서 둘 중 하나로 매핑한다.

**왜 pending을 포기했나:** 
- "인증 메일 보냈지만 안 누른 사람" 통계는 사실상 액션 가능한 정보가 아니다. 그 사람들에게 또 메일을 쏘면 스팸이 된다.
- 트레이드오프 인식하고 의도적으로 단순하게 갔다는 게 핵심.

---

### Q5. Brevo SDK가 5.x로 메이저 업그레이드되어 있던데, 마이그레이션은 어떻게 했어요?

**핵심 답:**
- 처음 통합 시도 때 4.x 시절 패턴(`new Brevo.TransactionalEmailsApi()`)으로 코드를 짰는데 type error가 났다.
- `node_modules/@getbrevo/brevo/dist/cjs/` 안의 `.d.ts`를 직접 읽어서 새 API를 파악했다 (`BrevoClient` 단일 진입점, `client.contacts.*` / `client.emailCampaigns.*` 형태).
- 응답 unwrap 방식도 바뀌었다 (`HttpResponsePromise<T>`가 `.then(t => t)`으로 그냥 풀린다 — 4.x의 `.body` 같은 wrapper 없음).
- 한 번에 다 바꾸지 않고 `src/lib/brevo.ts`에 어댑터 레이어를 두고, 그 위에서 라우트 핸들러를 호출하게 했다.

**배운 점:** 외부 SDK가 빠르게 변할 가능성이 있을 때는 자체 어댑터 레이어가 미래의 마이그레이션 비용을 줄여준다.

---

### Q6. 캠페인 발송 시 변수 치환은 누가 하나요?

**핵심 답:**
- 우리가 직접 안 한다. **Brevo가 한다.**
- 우리는 에디터에서 사용하기 편한 표기법(`{{name}}`)을 쓰고, 발송 직전 `rewriteTemplateVarsForBrevo()`에서 Brevo의 메일 머지 표기법(`{{contact.NAME}}`)으로 변환만 한다.
- 그 후 `createEmailCampaign`을 호출하면 Brevo가 각 contact의 attribute 값을 꽂아서 발송한다.

**왜 직접 하지 않았나:**
- 직접 하려면 모든 구독자를 fetch → 변수 치환 → 트랜잭셔널 API로 N번 호출 = 느리고, rate limit 걸리고, 발송 실패 추적도 직접 해야 함.
- Brevo가 캠페인 단위 발송 + 통계까지 다 해주는 걸 그대로 활용.

---

### Q7. 보안 관련해서 신경 쓴 부분은?

1. **DB 자격증명 하드코딩 제거** — 이전엔 `host: "localhost"` 식으로 박혀 있었던 걸 환경변수로. (마이그레이션 후 DB 자체가 사라졌지만 해당 commit history 보여줄 수 있음)
2. **JWT 비밀키 분리** — 코드에 넣지 않고 `JWT_SECRET` env로.
3. **GDPR 모달** — 동의 체크박스가 "텍스트 옆 체크박스"가 아니라, 클릭하면 **개인정보 처리방침 모달이 뜨고 거기서 명시적으로 "동의하기" 버튼을 눌러야** 체크된다. 다크 패턴 회피.
4. **HTML escape** — 인증 메일에 사용자가 입력한 이름이 들어갈 때 `escapeHtml()` 적용해서 XSS 차단.
5. **인증 메일 만료** — JWT `exp: 24h`로 만료된 토큰 자동 거부.

**더 했으면 좋았을 것:**
- Rate limiting (같은 IP에서 1분에 N회 이상 구독 시도 차단). `@upstash/ratelimit` 검토 중.
- 관리자 페이지 인증. 지금은 누구나 `/admin`에 들어갈 수 있음. 운영 배포 시엔 NextAuth/Clerk/basic auth 추가 예정.

---

### Q8. 테스트는?

솔직하게 답변:
- **단위 테스트는 안 짰다.** MVP 단계라서 의도적으로 미뤘다.
- 대신 (1) `npm run build`로 타입 + 빌드 검증, (2) 핵심 플로우(구독 → 인증 메일 → 클릭 → Brevo Contact 생성)를 수동으로 E2E 검증.
- 추가하면 좋을 곳: `src/lib/jwt.ts` (만료/위변조 케이스), `src/lib/template.ts` (치환 정확성), API 라우트의 입력 검증 (zod 스키마와 함께).

---

### Q9. 배포는 어떻게 할 계획?

- **앱:** Vercel (Next.js 표준, 무료 Hobby)
- **데이터:** Brevo (앱 외부)
- **DB:** 없음
- **도메인 인증:** Brevo sender 도메인에 SPF/DKIM 등록 필요. 안 하면 스팸함 직행.
- **환경변수:** Vercel 프로젝트 설정에 `BREVO_API_KEY`, `JWT_SECRET`, `APP_BASE_URL`(실제 도메인) 입력.
- **주의:** `APP_BASE_URL`을 실제 배포 도메인으로 안 바꾸면 인증 메일 안의 링크가 localhost를 가리킨다.

---

### Q10. 다시 짠다면 뭘 바꾸겠어요?

1. **rate limiting 처음부터 넣기.** 스팸 봇이 구독 폼 두드리면 Brevo 발송 한도 금방 소진된다.
2. **관리자 인증.** 처음부터 NextAuth 세팅. 나중에 추가하는 게 더 비용 큼.
3. **webhook 기반 통계.** Brevo의 메일 열람/클릭 webhook을 받아서 캠페인 상세 페이지에 open rate/click rate 표시. 이게 사실상 "왜 우리가 이 플랫폼을 쓰는가"의 핵심 가치.
4. **에디터 개선.** 지금 textarea + 변수 삽입 버튼인데, MJML 같은 이메일 템플릿 언어 지원하거나 드래그앤드롭 빌더 도입.
5. **작은 통합 테스트라도.** Brevo SDK를 모킹한 라우트 테스트를 1~2개라도 짰을 것.

---

## 자주 보는 함정 질문

**Q. "Next.js 서버 컴포넌트인데 fetch가 왜 안 캐시되죠?"**
→ Next 15+에서 fetch는 **기본적으로 캐시 안 된다.** 명시적으로 `cache: 'force-cache'`나 route segment config(`export const revalidate = ...`)를 줘야 캐시된다. 우리 라우트는 모두 동적이라 캐시 안 함.

**Q. "JWT vs Session, 언제 뭐 쓰죠?"**
→ JWT는 우리처럼 **stateless + 짧은 수명 + 데이터를 담아 전달**할 때. Session은 **로그인 상태 유지 + 즉시 revoke 가능**해야 할 때. 인증 메일 토큰은 JWT가 맞고, 관리자 로그인은 session이 맞다.

**Q. "Brevo 무료 플랜 한도 넘으면?"**
→ 하루 300통 발송 한도. 캠페인을 5000명에게 쏘면 못 보낸다. 그땐 Starter 플랜($25/월) 또는 SES(저렴) 같은 다른 sender로 갈아끼울 수 있게 `src/lib/email.ts`를 추상화해뒀다.
