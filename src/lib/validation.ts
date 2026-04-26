import { z } from "zod";

// 구독 폼 유효성 검사 (react-hook-form + zod)
export const subscribeSchema = z.object({
  email: z
    .string()
    .min(1, "이메일을 입력해주세요")
    .email("올바른 이메일 형식이 아닙니다"),
  name: z
    .string()
    .min(1, "이름을 입력해주세요")
    .max(50, "이름은 50자 이내로 입력해주세요"),
  gdpr_consent: z.literal(true, {
    error: "개인정보 수집에 동의해주세요",
  }),
});

export type SubscribeFormData = z.infer<typeof subscribeSchema>;

// 이메일 리스트 유효성 검사
export const listSchema = z.object({
  name: z
    .string()
    .min(1, "리스트명을 입력해주세요")
    .max(100, "리스트명은 100자 이내로 입력해주세요"),
  description: z.string().max(500, "설명은 500자 이내로 입력해주세요").optional(),
});

export type ListFormData = z.infer<typeof listSchema>;

// 캠페인 유효성 검사
export const campaignSchema = z.object({
  name: z.string().min(1, "캠페인명을 입력해주세요"),
  subject: z.string().min(1, "이메일 제목을 입력해주세요"),
  list_id: z.number().min(1, "이메일 리스트를 선택해주세요"),
  template: z.string().min(1, "이메일 내용을 입력해주세요"),
  scheduled_at: z.string().optional(),
});

export type CampaignFormData = z.infer<typeof campaignSchema>;
