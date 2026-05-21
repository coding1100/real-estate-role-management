import { Resend } from "resend";
import { prisma } from "./prisma";
import { getAdminUiSettings } from "./uiSettings";
import {
  normalizeCtaTitleKey,
  type CtaForwardingRule,
} from "./types/ctaForwarding";
import { cloudinary } from "@/lib/cloudinary";
import {
  formLinesToFieldRows,
  renderDocumentDeliveryEmailHtml,
  renderNewLeadEmailHtml,
  type LeadEmailCtaContext,
} from "@/lib/email-render";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = (process.env.RESEND_FROM_EMAIL ?? "").trim();
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function extractLeadEmail(formData: unknown): string | null {
  const seen = new Set<unknown>();
  let firstEmailLikeValue: string | null = null;
  function search(node: unknown): string | null {
    if (!node || typeof node !== "object") return null;
    if (seen.has(node)) return null;
    seen.add(node);
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        const nested = search(value);
        if (nested) return nested;
        continue;
      }
      if (typeof value !== "string") continue;
      const raw = value.trim();
      if (!raw) continue;
      const normalizedKey = key.toLowerCase();
      const looksLikeEmailKey =
        normalizedKey === "email" ||
        normalizedKey === "e" ||
        normalizedKey.endsWith("email") ||
        normalizedKey.includes("email");
      const looksLikeEmailValue = /\S+@\S+\.\S+/.test(raw);
      if (!firstEmailLikeValue && looksLikeEmailValue) {
        firstEmailLikeValue = raw;
      }
      if (looksLikeEmailKey && looksLikeEmailValue) {
        return raw;
      }
    }
    return null;
  }
  const exact = search(formData);
  // Fallback: if form uses compact ids (e.g. "e"), use the first email-like value.
  return exact || firstEmailLikeValue;
}

function extractLeadPhone(formData: unknown): string | null {
  const seen = new Set<unknown>();
  const looksLikePhone = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes("@")) return false;
    const digits = trimmed.replace(/\D/g, "");
    return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
  };
  const looksLikePhoneKey = (key: string): boolean => {
    const normalized = key.toLowerCase();
    return (
      normalized === "phone" ||
      normalized.includes("phone") ||
      normalized.includes("mobile") ||
      normalized === "tel" ||
      normalized.includes("telephone")
    );
  };

  const visit = (node: unknown): string | null => {
    if (!node || typeof node !== "object") return null;
    if (seen.has(node)) return null;
    seen.add(node);
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (typeof value === "string" && looksLikePhoneKey(key) && looksLikePhone(value)) {
        return value.trim();
      }
      if (value && typeof value === "object") {
        const nested = visit(value);
        if (nested) return nested;
      }
    }
    return null;
  };
  const keyed = visit(formData);
  if (keyed) return keyed;

  const values = collectStringValues(formData);
  for (const value of values) {
    if (looksLikePhone(value)) return value.trim();
  }
  return null;
}

function resolveFromAddress(): string {
  if (RESEND_FROM_EMAIL) return RESEND_FROM_EMAIL;
  return "leads@no-reply.example.com";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function collectStringValues(input: unknown, seen = new Set<unknown>()): string[] {
  if (input == null) return [];
  if (typeof input === "string") {
    const s = input.trim();
    return s ? [s] : [];
  }
  if (typeof input === "number" || typeof input === "boolean") {
    return [String(input)];
  }
  if (typeof input !== "object") return [];
  if (seen.has(input)) return [];
  seen.add(input);

  if (Array.isArray(input)) {
    return input.flatMap((entry) => collectStringValues(entry, seen));
  }

  const out: string[] = [];
  for (const value of Object.values(input as Record<string, unknown>)) {
    out.push(...collectStringValues(value, seen));
  }
  return out;
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function inferFileExtensionFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname || "";
    const last = path.split("/").pop() ?? "";
    const cleaned = last.split("?")[0].split("#")[0];
    const ext = cleaned.includes(".") ? cleaned.split(".").pop() ?? "" : "";
    const safe = ext.trim().toLowerCase();
    if (!safe) return "";
    if (!/^[a-z0-9]{1,10}$/.test(safe)) return "";
    return safe;
  } catch {
    return "";
  }
}

