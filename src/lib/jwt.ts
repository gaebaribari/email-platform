import jwt from "jsonwebtoken";

const ISSUER = "email-platform";
const VERIFY_TOKEN_TTL = "30m";

function getSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return "dev-only-jwt-secret-do-not-use-in-prod";
}

export interface VerifyTokenPayload {
  email: string;
  name: string;
  list_id: number;
  gdpr_consent: boolean;
}

export function signVerifyToken(payload: VerifyTokenPayload): string {
  return jwt.sign(payload, getSecret(), {
    expiresIn: VERIFY_TOKEN_TTL,
    issuer: ISSUER,
  });
}

export function verifyVerifyToken(token: string): VerifyTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret(), { issuer: ISSUER }) as jwt.JwtPayload;
    if (
      typeof decoded.email !== "string" ||
      typeof decoded.list_id !== "number"
    ) {
      return null;
    }
    return {
      email: decoded.email,
      name: typeof decoded.name === "string" ? decoded.name : "",
      list_id: decoded.list_id,
      gdpr_consent: Boolean(decoded.gdpr_consent),
    };
  } catch {
    return null;
  }
}
