import crypto from "crypto";

const SESSION_TTL_MS = 5 * 60 * 1000;

type CaptchaSessionPayload = {
  domain: string;
  slug: string;
  action: "lead_step_notify";
  iat: number;
  exp: number;
};

function getSigningSecret(): string | null {
  const explicit = (process.env.CAPTCHA_SESSION_SECRET ?? "").trim();
  if (explicit) return explicit;
  const recaptchaSecret = (process.env.RECAPTCHA_SECRET_KEY ?? "").trim();
  if (recaptchaSecret) return recaptchaSecret;
  return null;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + pad, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function signPayload(encodedPayload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createCaptchaSessionToken(input: {
  domain: string;
  slug: string;
  action: "lead_step_notify";
}): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const now = Date.now();
  const payload: CaptchaSessionPayload = {
    domain: input.domain.trim().toLowerCase(),
    slug: input.slug.trim().toLowerCase(),
    action: input.action,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyCaptchaSessionToken(
  token: string | null | undefined,
  expected: { domain: string; slug: string; action: "lead_step_notify" },
): { ok: true; payload: CaptchaSessionPayload } | { ok: false; reason: string } {
  const secret = getSigningSecret();
  if (!secret) return { ok: false, reason: "missing_secret" };
  const raw = String(token ?? "").trim();
  if (!raw) return { ok: false, reason: "missing_token" };
  const [encodedPayload, signature] = raw.split(".");
  if (!encodedPayload || !signature) return { ok: false, reason: "malformed_token" };
  const expectedSig = signPayload(encodedPayload, secret);
  if (signature !== expectedSig) return { ok: false, reason: "invalid_signature" };
  const decoded = base64UrlDecode(encodedPayload);
  if (!decoded) return { ok: false, reason: "invalid_payload_encoding" };
  let payload: CaptchaSessionPayload;
  try {
    payload = JSON.parse(decoded) as CaptchaSessionPayload;
  } catch {
    return { ok: false, reason: "invalid_payload_json" };
  }
  if (!payload?.exp || Date.now() > payload.exp) return { ok: false, reason: "expired" };
  if ((payload.domain ?? "").trim().toLowerCase() !== expected.domain.trim().toLowerCase()) {
    return { ok: false, reason: "domain_mismatch" };
  }
  if ((payload.slug ?? "").trim().toLowerCase() !== expected.slug.trim().toLowerCase()) {
    return { ok: false, reason: "slug_mismatch" };
  }
  if (payload.action !== expected.action) return { ok: false, reason: "action_mismatch" };
  return { ok: true, payload };
}