function sanitizeFilenameBase(input: string): string {
  const base = String(input ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base || "document";
}

function inferContentTypeFromExtension(ext: string): string | undefined {
  switch (ext.toLowerCase()) {
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return undefined;
  }
}

async function fetchAttachmentFromUrl(input: {
  url: string;
  name?: string | null;
  mimeType?: string | null;
  publicId?: string | null;
  format?: string | null;
}): Promise<
  | {
      content: string;
      filename: string;
      content_type?: string;
    }
  | null
> {
  const baseUrl = input.url.trim();
  const tryUrls: string[] = [];
  if (isAbsoluteHttpUrl(baseUrl)) tryUrls.push(baseUrl);

  const publicId = (input.publicId ?? "").trim();
  if (publicId) {
    // Prefer Cloudinary "private download" URLs for raw/PDF assets since
    // standard delivery URLs can be blocked with ACL failure (401).
    try {
      const fmt =
        (input.format ?? "").trim().toLowerCase() ||
        inferFileExtensionFromUrl(baseUrl) ||
        "pdf";
      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24h
      const privateUrl = (cloudinary.utils as any).private_download_url?.(
        publicId,
        fmt,
        {
          resource_type: "raw",
          type: "upload",
          expires_at: expiresAt,
          attachment: false,
        },
      );
      if (typeof privateUrl === "string" && privateUrl.trim()) {
        tryUrls.unshift(privateUrl.trim());
      }
    } catch {
      // fall back to other URLs
    }

    const signedUrl = cloudinary.url(publicId, {
      resource_type: "raw",
      type: "upload",
      secure: true,
      sign_url: true,
      ...(input.format ? { format: String(input.format).trim().toLowerCase() } : {}),
    });
    if (signedUrl && signedUrl !== baseUrl) tryUrls.push(signedUrl);
  }

  let res: Response | null = null;
  for (const u of tryUrls) {
    try {
      const r = await fetch(u, { method: "GET" });
      if (!r.ok) continue;
      res = r;
      break;
    } catch {
      // try next
    }
  }
  if (!res) return null;

  const arrayBuffer = await res.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  const MAX_BYTES = 25 * 1024 * 1024;
  if (bytes.length > MAX_BYTES) return null;

  const extFromUrl = inferFileExtensionFromUrl(baseUrl);
  const baseName = sanitizeFilenameBase(input.name ?? "");
  const filename =
    extFromUrl && !baseName.toLowerCase().endsWith("." + extFromUrl)
      ? `${baseName}.${extFromUrl}`
      : baseName;

  const headerType = res.headers.get("content-type")?.split(";")[0]?.trim();
  const extFromName = inferFileExtensionFromUrl("https://x/" + filename);
  const inferredFromExt = inferContentTypeFromExtension(extFromName);
  const contentType =
    (input.mimeType?.trim() ? input.mimeType.trim() : undefined) ??
    (headerType && headerType.includes("/") ? headerType : undefined) ??
    inferredFromExt;

  return {
    content: bytes.toString("base64"),
    filename,
    ...(contentType ? { content_type: contentType } : {}),
  };
}

function isInternalFieldKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "recaptchatoken") return true;
  if (normalized === "website") return true;
  if (normalized === "_multistepdata") return true;
  if (normalized === "_ctatext") return true;
  if (normalized === "_stepslug") return true;
  if (normalized.includes("cta")) return true;
  return false;
}

function flattenLeadFormDataForEmail(
  input: Record<string, unknown>,
  path = "",
): string[] {
  const lines: string[] = [];
  const seenEntries = new Set<string>();
  const pushLine = (line: string) => {
    const key = line.trim().toLowerCase();
    if (!key || seenEntries.has(key)) return;
    seenEntries.add(key);
    lines.push(line);
  };
  const visit = (node: Record<string, unknown>, currentPath = "") => {
    for (const [rawKey, value] of Object.entries(node)) {
      if (isInternalFieldKey(rawKey)) continue;
      // Multistep buckets (step0/step1/...) are structural only; render their
      // inner fields as normal keys instead of exposing step prefixes.
      const isStepBucket = /^step\d+$/i.test(rawKey.trim());
      const key = isStepBucket
        ? currentPath
        : currentPath
          ? `${currentPath}.${rawKey}`
          : rawKey;
      if (value == null || value === "") continue;
      if (Array.isArray(value)) {
        const printable = value
          .map((item) =>
            typeof item === "string" || typeof item === "number" || typeof item === "boolean"
              ? String(item)
              : JSON.stringify(item),
          )
          .join(", ");
        if (printable) pushLine(`${key}: ${printable}`);
        continue;
      }
      if (isPlainObject(value)) {
        visit(value, key);
        continue;
      }
      pushLine(`${key}: ${String(value)}`);
    }
  };
  visit(input, path);
  return lines;
}

function ensureEmailPhoneRows(
  rows: Array<{ label: string; value: string }>,
  leadEmail: string | null,
  leadPhone: string | null,
): Array<{ label: string; value: string }> {
  const hasEmailRow = rows.some((row) => {
    const normalized = row.label.trim().toLowerCase();
    return (
      normalized === "email" ||
      normalized.endsWith(".email") ||
      normalized.includes("email")
    );
  });
  const hasPhoneRow = rows.some((row) => {
    const normalized = row.label.trim().toLowerCase();
    return (
      normalized === "phone" ||
      normalized.endsWith(".phone") ||
      normalized.includes("phone") ||
      normalized.includes("mobile") ||
      normalized.includes("telephone") ||
      normalized === "tel"
    );
  });

  const prefixedRows: Array<{ label: string; value: string }> = [];
  if (!hasEmailRow) {
    prefixedRows.push({ label: "EMAIL", value: leadEmail?.trim() ?? "" });
  }
  if (!hasPhoneRow) {
    prefixedRows.push({ label: "PHONE", value: leadPhone?.trim() ?? "" });
  }
  return [...prefixedRows, ...rows];
}

function normalizeTemplateVariableKey(raw: string): string {
  const normalized = String(raw ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  if (!normalized) return "";
  if (/^[0-9]/.test(normalized)) return `field_${normalized}`;
  return normalized;
}

function toTemplateVariableString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (
          typeof entry === "string" ||
          typeof entry === "number" ||
          typeof entry === "boolean"
        ) {
          return String(entry).trim();
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const clean = fullName.trim().replace(/\s+/g, " ");
  if (!clean) return { firstName: "", lastName: "" };
  const parts = clean.split(" ");
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ").trim();
  return { firstName, lastName };
}

function extractTemplateVariablesFromFormData(
  formData: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const seen = new Set<unknown>();

  const assignKey = (key: string, value: unknown) => {
    const normalized = normalizeTemplateVariableKey(key);
    if (!normalized) return;
    if (isInternalFieldKey(normalized)) return;
    const printable = toTemplateVariableString(value);
    if (!printable) return;
    if (!Object.prototype.hasOwnProperty.call(out, normalized)) {
      out[normalized] = printable;
    }
  };

  const visit = (node: unknown, pathParts: string[] = []) => {
    if (node == null) return;
    if (typeof node !== "object") {
      if (pathParts.length > 0) {
        assignKey(pathParts.join("_"), node);
        assignKey(pathParts[pathParts.length - 1] ?? "", node);
      }
      return;
    }
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      if (pathParts.length > 0) {
        assignKey(pathParts.join("_"), node);
        assignKey(pathParts[pathParts.length - 1] ?? "", node);
      }
      node.forEach((entry, idx) => {
        if (isPlainObject(entry) || Array.isArray(entry)) {
          visit(entry, [...pathParts, String(idx + 1)]);
        }
      });
      return;
    }

    for (const [rawKey, value] of Object.entries(node as Record<string, unknown>)) {
      if (isInternalFieldKey(rawKey)) continue;
      const nextPath = [...pathParts, rawKey];
      if (isPlainObject(value) || Array.isArray(value)) {
        visit(value, nextPath);
        continue;
      }
      assignKey(nextPath.join("_"), value);
      assignKey(rawKey, value);
    }
  };

  visit(formData);

  const fullName =
    out.full_name ||
    out.name ||
    out.fullname ||
    toTemplateVariableString((formData as Record<string, unknown>).name);

  if (fullName) {
    out.full_name = fullName;
    if (!out.name) out.name = fullName;
  }

  if (!out.first_name || !out.last_name) {
    const { firstName, lastName } = splitFullName(fullName || "");
    if (!out.first_name && firstName) out.first_name = firstName;
    if (!out.last_name && lastName) out.last_name = lastName;
  }

  if (!out.first_name) out.first_name = "there";

  return out;
}

