import { getBrevo, SENDER } from "./brevo";

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<{ sent: boolean; verifyUrl: string }> {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/subscribe/verify?token=${encodeURIComponent(token)}`;

  if (!process.env.BREVO_API_KEY) {
    console.warn(
      "[Brevo] BREVO_API_KEY 미설정 — 메일 발송 스킵, 콘솔 로그만 출력"
    );
    console.log(`  (dev) 인증 링크: ${verifyUrl}`);
    return { sent: false, verifyUrl };
  }

  const html = `
    <div style="max-width: 480px; margin: 40px auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
      <h2 style="font-size: 18px; margin: 0 0 16px; color: #18181b;">이메일 구독 인증</h2>
      <p style="margin: 0 0 12px; color: #18181b;">
        안녕하세요${name ? `, <strong>${escapeHtml(name)}</strong>님` : ""}!
      </p>
      <p style="color: #6b7280; line-height: 1.6; margin: 0 0 20px;">
        뉴스레터 구독 신청이 접수되었습니다. 아래 버튼을 클릭하여 이메일 인증을 완료해주세요.
        <br /><span style="font-size: 12px;">이 링크는 24시간 후 만료됩니다.</span>
      </p>
      <a href="${verifyUrl}" style="display: inline-block; padding: 12px 28px; background: #18181b; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">
        구독 인증하기
      </a>
      <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0; line-height: 1.6;">
        본인이 구독 신청을 하지 않았다면 이 메일을 무시해주세요.<br />
        링크가 동작하지 않으면 다음 URL을 브라우저에 직접 입력해주세요:<br />
        <span style="color: #6b7280; word-break: break-all;">${verifyUrl}</span>
      </p>
    </div>
  `;

  const brevo = getBrevo();
  await brevo.transactionalEmails.sendTransacEmail({
    sender: SENDER,
    to: [{ email: to, name: name || to }],
    subject: "[뉴스레터] 이메일 구독 인증",
    htmlContent: html,
  });
  return { sent: true, verifyUrl };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
