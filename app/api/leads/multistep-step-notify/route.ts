import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRecaptchaToken } from "@/lib/captcha";
import { mergeMultistepLeadFormData } from "@/lib/leadPayloadMerge";
import { sendMultistepIntermediateStepNotification } from "@/lib/notifications";
import { dispatchFormDataToFollowUpBoss } from "@/lib/followupboss";
import {
  createCaptchaSessionToken,
  verifyCaptchaSessionToken,
} from "@/lib/captchaSession";

function normalizeTopLevelContacts(merged: Record<string, unknown>): Record<string, unknown> {
  let out = { ...merged };
  if (!("email" in out) || !String((out as { email?: unknown }).email ?? "").includes("@")) {
    const email = findEmailInMerged(out);
    if (email) out = { ...out, email };
  }
  if (!("phone" in out) || !String((out as { phone?: unknown }).phone ?? "").trim()) {
    const phone = findPhoneInMerged(out);
    if (phone) out = { ...out, phone };
  }
  if (!("name" in out) || !String((out as { name?: unknown }).name ?? "").trim()) {
    const name = findNameInMerged(out);
    if (name) out = { ...out, name };
  }
  return out;
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
    return input.flatMap((v) => collectStringValues(v, seen));
  }
  const o: string[] = [];
  for (const v of Object.values(input as Record<string, unknown>)) {
    o.push(...collectStringValues(v, seen));
  }
  return o;
}

function findEmailInMerged(input: unknown): string | null {
  const values = collectStringValues(input);
  for (const v of values) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
  }
  return null;
}

function findPhoneInMerged(input: unknown): string | null {
  const looksLikePhone = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes("@")) return false;
    const digits = trimmed.replace(/\D/g, "");
    return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
  };
  const values = collectStringValues(input);
  for (const v of values) {
    if (looksLikePhone(v)) return v.trim();
  }
  return null;
}