function collectCtaCandidates(formData: Record<string, unknown>): string[] {
  const candidates = new Set<string>();
  const direct = formData._ctaText;
  if (typeof direct === "string" && direct.trim()) {
    candidates.add(direct.trim());
  }
  const visit = (node: unknown) => {
    if (!isPlainObject(node) && !Array.isArray(node)) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string" && key.toLowerCase().includes("cta") && value.trim()) {
        candidates.add(value.trim());
      } else if (isPlainObject(value) || Array.isArray(value)) {
        visit(value);
      }
    }
  };
  visit(formData);
  return [...candidates];
}

function extractStepSlugFromFormData(formData: Record<string, unknown>): string | null {
  const direct = formData._stepSlug;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const visit = (node: unknown): string | null => {
    if (!isPlainObject(node) && !Array.isArray(node)) return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = visit(item);
        if (hit) return hit;
      }
      return null;
    }
    for (const [key, value] of Object.entries(node)) {
      const normalizedKey = key.trim().toLowerCase();
      if (
        typeof value === "string" &&
        (normalizedKey === "_stepslug" || normalizedKey === "stepslug" || normalizedKey === "_step_slug")
      ) {
        const v = value.trim();
        if (v) return v;
      }
      if (isPlainObject(value) || Array.isArray(value)) {
        const hit = visit(value);
        if (hit) return hit;
      }
    }
    return null;
  };

  return visit(formData);
}

/** Split CTA notification emails into Resend to/cc/bcc. Default kind is cc. */
function buildNotifyRecipients(
  notify: Array<{ email: string; kind?: "cc" | "bcc" }>,
): { to: string[]; cc: string[]; bcc: string[] } | null {
  const norm = (s: string) => s.trim().toLowerCase();

  const rawCc: string[] = [];
  const rawBcc: string[] = [];
  for (const n of notify) {
    const e = n.email.trim();
    if (!e.includes("@")) continue;
    const kind = n.kind ?? "cc";
    if (kind === "bcc") rawBcc.push(e);
    else rawCc.push(e);
  }

  const dedupe = (arr: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const x of arr) {
      const t = x.trim();
      const k = norm(t);
      if (!t || seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out;
  };

  const bccNorm = new Set(rawBcc.map(norm));
  const ccOnly = dedupe(rawCc.filter((e) => !bccNorm.has(norm(e))));
  const bccOnly = dedupe(rawBcc);

  if (ccOnly.length > 0 || bccOnly.length > 0) {
    // Keep configured CC/BCC placement intact. Use a neutral mailbox in "to"
    // to satisfy provider requirements without reclassifying recipients.
    return {
      to: [resolveFromAddress()],
      cc: ccOnly,
      bcc: bccOnly,
    };
  }

  return null;
}

function buildRequesterDocumentRecipients(
  leadEmail: string | null | undefined,
  notify: Array<{ email: string; kind?: "cc" | "bcc" }>,
): { to: string[]; cc: string[]; bcc: string[] } | null {
  if (!leadEmail || !leadEmail.includes("@")) {
    return null;
  }
  const requester = leadEmail.trim();
  const requesterNorm = requester.toLowerCase();
  const norm = (value: string) => value.trim().toLowerCase();
  const dedupe = (values: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of values) {
      const trimmed = raw.trim();
      const key = norm(trimmed);
      if (!trimmed || seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
    return out;
  };
  const rawCc: string[] = [];
  const rawBcc: string[] = [];
  for (const entry of notify) {
    const email = String(entry?.email ?? "").trim();
    if (!email.includes("@")) continue;
    if (norm(email) === requesterNorm) continue;
    if ((entry.kind ?? "cc") === "bcc") rawBcc.push(email);
    else rawCc.push(email);
  }
  const bccNorm = new Set(rawBcc.map(norm));
  const cc = dedupe(rawCc.filter((email) => !bccNorm.has(norm(email))));
  const bcc = dedupe(rawBcc);
  return {
    to: [requester],
    cc,
    bcc,
  };
}

/** Lead alert routing:
 * - If requester email exists, send to requester and include notify recipients in cc/bcc.
 * - Otherwise, fall back to notify routing only.
 */
function buildLeadAlertRecipients(
  leadEmail: string | null | undefined,
  notify: Array<{ email: string; kind?: "cc" | "bcc" }>,
): { to: string[]; cc: string[]; bcc: string[] } | null {
  if (leadEmail && leadEmail.includes("@")) {
    return buildRequesterDocumentRecipients(leadEmail, notify);
  }
  return buildNotifyRecipients(notify);
}

function buildRequesterLeadSubject(brandName: string): string {
  return `We received your request - ${brandName}`;
}

function findCtaRule(
  rules: CtaForwardingRule[],
  pageCtaText: string | null | undefined,
  formData: Record<string, unknown>,
): CtaForwardingRule | undefined {
  const stripToAlphaNumeric = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const keys = new Set<string>();
  const pageKey = normalizeCtaTitleKey(pageCtaText ?? "");
  if (pageKey) keys.add(pageKey);
  for (const candidate of collectCtaCandidates(formData)) {
    const key = normalizeCtaTitleKey(candidate);
    if (key) keys.add(key);
  }
  for (const key of keys) {
    const matches = rules.filter(
      (rule) => normalizeCtaTitleKey(rule.ctaTitle) === key,
    );
    if (matches.length === 0) continue;

    // Prefer the most recently configured matching rule that has active
    // notification recipients, then active docs, otherwise fall back to last.
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const rule = matches[i];
      const hasActiveNotify = (rule.notifyEmails ?? []).some(
        (entry) =>
          (entry.enabled ?? true) &&
          typeof entry.email === "string" &&
          entry.email.includes("@"),
      );
      if (hasActiveNotify) return rule;
    }
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const rule = matches[i];
      const hasAutoDocs = (rule.documents ?? []).some(
        (doc) => !!doc.url && doc.autoSend !== false,
      );
      if (hasAutoDocs) return rule;
    }
    return matches[matches.length - 1];
  }

  for (const key of keys) {
    const relaxedNeedle = stripToAlphaNumeric(key);
    if (!relaxedNeedle) continue;
    const relaxedMatch = rules.find((rule) => {
      const relaxedRuleTitle = stripToAlphaNumeric(
        normalizeCtaTitleKey(rule.ctaTitle),
      );
      return (
        relaxedRuleTitle.includes(relaxedNeedle) ||
        relaxedNeedle.includes(relaxedRuleTitle)
      );
    });
    if (relaxedMatch) return relaxedMatch;
  }

  if (rules.length === 1) return rules[0];
  return undefined;
}

