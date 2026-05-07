// 우리 에디터에서 사용하는 변수 표기법을 Brevo의 메일 머지 표기법으로 변환한다.
//   {{name}}            → {{contact.NAME}}
//   {{email}}           → {{contact.EMAIL}}
//   {{unsubscribe_url}} → {{ unsubscribe }}
//   {{list_name}}       → 그대로 둠 (Brevo에 매핑되는 변수 없음. 발송 시 정적 치환 필요)
export function rewriteTemplateVarsForBrevo(html: string): string {
  return html
    .replaceAll("{{name}}", "{{contact.NAME}}")
    .replaceAll("{{email}}", "{{contact.EMAIL}}")
    .replaceAll("{{unsubscribe_url}}", "{{ unsubscribe }}");
}