function findNameInMerged(input: unknown): string | null {
  const seen = new Set<unknown>();
  const visit = (node: unknown): string | null => {
    if (!node || typeof node !== "object") return null;
    if (seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        const n = visit(item);
        if (n) return n;
      }
      return null;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const nk = key.trim().toLowerCase();
      if (
        typeof value === "string" &&
        (nk === "name" ||
          nk === "fullname" ||
          nk === "first_name" ||
          nk === "firstname") &&
        value.trim().length > 0 &&
        !value.includes("@")
      ) {
        return value.trim();
      }
      if (value && typeof value === "object") {
        const n = visit(value);
        if (n) return n;
      }
    }
    return null;
  };
  return visit(input);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      domain,
      slug,
      type,
      recaptchaToken,
      captchaSessionToken,
      fubPersonId,
      website,
      ...formData
    } = body ?? {};

    const honeypotValue =
      typeof website === "string"
        ? website.replace(/&nbsp;/gi, " ").replace(/\u00A0/g, " ").trim()
        : "";
    if (honeypotValue.length > 0) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!domain || !slug || !type) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const captchaSessionCheck = verifyCaptchaSessionToken(captchaSessionToken, {
      domain: String(domain),
      slug: String(slug),
      action: "lead_step_notify",
    });
    const captchaResult = captchaSessionCheck.ok
      ? {
          ok: true,
          score: 1,
          skipped: true,
          action: "lead_step_notify" as string | null,
          reason: "session_valid" as const,
          raw: null as unknown,
        }
      : await verifyRecaptchaToken(recaptchaToken ?? null, {
          minScore: 0.3,
          expectedAction: "lead_step_notify",
        }).catch((e) => {
          console.error("[recaptcha] multistep-step-notify verification error", e);
          return {
            ok: false,
            score: 0,
            skipped: false,
            action: null as string | null,
            reason: "verification_error" as const,
            raw: null as unknown,
          };
        });
    try {
      const errorCodes =
        captchaResult && "raw" in captchaResult && captchaResult.raw && "error-codes" in (captchaResult.raw as Record<string, unknown>)
          ? (((captchaResult.raw as Record<string, unknown>)["error-codes"] as string[] | undefined) ?? [])
          : [];
      console.log("[recaptcha] multistep-step-notify verification", {
        ok: captchaResult.ok,
        score: captchaResult.score,
        action: captchaResult.action ?? null,
        reason: captchaResult.reason,
        sessionReason: captchaSessionCheck.ok ? "session_valid" : captchaSessionCheck.reason,
        errorCodes,
      });
    } catch {
      // ignore logging failures
    }
    if (!captchaResult.ok) {
      if (
        captchaResult.reason === "low_score" ||
        captchaResult.reason === "action_mismatch"
      ) {
        return NextResponse.json({
          ok: true,
          sent: false,
          skippedReason: `recaptcha_${captchaResult.reason}`,
        });
      }
      return NextResponse.json({ error: "Failed CAPTCHA verification" }, { status: 400 });
    }

    const entry = await prisma.landingPage.findFirst({
      where: {
        slug: String(slug),
        status: "published",
        domain: { hostname: String(domain), isActive: true },
      },
      include: { domain: true },
    });
    if (!entry?.domain) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const rawSlugs = entry.multistepStepSlugs as unknown;
    const stepSlugs = Array.isArray(rawSlugs)
      ? rawSlugs
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
      : [];
    if (stepSlugs.length === 0) {
      return NextResponse.json({ error: "Not a multistep entry page" }, { status: 400 });
    }

    const stepSlugRaw = (formData as { _stepSlug?: unknown })._stepSlug;
    const stepSlug = typeof stepSlugRaw === "string" ? stepSlugRaw.trim() : "";
    if (!stepSlug) {
      return NextResponse.json({ error: "Missing _stepSlug" }, { status: 400 });
    }

    const ctaRaw = (formData as { _ctaText?: unknown })._ctaText;
    const formCtaLabel = typeof ctaRaw === "string" ? ctaRaw.trim() : "";

    const isEntryStep = stepSlug === entry.slug;
    const idxInFlow = stepSlugs.indexOf(stepSlug);
    if (!isEntryStep && idxInFlow === -1) {
      return NextResponse.json({ error: "Invalid step for this multistep entry" }, { status: 400 });
    }
    if (!isEntryStep && idxInFlow === stepSlugs.length - 1) {
      return NextResponse.json(
        { error: "Use the normal form submit on the final step" },
        { status: 400 },
      );
    }

    let merged = mergeMultistepLeadFormData(formData as Record<string, unknown>);
    merged = normalizeTopLevelContacts(merged);

    const stepPageRow =
      isEntryStep
        ? entry
        : await prisma.landingPage.findFirst({
            where: {
              slug: stepSlug,
              domainId: entry.domainId,
              status: "published",
              deletedAt: null,
            },
          });
    if (!stepPageRow) {
      return NextResponse.json({ error: "Step page not found" }, { status: 400 });
    }

    const stepHero = Array.isArray(stepPageRow.sections)
      ? (stepPageRow.sections as Array<{ kind?: string; props?: Record<string, unknown> }>)
          .find((s) => s?.kind === "hero")
      : null;
    const notifyEach = Boolean(
      stepHero?.props?.multistepNotifyEachStep ??
        (stepPageRow as { multistepNotifyEachStep?: boolean }).multistepNotifyEachStep,
    );
    const result = notifyEach
      ? await sendMultistepIntermediateStepNotification({
          entryPageSlug: entry.slug,
          leadType: String(type),
          domain: {
            hostname: entry.domain.hostname,
            displayName: entry.domain.displayName,
            logoUrl: entry.domain.logoUrl,
            notifyEmail: entry.domain.notifyEmail,
          },
          stepPage: {
            slug: stepPageRow.slug,
            ctaText: stepPageRow.ctaText,
            sections: stepPageRow.sections,
            multistepNotifyEachStep: notifyEach,
          },
          mergedFormData: merged,
          formCtaLabel: formCtaLabel || stepPageRow.ctaText,
        })
      : { sent: false, skippedReason: "disabled_on_page" as const };
    const existingFubPersonIdRaw =
      typeof fubPersonId === "string" && fubPersonId.trim().length > 0
        ? fubPersonId
        : merged._fubPersonId;
    const existingFubPersonId =
      typeof existingFubPersonIdRaw === "string" && existingFubPersonIdRaw.trim()
        ? existingFubPersonIdRaw.trim()
        : null;
    let dispatchedFubPersonId: string | null = null;
    let followUpBossErrorCode: string | null = null;
    try {
      dispatchedFubPersonId = await dispatchFormDataToFollowUpBoss({
        domainHostname: entry.domain.hostname,
        domainNotifyEmail: entry.domain.notifyEmail,
        pageSlug: stepPageRow.slug,
        pageType: String(type),
        pageCtaText: stepPageRow.ctaText,
        formData: merged,
        utmSource:
          typeof (formData as { utm_source?: unknown }).utm_source === "string"
            ? (formData as { utm_source?: string }).utm_source ?? null
            : null,
        utmMedium:
          typeof (formData as { utm_medium?: unknown }).utm_medium === "string"
            ? (formData as { utm_medium?: string }).utm_medium ?? null
            : null,
        utmCampaign:
          typeof (formData as { utm_campaign?: unknown }).utm_campaign === "string"
            ? (formData as { utm_campaign?: string }).utm_campaign ?? null
            : null,
        existingPersonId: existingFubPersonId,
        throwOnFailure: true,
      });
    } catch (fubError) {
      console.error("[multistep-step-notify] FUB dispatch failed", {
        domain: entry.domain.hostname,
        slug: stepPageRow.slug,
        error: fubError,
      });
      followUpBossErrorCode = "FOLLOWUPBOSS_DISPATCH_FAILED";
    }
    const nextCaptchaSessionToken = createCaptchaSessionToken({
      domain: String(domain),
      slug: String(slug),
      action: "lead_step_notify",
    });

    if (!result.sent && result.skippedReason === "missing_contact_for_notify") {
      return NextResponse.json(
        { ok: false, error: "Add an email or phone before continuing, or enable notify-only mode on the CTA rule." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      skippedReason: result.skippedReason,
      fubPersonId: dispatchedFubPersonId,
      followUpBossErrorCode,
      captchaSessionToken: nextCaptchaSessionToken,
    });
  } catch (e) {
    console.error("[multistep-step-notify]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