function readPageCtaForwardingRules(rawSections: unknown): CtaForwardingRule[] {
  if (!Array.isArray(rawSections)) return [];
  const hero = rawSections.find(
    (section) =>
      section &&
      typeof section === "object" &&
      (section as { kind?: unknown }).kind === "hero",
  ) as { props?: unknown } | undefined;
  if (!hero || !hero.props || typeof hero.props !== "object") return [];
  const rules = (hero.props as { ctaForwardingRules?: unknown }).ctaForwardingRules;
  return Array.isArray(rules) ? (rules as CtaForwardingRule[]) : [];
}

function hasActionableRuleConfig(rule: CtaForwardingRule | undefined): boolean {
  if (!rule) return false;
  const hasNotify = (rule.notifyEmails ?? []).some(
    (entry) =>
      (entry.enabled ?? true) &&
      typeof entry.email === "string" &&
      entry.email.includes("@"),
  );
  const hasDocs = (rule.documents ?? []).some(
    (doc) => !!doc.url && doc.autoSend !== false,
  );
  const hasTemplate = typeof rule.resendTemplateId === "string" && rule.resendTemplateId.trim().length > 0;
  const hasForward =
    rule.forwardEnabled !== false &&
    typeof rule.forwardUrl === "string" &&
    rule.forwardUrl.trim().length > 0;
  return hasNotify || hasDocs || hasTemplate || hasForward;
}

function getActiveNotifyEmails(
  rule: CtaForwardingRule | undefined,
): Array<{ email: string; kind?: "cc" | "bcc" }> {
  if (!rule) return [];
  return (rule.notifyEmails ?? []).filter(
    (entry) => (entry.enabled ?? true) && entry.email && entry.email.includes("@"),
  );
}

function findLatestRuleWithActiveNotify(
  rules: CtaForwardingRule[] | undefined,
): CtaForwardingRule | undefined {
  const list = rules ?? [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const rule = list[i];
    const notify = getActiveNotifyEmails(rule);
    if (notify.length > 0) return rule;
  }
  return undefined;
}

/**
 * Sends the lead-style notify email for an intermediate multistep Continue,
 * using CTA Management rules on the **current step** page only (no DB lead).
 */
