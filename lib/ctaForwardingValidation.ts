import {
  type CtaForwardingRule,
  normalizeCtaTitleKey,
} from "@/lib/types/ctaForwarding";

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

export function hasValidEmailInPayload(input: unknown): boolean {
  const values = collectStringValues(input);
  return values.some((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

export function ruleHasConfiguredCtaForwardingExtras(rule: CtaForwardingRule | null): boolean {
  if (!rule) return false;
  const hasDocuments = Array.isArray(rule.documents)
    && rule.documents.some(
      (doc) => typeof doc?.name === "string"
        && doc.name.trim().length > 0
        && typeof doc?.url === "string"
        && doc.url.trim().length > 0,
    );
  const hasNotifyEmails = Array.isArray(rule.notifyEmails)
    && rule.notifyEmails.some(
      (entry) => typeof entry?.email === "string" && entry.email.trim().length > 0,
    );
  return hasDocuments && hasNotifyEmails;
}

export function findMatchingCtaRuleByText(
  rules: CtaForwardingRule[] | undefined,
  ctaText: string | null | undefined,
): CtaForwardingRule | null {
  const normalized = normalizeCtaTitleKey(ctaText ?? "");
  if (!normalized) return null;
  return (
    (rules ?? []).find(
      (rule) => normalizeCtaTitleKey(rule.ctaTitle) === normalized,
    ) ?? null
  );
}

export type CtaRuleResolution = {
  rule: CtaForwardingRule | null;
  strategy:
    | "exact-normalized"
    | "normalized-contains"
    | "single-rule-fallback"
    | "no-match";
};

function stripToAlphaNumeric(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeDisplayText(value: string | null | undefined): string {
  const raw = String(value ?? "");
  const withoutTags = raw.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(withoutTags);
  return decoded.replace(/\s+/g, " ").trim();
}

export function resolveCtaRuleForSubmission(
  rules: CtaForwardingRule[] | undefined,
  ctaText: string | null | undefined,
): CtaRuleResolution {
  const list = rules ?? [];
  if (list.length === 0) {
    return { rule: null, strategy: "no-match" };
  }

  const normalized = normalizeCtaTitleKey(ctaText ?? "");
  if (normalized) {
    const exact = list.find(
      (rule) => normalizeCtaTitleKey(rule.ctaTitle) === normalized,
    );
    if (exact) {
      return { rule: exact, strategy: "exact-normalized" };
    }

    const relaxedNeedle = stripToAlphaNumeric(normalized);
    if (relaxedNeedle) {
      const contains = list.find((rule) => {
        const relaxedRuleTitle = stripToAlphaNumeric(
          normalizeCtaTitleKey(rule.ctaTitle),
        );
        return (
          relaxedRuleTitle.includes(relaxedNeedle) ||
          relaxedNeedle.includes(relaxedRuleTitle)
        );
      });
      if (contains) {
        return { rule: contains, strategy: "normalized-contains" };
      }
    }
  }

  if (list.length === 1) {
    return { rule: list[0], strategy: "single-rule-fallback" };
  }

  return { rule: null, strategy: "no-match" };
}

export function buildEmailRequiredValidationMessage(input: {
  ctaText: string | null | undefined;
  resolution: CtaRuleResolution;
}): string {
  void input;
  return "The document is attached to this form, so an email address is required for delivery";
}


