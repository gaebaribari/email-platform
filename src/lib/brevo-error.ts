import { BrevoError as SdkBrevoError } from "@getbrevo/brevo";

export const BrevoError = {
  message(err: unknown): string {
    if (err instanceof SdkBrevoError) {
      const body = err.body as { message?: string } | undefined;
      return body?.message ?? err.message;
    }
    if (err instanceof Error) return err.message;
    return String(err);
  },
};