export async function sendMultistepIntermediateStepNotification(input: {
  entryPageSlug: string;
  leadType: string;
  domain: {
    hostname: string;
    displayName: string | null;
    logoUrl: string | null;
    notifyEmail: string | null;
  };
  stepPage: {
    slug: string;
    ctaText: string;
    sections: unknown;
    multistepNotifyEachStep: boolean;
  };
  mergedFormData: Record<string, unknown>;
  formCtaLabel: string;
}): Promise<{ sent: boolean; skippedReason?: string }> {
  if (!input.stepPage.multistepNotifyEachStep) {
    return { sent: false, skippedReason: "notify_each_step_disabled" };
  }

  if (!resend) {
    return { sent: false, skippedReason: "resend_not_configured" };
  }

  const { settings } = await getAdminUiSettings();
  const stepPageRules = readPageCtaForwardingRules(input.stepPage.sections);
  const rules =
    stepPageRules.length > 0
      ? stepPageRules
      : ((settings.ctaForwardingRules ?? []) as CtaForwardingRule[]);

  const data = { ...input.mergedFormData, _ctaText: input.formCtaLabel };
  const matched =
    findCtaRule(rules, input.stepPage.ctaText, data) ??
    findLatestRuleWithActiveNotify(rules);

  let resolvedNotify = getActiveNotifyEmails(matched);
  if (resolvedNotify.length === 0 && matched) {
    const notifyFallback = findLatestRuleWithActiveNotify(stepPageRules);
    resolvedNotify = getActiveNotifyEmails(notifyFallback);
  }
  if (
    resolvedNotify.length === 0 &&
    typeof input.domain.notifyEmail === "string" &&
    input.domain.notifyEmail.includes("@")
  ) {
    resolvedNotify = [{ email: input.domain.notifyEmail.trim(), kind: "bcc" }];
  }

  if (resolvedNotify.length === 0) {
    return { sent: false, skippedReason: "no_notify_recipients" };
  }

  const deliveryMode =
    matched?.deliveryMode === "notify_only_form_data"
      ? "notify_only_form_data"
      : "documents_with_notify";

  const leadEmail = extractLeadEmail(data);
  const leadPhone = extractLeadPhone(data);
  const hasFormData = flattenLeadFormDataForEmail(data).length > 0;
  const hasEmailOrPhone = Boolean(
    (leadEmail && leadEmail.includes("@")) || (leadPhone && leadPhone.trim().length > 0),
  );
  const shouldSendLeadAlertEmail =
    deliveryMode === "notify_only_form_data" ? true : hasFormData && hasEmailOrPhone;

  if (!shouldSendLeadAlertEmail) {
    return { sent: false, skippedReason: "missing_contact_for_notify" };
  }

  const lines = flattenLeadFormDataForEmail(data);
  const baseFieldRows = formLinesToFieldRows(lines);
  const fieldRows =
    deliveryMode === "notify_only_form_data"
      ? ensureEmailPhoneRows(baseFieldRows, leadEmail, leadPhone)
      : baseFieldRows;
  const brandName =
    (input.domain.displayName ?? input.domain.hostname).trim() || input.domain.hostname;

  const ctaContext: LeadEmailCtaContext = {
    entryPageSlug: input.entryPageSlug,
    stepPageSlug: input.stepPage.slug,
    formCtaLabel: input.formCtaLabel,
    ctaManagementTitle: matched?.ctaTitle?.trim() ?? null,
    phase: "multistep_step",
  };

  const internalEmail = await renderNewLeadEmailHtml({
    leadType: input.leadType,
    domainHostname: input.domain.hostname,
    pageSlug: input.stepPage.slug,
    brandName,
    logoUrl: input.domain.logoUrl ?? null,
    fieldRows,
    ctaNotificationContext: ctaContext,
    audience: "internal",
  });
  const requesterEmailContent = await renderNewLeadEmailHtml({
    leadType: input.leadType,
    domainHostname: input.domain.hostname,
    pageSlug: input.stepPage.slug,
    brandName,
    logoUrl: input.domain.logoUrl ?? null,
    fieldRows,
    ctaNotificationContext: ctaContext,
    audience: "requester",
  });

  const subjectParts = [
    `[Multistep step]`,
    `${input.leadType} — ${input.domain.hostname}`,
    `step: ${input.stepPage.slug}`,
  ];
  if (matched?.ctaTitle?.trim()) subjectParts.push(`CTA rule: ${matched.ctaTitle.trim()}`);
  else if (input.formCtaLabel.trim()) subjectParts.push(`Form CTA: ${input.formCtaLabel.trim()}`);
  const subject = subjectParts.join(" · ");

  const requesterEmail =
    leadEmail && leadEmail.includes("@") ? leadEmail.trim() : null;
  const internalRouting = buildNotifyRecipients(resolvedNotify);
  if (!requesterEmail && (!internalRouting || internalRouting.to.length === 0)) {
    return { sent: false, skippedReason: "no_routing" };
  }
  if (requesterEmail) {
    await resend.emails.send({
      from: resolveFromAddress(),
      to: [requesterEmail],
      subject: buildRequesterLeadSubject(brandName),
      html: requesterEmailContent.html,
      text: requesterEmailContent.text,
    });
  }
  if (internalRouting && internalRouting.to.length > 0) {
    const payload: Parameters<typeof resend.emails.send>[0] = {
      from: resolveFromAddress(),
      to: internalRouting.to,
      subject,
      html: internalEmail.html,
      text: internalEmail.text,
    };
    if (internalRouting.cc.length > 0) payload.cc = internalRouting.cc;
    if (internalRouting.bcc.length > 0) payload.bcc = internalRouting.bcc;
    await resend.emails.send(payload);
  }
  return { sent: true };
}

