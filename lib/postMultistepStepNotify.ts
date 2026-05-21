import type { LandingPageContent } from "@/lib/types/page";

export async function postMultistepStepNotify(input: {
  getRecaptchaToken: () => Promise<string | null | undefined>;
  mainPage: LandingPageContent;
  currentStepIndex: number;
  accumulatedData: Record<string, Record<string, unknown>>;
  stepPage: LandingPageContent;
  currentValues: Record<string, unknown>;
  utmHiddenFields?: Record<string, string | undefined>;
  fubPersonId?: string | null;
  captchaSessionToken?: string | null;
}): Promise<{
  ok: boolean;
  error?: string;
  fubPersonId?: string | null;
  captchaSessionToken?: string | null;
}> {
  // Always request a fresh token. The backend can prefer a valid session token,
  // but this ensures fallback verification still works after session expiry.
  const token = await input.getRecaptchaToken();
  if ((!token || !token.trim()) && !input.captchaSessionToken) {
    return {
      ok: false,
      error:
        "Security verification could not be completed. Please try again.",
    };
  }
  const prevJson =
    input.currentStepIndex === 0
      ? undefined
      : JSON.stringify(input.accumulatedData);
  const body: Record<string, unknown> = {
    domain: input.mainPage.domain.hostname,
    slug: input.mainPage.slug,
    type: input.mainPage.type,
    ...input.currentValues,
    _stepSlug: input.stepPage.slug ?? input.mainPage.slug,
    _ctaText: input.stepPage.ctaText ?? input.mainPage.ctaText ?? "",
    ...(prevJson ? { _multistepData: prevJson } : {}),
    ...(input.fubPersonId ? { fubPersonId: input.fubPersonId } : {}),
    ...(token && token.trim() ? { recaptchaToken: token } : {}),
    ...(input.captchaSessionToken
      ? { captchaSessionToken: input.captchaSessionToken }
      : {}),
    website: "",
  };
  const utm = input.utmHiddenFields;
  if (utm?.utm_source) body.utm_source = utm.utm_source;
  if (utm?.utm_medium) body.utm_medium = utm.utm_medium;
  if (utm?.utm_campaign) body.utm_campaign = utm.utm_campaign;

  const res = await fetch("/api/leads/multistep-step-notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return {
      ok: false,
      error:
        (data && typeof data.error === "string" && data.error) ||
        "Could not send this step. Please try again.",
    };
  }
  const data = (await res.json().catch(() => null)) as
    | { fubPersonId?: string | null; captchaSessionToken?: string | null }
    | null;
  return {
    ok: true,
    fubPersonId: data?.fubPersonId ?? null,
    captchaSessionToken: data?.captchaSessionToken ?? null,
  };
}
