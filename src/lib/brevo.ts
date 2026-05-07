import { BrevoClient } from "@getbrevo/brevo";

let _client: BrevoClient | null = null;

export function getBrevo(): BrevoClient {
  if (!_client) {
    if (!process.env.BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY is not set");
    }
    _client = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
  }
  return _client;
}

export const SENDER = {
  email: process.env.BREVO_SENDER_EMAIL || "noreply@example.com",
  name: process.env.BREVO_SENDER_NAME || "뉴스레터",
};

const DEFAULT_FOLDER_NAME = process.env.BREVO_FOLDER_NAME || "newsletter";
let _folderId: number | null = null;

export async function getDefaultFolderId(): Promise<number> {
  if (_folderId) return _folderId;
  if (process.env.BREVO_FOLDER_ID) {
    _folderId = Number(process.env.BREVO_FOLDER_ID);
    return _folderId;
  }
  const brevo = getBrevo();
  const res = await brevo.contacts.getFolders({ limit: 50, offset: 0 });
  const folders = res.folders ?? [];
  const found = folders.find((f) => f.name === DEFAULT_FOLDER_NAME);
  if (found?.id) {
    _folderId = found.id;
    return _folderId;
  }
  const created = await brevo.contacts.createFolder({ name: DEFAULT_FOLDER_NAME });
  _folderId = created.id ?? 1;
  return _folderId;
}

const REQUIRED_ATTRIBUTES: Array<{ name: string; type: "text" | "boolean" | "date" }> = [
  { name: "NAME", type: "text" },
  { name: "GDPR_CONSENT", type: "boolean" },
  { name: "VERIFIED_AT", type: "date" },
];

let _attributesEnsured = false;

export async function ensureAttributes(): Promise<void> {
  if (_attributesEnsured) return;
  const brevo = getBrevo();
  const existing = await brevo.contacts.getAttributes();
  const existingNames = new Set(
    (existing.attributes ?? []).map((a) => a.name?.toUpperCase())
  );
  for (const attr of REQUIRED_ATTRIBUTES) {
    if (existingNames.has(attr.name)) continue;
    try {
      await brevo.contacts.createAttribute({
        attributeCategory: "normal",
        attributeName: attr.name,
        type: attr.type,
      });
    } catch {
      // attribute may already exist (race) — ignore
    }
  }
  _attributesEnsured = true;
}

export interface NormalizedContact {
  id: number;
  email: string;
  name: string;
  list_ids: number[];
  emailBlacklisted: boolean;
  attributes: Record<string, unknown>;
  createdAt: string;
  modifiedAt: string;
}

export function normalizeContact(c: {
  id: number;
  email?: string;
  emailBlacklisted: boolean;
  listIds: number[];
  attributes: Record<string, unknown>;
  createdAt: string;
  modifiedAt: string;
}): NormalizedContact {
  const attrs = (c.attributes ?? {}) as Record<string, unknown>;
  const name =
    (typeof attrs.NAME === "string" && attrs.NAME) ||
    (typeof attrs.FIRSTNAME === "string" && attrs.FIRSTNAME) ||
    "";
  return {
    id: c.id,
    email: c.email ?? "",
    name,
    list_ids: c.listIds ?? [],
    emailBlacklisted: c.emailBlacklisted,
    attributes: attrs,
    createdAt: c.createdAt,
    modifiedAt: c.modifiedAt,
  };
}

export function statusOf(c: NormalizedContact): "verified" | "unsubscribed" {
  return c.emailBlacklisted ? "unsubscribed" : "verified";
}