export async function sendLeadNotifications(
  leadId: string,
  options?: { throwOnFailure?: boolean },
) {
  const throwOnFailure = options?.throwOnFailure === true;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      domain: true,
      page: true,
    },
  });

  if (!lead) return;

  const { domain, page } = lead;
  const formData = (lead.formData as Record<string, unknown>) ?? {};
  const leadEmail = extractLeadEmail(formData);
  const leadPhone = extractLeadPhone(formData);
  const hasFormData = flattenLeadFormDataForEmail(formData).length > 0;
  const hasEmailOrPhone = Boolean(
    (leadEmail && leadEmail.includes("@")) || (leadPhone && leadPhone.trim().length > 0),
  );
  const shouldSendCtaNotificationEmail = hasFormData && hasEmailOrPhone;
  let ruleSourcePage: typeof page = page;
  let leadAlertSent = false;
  let documentEmailSent = false;
  const multistepStepSlugs = Array.isArray(
    (lead.page as { multistepStepSlugs?: unknown }).multistepStepSlugs,
  )
    ? ((lead.page as { multistepStepSlugs?: unknown }).multistepStepSlugs as unknown[])
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.trim())
    : [];

  // Multistep requirement: CTA Management should come from the last step page.
  // Always prefer configured last step slug; fall back to submitted _stepSlug.
  const submittedStepSlug = extractStepSlugFromFormData(formData);
  const preferredStepSlug =
    (multistepStepSlugs.length > 0
      ? multistepStepSlugs[multistepStepSlugs.length - 1]
      : null) ||
    submittedStepSlug;

  const candidateSlugs: string[] = [];
  const pushUniqueSlug = (slugValue: string | null | undefined) => {
    const s = String(slugValue ?? "").trim();
    if (!s) return;
    if (!candidateSlugs.includes(s)) candidateSlugs.push(s);
  };
  // Priority order: submitted step -> configured last step -> all configured steps (reverse) -> entry page.
  pushUniqueSlug(submittedStepSlug);
  pushUniqueSlug(preferredStepSlug);
  [...multistepStepSlugs].reverse().forEach((slugValue) => pushUniqueSlug(slugValue));
  pushUniqueSlug(page.slug);

  const candidatePages = await prisma.landingPage.findMany({
    where: {
      domainId: domain.id,
      slug: { in: candidateSlugs },
    },
  });
  const pageBySlug = new Map(candidatePages.map((p) => [p.slug, p]));

  if (preferredStepSlug && !pageBySlug.has(preferredStepSlug)) {
    console.warn("[notifications] Preferred step page slug not found for CTA resolution", {
      leadId: lead.id,
      preferredStepSlug,
      fallbackPageSlug: page.slug,
    });
  }

  const { settings } = await getAdminUiSettings();
  let resolvedRule: CtaForwardingRule | undefined;
  let resolvedNotifyEmails: Array<{ email: string; kind?: "cc" | "bcc" }> = [];
  let evaluatedCandidates = 0;

  for (const slugCandidate of candidateSlugs) {
    const candidatePage = pageBySlug.get(slugCandidate);
    if (!candidatePage) continue;
    evaluatedCandidates += 1;
    const candidatePageRules = readPageCtaForwardingRules(
      (candidatePage as { sections?: unknown }).sections,
    );
    const candidateRules =
      candidatePageRules.length > 0
        ? candidatePageRules
        : ((settings.ctaForwardingRules ?? []) as CtaForwardingRule[]);
    const matchedRule = findCtaRule(
      candidateRules,
      candidatePage.ctaText,
      formData,
    );
    const candidateRule =
      matchedRule ?? findLatestRuleWithActiveNotify(candidateRules);
    if (!candidateRule) continue;
    const candidateNotify = getActiveNotifyEmails(candidateRule);
    ruleSourcePage = candidatePage;
    resolvedRule = candidateRule;
    resolvedNotifyEmails = candidateNotify;
    if (hasActionableRuleConfig(candidateRule)) break;
  }

  if (!resolvedRule) {
    const fallbackPageRules = readPageCtaForwardingRules(
      (page as { sections?: unknown }).sections,
    );
    const fallbackRules =
      fallbackPageRules.length > 0
        ? fallbackPageRules
        : ((settings.ctaForwardingRules ?? []) as CtaForwardingRule[]);
    const fallbackMatchedRule = findCtaRule(fallbackRules, page.ctaText, formData);
    const fallbackRule =
      fallbackMatchedRule ?? findLatestRuleWithActiveNotify(fallbackRules);
    if (fallbackRule) {
      ruleSourcePage = page;
      resolvedRule = fallbackRule;
      resolvedNotifyEmails = getActiveNotifyEmails(fallbackRule);
    }
  }

  if (resolvedRule && resolvedNotifyEmails.length === 0) {
    const sourcePageRules = readPageCtaForwardingRules(
      (ruleSourcePage as { sections?: unknown }).sections,
    );
    const sourceRules =
      sourcePageRules.length > 0
        ? sourcePageRules
        : ((settings.ctaForwardingRules ?? []) as CtaForwardingRule[]);
    const notifyFallbackRule = findLatestRuleWithActiveNotify(sourceRules);
    if (notifyFallbackRule) {
      resolvedNotifyEmails = getActiveNotifyEmails(notifyFallbackRule);
      console.log("[notifications] Applied notify fallback rule", {
        leadId: lead.id,
        entryPageSlug: page.slug,
        ruleSourcePageSlug: ruleSourcePage.slug,
        originalRuleCtaTitle: resolvedRule.ctaTitle,
        fallbackRuleCtaTitle: notifyFallbackRule.ctaTitle,
        notifyRecipientsCount: resolvedNotifyEmails.length,
      });
    }
  }

  // Production-safe fallback: if CTA-specific notify recipients are missing,
  // fall back to the domain-level notify email so agent notification still sends.
  if (
    resolvedNotifyEmails.length === 0 &&
    typeof domain.notifyEmail === "string" &&
    domain.notifyEmail.includes("@")
  ) {
    resolvedNotifyEmails = [{ email: domain.notifyEmail.trim(), kind: "bcc" }];
    console.log("[notifications] Applied domain notify fallback recipient", {
      leadId: lead.id,
      entryPageSlug: page.slug,
      notifyRecipientsCount: resolvedNotifyEmails.length,
    });
  }

  console.log("[notifications] CTA resolution", {
    leadId: lead.id,
    entryPageSlug: page.slug,
    submittedStepSlug,
    preferredStepSlug,
    resolvedRuleSourceSlug: ruleSourcePage.slug,
    resolvedRuleCtaTitle: resolvedRule?.ctaTitle ?? null,
    multistepStepsCount: multistepStepSlugs.length,
    candidateSlugs,
    evaluatedCandidates,
  });
  console.log("[notifications] Rule + notify summary", {
    leadId: lead.id,
    resolvedRuleFound: !!resolvedRule,
    resolvedRuleCtaTitle: resolvedRule?.ctaTitle ?? null,
    notifyRecipientsCount: resolvedNotifyEmails.length,
    notifyKinds: resolvedNotifyEmails.map((entry) => entry.kind ?? "cc"),
  });

  const resolvedDeliveryMode =
    resolvedRule?.deliveryMode === "notify_only_form_data"
      ? "notify_only_form_data"
      : "documents_with_notify";
  const shouldSendLeadAlertEmail =
    resolvedDeliveryMode === "notify_only_form_data"
      ? true
      : shouldSendCtaNotificationEmail;

  const leadAlertTask = async (): Promise<boolean> => {
    // Email to agent via Resend (CTA notify recipients only; do not use domain notifyEmail).
    if (!(resend && resolvedNotifyEmails.length > 0 && shouldSendLeadAlertEmail)) {
      return false;
    }
    try {
      const data = (lead.formData as Record<string, unknown>) ?? {};
      let subject = `[New ${lead.type} lead] ${domain.hostname} / ${ruleSourcePage.slug}`;
      if (multistepStepSlugs.length > 0) {
        const bits: string[] = [];
        if (submittedStepSlug) bits.push(`Step: ${submittedStepSlug}`);
        if (resolvedRule?.ctaTitle?.trim()) {
          bits.push(`CTA rule: ${resolvedRule.ctaTitle.trim()}`);
        } else if (typeof data._ctaText === "string" && data._ctaText.trim()) {
          bits.push(`Form CTA: ${data._ctaText.trim()}`);
        }
        if (bits.length) subject += ` — ${bits.join(" · ")}`;
      }
      const lines = flattenLeadFormDataForEmail(data);
      const baseFieldRows = formLinesToFieldRows(lines);
      const fieldRows =
        resolvedDeliveryMode === "notify_only_form_data"
          ? ensureEmailPhoneRows(baseFieldRows, leadEmail, leadPhone)
          : baseFieldRows;
      const brandName = (domain.displayName ?? domain.hostname).trim() || domain.hostname;

      const ctaNotificationContext: LeadEmailCtaContext | null =
        multistepStepSlugs.length > 0
          ? {
              entryPageSlug: page.slug,
              stepPageSlug: ruleSourcePage.slug,
              formCtaLabel:
                typeof data._ctaText === "string" ? data._ctaText.trim() : "",
              ctaManagementTitle: resolvedRule?.ctaTitle?.trim() ?? null,
              phase: "completed_lead",
            }
          : null;

      const internalEmail = await renderNewLeadEmailHtml({
        leadType: lead.type,
        domainHostname: domain.hostname,
        pageSlug: ruleSourcePage.slug,
        brandName,
        logoUrl: domain.logoUrl ?? null,
        fieldRows,
        ctaNotificationContext,
        audience: "internal",
      });
      const requesterEmailContent = await renderNewLeadEmailHtml({
        leadType: lead.type,
        domainHostname: domain.hostname,
        pageSlug: ruleSourcePage.slug,
        brandName,
        logoUrl: domain.logoUrl ?? null,
        fieldRows,
        ctaNotificationContext,
        audience: "requester",
      });

      const requesterEmail =
        leadEmail && leadEmail.includes("@") ? leadEmail.trim() : null;
      const internalRouting = buildNotifyRecipients(resolvedNotifyEmails);
      if (!requesterEmail && (!internalRouting || internalRouting.to.length === 0)) {
        console.warn("[notifications] Lead email skipped: no recipients found", {
          leadId: lead.id,
          pageSlug: ruleSourcePage.slug,
        });
        if (throwOnFailure) {
          throw new Error(
            `[notifications] Lead alert has no recipients (leadId=${lead.id}, page=${ruleSourcePage.slug})`,
          );
        }
        return false;
      }

      console.log("[notifications] Sending lead alert email", {
        leadId: lead.id,
        toCount: requesterEmail ? 1 : (internalRouting?.to.length ?? 0),
        ccCount: internalRouting?.cc.length ?? 0,
        bccCount: internalRouting?.bcc.length ?? 0,
        pageSlug: ruleSourcePage.slug,
      });
      if (requesterEmail) {
        await resend.emails.send({
          from: resolveFromAddress(),
          to: [requesterEmail],
          subject: buildRequesterLeadSubject(brandName),
          html: requesterEmailContent.html,
          text: requesterEmailContent.text,
        });
      }
      if (internalRouting && internalRouting.to.length > 0) {
        const leadPayload: Parameters<typeof resend.emails.send>[0] = {
          from: resolveFromAddress(),
          to: internalRouting.to,
          subject,
          html: internalEmail.html,
          text: internalEmail.text,
        };
        if (internalRouting.cc.length > 0) leadPayload.cc = internalRouting.cc;
        if (internalRouting.bcc.length > 0) leadPayload.bcc = internalRouting.bcc;
        await resend.emails.send(leadPayload);
      }
      return true;
    } catch (e) {
      console.error("[notifications] Failed to send email", e);
      if (throwOnFailure) throw e;
      return false;
    }
  };

  const documentEmailTask = async (): Promise<boolean> => {
    // Email documents to lead + CC/BCC from CTA Notification emails
    if (!resend) return false;
    try {
      if (!leadEmail) {
        console.warn("[notifications] Lead email not found in formData. Will still send docs to configured CC/BCC recipients.", {
          leadId: lead.id,
          pageSlug: page.slug,
        });
      }

      const rule = resolvedRule;
      const deliveryMode =
        rule?.deliveryMode === "notify_only_form_data"
          ? "notify_only_form_data"
          : "documents_with_notify";
      if (deliveryMode === "notify_only_form_data") {
        return false;
      }
      if (!rule) {
        const ctaCandidates = collectCtaCandidates(formData);
        console.warn("[notifications] Document email skipped: CTA rule not found", {
          leadId: lead.id,
          pageSlug: ruleSourcePage.slug,
          ctaText: ruleSourcePage.ctaText,
          ctaCandidates,
        });
        if (throwOnFailure && multistepStepSlugs.length > 0) {
          throw new Error(
            `[notifications] Multistep CTA rule not found (leadId=${lead.id}, preferredStepSlug=${preferredStepSlug ?? "n/a"})`,
          );
        }
      }
      const docs = (rule?.documents ?? []).filter(
        (d) => d.url && d.autoSend !== false,
      );
      if (docs.length === 0) {
        console.warn("[notifications] Document email skipped: no auto-send docs", {
          leadId: lead.id,
          pageSlug: ruleSourcePage.slug,
        });
        return false;
      }

      const notify = resolvedNotifyEmails;
      const routing = buildRequesterDocumentRecipients(leadEmail, notify);

      if (!routing || routing.to.length === 0) {
        console.warn("[notifications] Document email skipped: no recipients found", {
          leadId: lead.id,
          pageSlug: page.slug,
        });
        return false;
      }

      console.log("[notifications] Preparing document email", {
        leadId: lead.id,
        docsCount: docs.length,
        toCount: routing.to.length,
        ccCount: routing.cc.length,
        bccCount: routing.bcc.length,
        templateId: rule?.resendTemplateId ?? null,
        pageSlug: ruleSourcePage.slug,
      });
      const documentNames = docs.map((d) => d.name?.trim() || "Document");

      const { html, text } = await renderDocumentDeliveryEmailHtml({
        siteName: domain.displayName?.trim() || domain.hostname,
        domainHostname: domain.hostname,
        pageSlug: ruleSourcePage.slug,
        documentNames,
        logoUrl: domain.logoUrl ?? null,
      });

      const attachments = (
        await Promise.all(
          docs.map((d) =>
            fetchAttachmentFromUrl({
              url: d.url,
              name: d.name,
              mimeType: d.mimeType,
              publicId: (d as any).publicId,
              format: (d as any).format,
            }),
          ),
        )
      ).filter(Boolean) as Array<{
        content: string;
        filename: string;
        content_type?: string;
      }>;

      const payload: Parameters<typeof resend.emails.send>[0] = {
        from: resolveFromAddress(),
        to: routing.to,
        subject: `Your requested documents from ${domain.displayName ?? domain.hostname}`,
        html,
        text,
        attachments,
      };
      if (routing.cc.length > 0) payload.cc = routing.cc;
      if (routing.bcc.length > 0) payload.bcc = routing.bcc;
      const resendTemplateId = rule?.resendTemplateId?.trim();
      if (resendTemplateId) {
        try {
          const extractedFormVariables = extractTemplateVariablesFromFormData(
            formData,
          );
          const siteName = domain.displayName?.trim() || domain.hostname;
          const pageValue = ruleSourcePage.slug;
          const websiteValue = domain.hostname;
          const docNamesArray = documentNames;
          const docNameValue = documentNames.join(", ");
          const emailVariableValue =
            (leadEmail && leadEmail.includes("@") ? leadEmail : null) ??
            routing.to[0] ??
            "";
          const templatePayload: Parameters<typeof resend.emails.send>[0] = {
            from: resolveFromAddress(),
            to: routing.to,
            subject: `Your requested documents from ${domain.displayName ?? domain.hostname}`,
            ...(routing.cc.length > 0 ? { cc: routing.cc } : {}),
            ...(routing.bcc.length > 0 ? { bcc: routing.bcc } : {}),
            // keep docs delivery behavior consistent with existing flow
            attachments,
            template: {
              id: resendTemplateId,
              variables: {
                ...extractedFormVariables,
                email: emailVariableValue,
                siteName,
                domainHostname: websiteValue,
                pageSlug: pageValue,
                documentNames: docNamesArray,
                // Alias keys for web-platform templates
                website: websiteValue,
                page: pageValue,
                doc_name: docNameValue,
              },
            } as any,
          } as any;
          const templateResult = await resend.emails.send(templatePayload as any);
          if ((templateResult as { error?: unknown } | null)?.error) {
            throw (templateResult as { error: unknown }).error;
          }
          console.log("[notifications] Resend template email sent", {
            leadId: lead.id,
            templateId: resendTemplateId,
            pageSlug: ruleSourcePage.slug,
          });
        } catch (templateErr) {
          const resendTemplateError =
            templateErr &&
            typeof templateErr === "object" &&
            "message" in templateErr
              ? (templateErr as { message?: unknown }).message
              : null;
          console.error(
            "[notifications] Resend template send failed (no fallback default email when template is configured)",
            {
              leadId: lead.id,
              templateId: resendTemplateId,
              error: resendTemplateError ?? templateErr,
            },
          );
          if (throwOnFailure) {
            throw templateErr;
          }
          return false;
        }
      } else {
        await resend.emails.send(payload);
      }

      console.log("[notifications] Document email send summary", {
        leadId: lead.id,
        to: routing.to,
        cc: routing.cc,
        bcc: routing.bcc,
        docsCount: docs.length,
        successCount: 1,
        failedCount: 0,
      });
      return true;
    } catch (e) {
      console.error("[notifications] Failed to send lead documents", e);
      if (throwOnFailure) throw e;
      return false;
    }
  };

  const [leadAlertResult, documentEmailResult] = await Promise.allSettled([
    leadAlertTask(),
    documentEmailTask(),
  ]);

  if (leadAlertResult.status === "fulfilled") {
    leadAlertSent = leadAlertResult.value;
  } else if (throwOnFailure) {
    throw leadAlertResult.reason;
  }

  if (documentEmailResult.status === "fulfilled") {
    documentEmailSent = documentEmailResult.value;
  } else if (throwOnFailure) {
    throw documentEmailResult.reason;
  }

  if (throwOnFailure && !leadAlertSent && !documentEmailSent) {
    throw new Error(
      `[notifications] No notification email sent (leadId=${lead.id}, page=${ruleSourcePage.slug})`,
    );
  }
}

