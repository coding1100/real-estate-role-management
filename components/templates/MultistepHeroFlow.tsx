"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { LandingPageContent } from "@/lib/types/page";
import type { FormSchema } from "@/lib/types/form";
import type { CtaForwardingRule } from "@/lib/types/ctaForwarding";
import { wrapLegalSignsHtml } from "@/lib/richTextSigns";
import { DynamicForm } from "@/components/forms/DynamicForm";
import { SocialLinksBar } from "@/components/templates/SocialLinksBar";
import { useRecaptcha } from "@/components/forms/Captcha";
import { useToast } from "@/components/ui/use-toast";
import {
  PropertyFindingStep,
  type ZestimateResult,
} from "@/components/templates/HomeValueMultistepFlow";
import { HeroBackgroundImage } from "@/components/templates/HeroBackgroundImage";
import { DetailedPerspectiveProfileColumn } from "@/components/templates/DetailedPerspectiveProfileColumn";
import { postMultistepStepNotify } from "@/lib/postMultistepStepNotify";
import { trackDataLayerEvent } from "@/lib/tracking";
import { resolveCtaRuleForSubmission } from "@/lib/ctaForwardingValidation";

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden?: boolean;
}

type FormStyle =
  | "default"
  | "questionnaire"
  | "detailed-perspective"
  | "next-steps"
  | "property-finding"
  | "team-showcase";

interface HeroLayoutConfig {
  formIntro?: string;
  leftMainHtml?: string;
  nextStepsFirstHtml?: string;
  nextStepsSecondHtml?: string;
  nextStepsSecondImageUrl?: string;
  formHeading?: string;
  formBgColor?: string;
  formTextSize?: string;
  ctaBgColor?: string;
  formStyle?: FormStyle;
  profileImageUrl?: string;
  profileImageWidthPx?: number;
  profileImagePosition?: string;
  profileImageOffsetTop?: number;
  profileImageOffsetLeft?: number;
  profileSectionHtml?: string;
  profileName?: string;
  profileTitle?: string;
  profileRole?: string;
  profilePhone?: string;
  profileEmail?: string;
  formPostCtaText?: string;
  formFooterText?: string;
  heroLowerStripHtml?: string;
  teamImageUrl?: string;
  teamInfoHtml?: string;
  teamTrustHtml?: string;
  heroImageBrightness?: number;
}

interface MultistepHeroFlowProps {
  mainPage: LandingPageContent;
  steps: LandingPageContent[];
  /**
   * Optional fallback layout data from the entry page.
   * When a step has its own PageLayout, that layout is used instead.
   */
  layoutData?: LayoutItem[] | null;
  utmHiddenFields?: Record<string, string | undefined>;
  ctaForwardingRules?: CtaForwardingRule[];
}

export function MultistepHeroFlow({
  mainPage,
  steps,
  layoutData,
  utmHiddenFields,
  ctaForwardingRules,
}: MultistepHeroFlowProps) {
  const parseSubmissionErrorMessage = async (res: Response): Promise<string> => {
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data?.error === "string" && data.error.trim()) {
        return data.error.trim();
      }
    } catch {
      // Ignore non-JSON responses and use fallback.
    }
    return "Unable to submit your request. Please try again.";
  };
  const isCaptchaFailure = (status: number, message: string): boolean =>
    status === 400 && /captcha/i.test(message);

  const readPageCtaRules = (page: LandingPageContent): CtaForwardingRule[] => {
    const hero = Array.isArray(page.sections)
      ? page.sections.find((section: { kind?: string }) => section?.kind === "hero")
      : null;
    const props = (hero?.props ?? null) as { ctaForwardingRules?: unknown } | null;
    return Array.isArray(props?.ctaForwardingRules)
      ? (props!.ctaForwardingRules as CtaForwardingRule[])
      : [];
  };
  const [currentStep, setCurrentStep] = useState(0);
  const [accumulatedData, setAccumulatedData] = useState<Record<string, Record<string, unknown>>>({});
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [isStepSubmitting, setIsStepSubmitting] = useState(false);
  const [submittingDotCount, setSubmittingDotCount] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isFinalSubmitted, setIsFinalSubmitted] = useState(false);
  const [fubPersonId, setFubPersonId] = useState<string | null>(null);
  const [captchaSessionToken, setCaptchaSessionToken] = useState<string | null>(null);
  const trackedStepViewKeys = useRef<Set<string>>(new Set());
  const { execute } = useRecaptcha();
  const { toast } = useToast();

  if (!steps.length) return null;

  // In multistep mode, social icons should follow the first configured step
  // so the entry page reflects the step-1 social visibility/links.
  const socialSourcePage = steps[0] ?? mainPage;

  const step = steps[currentStep];
  const stepLayoutData =
    (step.pageLayout?.layoutData as LayoutItem[] | undefined) ||
    (layoutData as LayoutItem[] | undefined) ||
    undefined;
  const heroSection = step.sections?.find((s: { kind: string }) => s.kind === "hero");
  const layout = (heroSection?.props as HeroLayoutConfig) || {};
  const formSchema = (step.formSchema as FormSchema) ?? null;
  const formHeading = layout?.formHeading?.trim() ?? "";
  const formBgColor = layout?.formBgColor;
  const formTextSize = layout?.formTextSize;
  const ctaBgColor = layout?.ctaBgColor;
  const isQuestionnaire = layout?.formStyle === "questionnaire";
  const isDetailedPerspective = layout?.formStyle === "detailed-perspective";
  const isNextSteps = layout?.formStyle === "next-steps";
  const isPropertyFinding = layout?.formStyle === "property-finding";
  const isTeamShowcase = layout?.formStyle === "team-showcase";
  const isProfileOnlyNextSteps =
    isNextSteps &&
    ((((layout as any)?.nextStepsSecondOnly as boolean | undefined) === true) ||
      step.slug === "strategy-call");
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const isThankYouStep = isLastStep && isNextSteps;
  const teamImageUrl = layout?.teamImageUrl;
  const teamInfoHtml = layout?.teamInfoHtml;
  const teamTrustHtml = layout?.teamTrustHtml;
  const normalizeBrightness = (value: unknown, fallback: number): number => {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(1, Math.max(0.2, parsed));
  };
  const teamHeroBrightness = normalizeBrightness(
    layout?.heroImageBrightness,
    0.58,
  );
  const defaultHeroBrightness = normalizeBrightness(
    layout?.heroImageBrightness,
    0.65,
  );

  const textLayout = stepLayoutData?.find(
    (l) => l.i === "text-container" && !l.hidden,
  );
  const formLayout = stepLayoutData?.find(
    (l) => l.i === "form-container" && !l.hidden,
  );
  const useSavedLayout = textLayout && formLayout;
  const gridWrapperClass = useSavedLayout
    ? "hero-grid-wrapper grid items-start md:grid-cols-12 md:items-center"
    : "grid items-start gap-6 md:grid-cols-12 md:gap-8 md:items-center";
  const gridWrapperStyle = useSavedLayout
    ? { display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "1.5rem 2rem", alignItems: "start" as const }
    : undefined;
  const textContainerStyle = useSavedLayout && textLayout
    ? { gridColumn: `${textLayout.x + 1} / span ${textLayout.w}` as const, gridRow: `${textLayout.y + 1} / span ${textLayout.h}` as const }
    : undefined;
  const formContainerStyle = useSavedLayout && formLayout
    ? { gridColumn: `${formLayout.x + 1} / span ${formLayout.w}` as const, gridRow: `${formLayout.y + 1} / span ${formLayout.h}` as const }
    : undefined;
  const textContainerClass = useSavedLayout
    ? "relative mt-0 space-y-4 md:-mt-4 md:space-y-6 lg:-mt-[50px] content-area"
    : "relative col-span-12 mt-0 space-y-4 md:col-span-8 md:-mt-4 md:space-y-6 lg:-mt-[50px]";
  const formContainerClass = useSavedLayout
    ? "w-full md:w-auto form-area"
    : "col-span-12 w-full md:col-span-4 md:w-auto";

  useEffect(() => {
    if (!isSubmittingFinal && !isStepSubmitting) {
      setSubmittingDotCount(1);
      return;
    }
    const timer = setInterval(() => {
      setSubmittingDotCount((count) => (count % 3) + 1);
    }, 380);
    return () => clearInterval(timer);
  }, [isSubmittingFinal, isStepSubmitting]);

  useEffect(() => {
    const stepSlug = String(step?.slug ?? mainPage.slug ?? "");
    const key = `${stepSlug}:${currentStep}`;
    if (trackedStepViewKeys.current.has(key)) return;
    trackedStepViewKeys.current.add(key);
    trackDataLayerEvent("lead_step_view", {
      entry_slug: String(mainPage.slug ?? ""),
      step_slug: stepSlug,
      step_index: currentStep + 1,
      is_last_step: isLastStep,
      flow_type: "multistep",
      page_type: String(mainPage.type ?? ""),
      domain_host: String(mainPage.domain?.hostname ?? ""),
      cta_title: String(step?.ctaText ?? ""),
    });
  }, [currentStep, isLastStep, mainPage.domain?.hostname, mainPage.slug, mainPage.type, step]);

  const handleNextStep = async (
    values: Record<string, unknown>,
    propertyContext?: { address: string; result: ZestimateResult | null },
  ) => {
      if (isStepSubmitting) return;
      setIsStepSubmitting(true);
      try {
      const mergedValues: Record<string, unknown> = { ...values };
      if (propertyContext) {
        const trimmed = propertyContext.address.trim();
        if (trimmed) mergedValues.searchedAddress = trimmed;
        if (propertyContext.result?.address) {
          mergedValues.resolvedAddress = propertyContext.result.address;
        }
        if (typeof propertyContext.result?.estimate === "number") {
          mergedValues.estimate = String(propertyContext.result.estimate);
        }
        if (typeof propertyContext.result?.lat === "number") {
          mergedValues.latitude = String(propertyContext.result.lat);
        }
        if (typeof propertyContext.result?.lng === "number") {
          mergedValues.longitude = String(propertyContext.result.lng);
        }
      }

      const shouldNotify =
        step.multistepNotifyEachStep === true && !isLastStep;
      if (shouldNotify) {
        const result = await postMultistepStepNotify({
          getRecaptchaToken: () => execute("lead_step_notify"),
          mainPage,
          currentStepIndex: currentStep,
          accumulatedData,
          stepPage: step,
          currentValues: mergedValues,
          utmHiddenFields,
          fubPersonId,
          captchaSessionToken,
        });
        if (!result.ok) {
          toast({
            title: "Could not continue",
            description: result.error ?? "Please try again.",
            variant: "destructive",
          });
          return;
        }
        if (result.fubPersonId) {
          setFubPersonId(result.fubPersonId);
        }
        if (result.captchaSessionToken) {
          setCaptchaSessionToken(result.captchaSessionToken);
        }
      }
      setAccumulatedData((prev) => ({
        ...prev,
        ["step" + currentStep]: mergedValues,
      }));
      trackDataLayerEvent("lead_step_continue", {
        entry_slug: String(mainPage.slug ?? ""),
        step_slug: String(step?.slug ?? mainPage.slug ?? ""),
        step_index: currentStep + 1,
        is_last_step: isLastStep,
        flow_type: "multistep",
        page_type: String(mainPage.type ?? ""),
        domain_host: String(mainPage.domain?.hostname ?? ""),
        cta_title: String(step?.ctaText ?? ""),
      });
      setCurrentStep((i) => i + 1);
      } finally {
        setIsStepSubmitting(false);
      }
  };

  const handleFinalSubmitFromNextSteps = async () => {
    if (isSubmittingFinal) return;
    setIsSubmittingFinal(true);
    setSubmitError(null);
    try {
      const resolvedCtaText = step.ctaText ?? mainPage.ctaText ?? "";
      const buildBody = (token: string | null): Record<string, unknown> => {
        const body: Record<string, unknown> = {
        domain: mainPage.domain.hostname,
        slug: mainPage.slug,
        type: mainPage.type,
        _ctaText: resolvedCtaText,
        _stepSlug: step.slug ?? mainPage.slug,
        website: "",
        };
      if (fubPersonId) {
        body.fubPersonId = fubPersonId;
      }
        if (Object.keys(accumulatedData).length > 0) {
          body._multistepData = JSON.stringify(accumulatedData);
        }
        if (captchaSessionToken) {
          body.captchaSessionToken = captchaSessionToken;
        }
        if (token) {
          body.recaptchaToken = token;
        }
        return body;
      };
      const firstToken = await execute("lead_submit");
      let res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(firstToken)),
      });
      let failureMessage = "";
      if (!res.ok) {
        failureMessage = await parseSubmissionErrorMessage(res);
        if (isCaptchaFailure(res.status, failureMessage)) {
          const retryToken = await execute("lead_submit");
          res = await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildBody(retryToken)),
          });
          if (!res.ok) {
            failureMessage = await parseSubmissionErrorMessage(res);
          }
        }
      }
      if (!res.ok) {
        const msg = failureMessage || "Unable to submit your request. Please try again.";
        setSubmitError(msg);
        toast({
          title: "Submission failed",
          description: msg,
          variant: "destructive",
        });
      } else {
        setIsFinalSubmitted(true);
        setSubmitError(null);
        trackDataLayerEvent("generate_lead", {
          entry_slug: String(mainPage.slug ?? ""),
          step_slug: String(step?.slug ?? mainPage.slug ?? ""),
          step_index: currentStep + 1,
          is_last_step: true,
          flow_type: "multistep",
          page_type: String(mainPage.type ?? ""),
          domain_host: String(mainPage.domain?.hostname ?? ""),
          cta_title: String(step?.ctaText ?? ""),
        });
        const plainSuccess =
          (mainPage.successMessage &&
            mainPage.successMessage.replace(/<[^>]+>/g, "").trim()) ||
          "Thank you! We'll be in touch shortly.";
        toast({
          title: "Success",
          description: plainSuccess,
          variant: "default",
        });
        const redirectRule = resolveCtaRuleForSubmission(
          stepCtaForwardingRules,
          step?.ctaText ?? mainPage.ctaText ?? "",
        ).rule;
        if (redirectRule?.forwardEnabled !== false && redirectRule?.forwardUrl) {
          window.location.assign(redirectRule.forwardUrl);
        }
      }
    } catch (e) {
      const msg =
        e instanceof Error && e.message.trim()
          ? e.message.trim()
          : "Unable to submit your request. Please try again.";
      setSubmitError(msg);
      toast({
        title: "Submission failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingFinal(false);
    }
  };

  const extraHiddenFieldsForSubmit: Record<string, string> = {
    domain: mainPage.domain.hostname,
    slug: mainPage.slug,
    type: mainPage.type,
    _stepSlug: step.slug ?? mainPage.slug,
  };
  if (Object.keys(accumulatedData).length > 0) {
    extraHiddenFieldsForSubmit._multistepData = JSON.stringify(accumulatedData);
  }
  if (fubPersonId) {
    extraHiddenFieldsForSubmit.fubPersonId = fubPersonId;
  }
  if (utmHiddenFields) {
    if (utmHiddenFields.utm_source) {
      extraHiddenFieldsForSubmit.utm_source = utmHiddenFields.utm_source;
    }
    if (utmHiddenFields.utm_medium) {
      extraHiddenFieldsForSubmit.utm_medium = utmHiddenFields.utm_medium;
    }
    if (utmHiddenFields.utm_campaign) {
      extraHiddenFieldsForSubmit.utm_campaign = utmHiddenFields.utm_campaign;
    }
  }
  const stepCtaForwardingRules = (() => {
    const stepRules = readPageCtaRules(step);
    return stepRules.length > 0 ? stepRules : (ctaForwardingRules ?? []);
  })();

  if (isPropertyFinding) {
    const propertyLayout = {
      leftMainHtml: layout.leftMainHtml,
      formHeading: layout.formHeading,
      formIntro: layout.formIntro,
      formFooterText: layout.formFooterText,
      formBgColor: layout.formBgColor,
      ctaBgColor: layout.ctaBgColor,
      heroLowerStripHtml: layout.heroLowerStripHtml,
    };

    return (
      <PropertyFindingStep
        page={step}
        layout={propertyLayout}
        formSchema={formSchema}
        onNextStep={(values, ctx) => handleNextStep(values, ctx)}
      />
    );
  }

  if (isTeamShowcase) {
    return (
      <section className="relative text-white min-h-[calc(100vh_-_85px)] pt-[120px] max-[768px]:pt-20">
        {(step.heroImageUrl || mainPage.heroImageUrl) && (
          <div className="pointer-events-none inset-0 fixed top-0 left-0 right-0 bottom-0">
            <HeroBackgroundImage
              src={(step.heroImageUrl || mainPage.heroImageUrl) as string}
              alt={step.headline}
              style={{ filter: `brightness(${teamHeroBrightness})` }}
              className="object-cover"
            />
          </div>
        )}

        <div className="mx-auto max-w-6xl px-4 pb-10 md:px-0 md:pb-12 relative z-10">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)] items-end">
            <div className="team-member space-y-4 rounded-[2px] md:p-6">
              <div
                className="rounded-[2px] bg-amber-50/95 p-4 text-zinc-900 md:p-5"
                style={formBgColor ? { backgroundColor: formBgColor } : undefined}
              >
                {formHeading ? (
                  <div
                    className="mb-3 font-serif text-lg font-semibold leading-tight text-amber-900"
                    dangerouslySetInnerHTML={{
                      __html: wrapLegalSignsHtml(formHeading),
                    }}
                  />
                ) : null}

                {formSchema && formSchema.fields?.length ? (
                  <DynamicForm
                    key={step.slug || `step-${currentStep}`}
                    schema={formSchema}
                    ctaText={step.ctaText}
                    successMessage={mainPage.successMessage}
                    ctaBgColor={ctaBgColor}
                    textSize={formTextSize}
                    extraHiddenFields={
                      isLastStep ? extraHiddenFieldsForSubmit : undefined
                    }
                    onNextStep={isLastStep ? undefined : handleNextStep}
                    ctaForwardingRules={
                      isLastStep ? stepCtaForwardingRules : undefined
                    }
                  />
                ) : !isLastStep ? (
                  <button
                    type="button"
                    onClick={() => handleNextStep({})}
                    disabled={isStepSubmitting}
                    className="inline-flex w-full items-center justify-center bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    style={ctaBgColor ? { backgroundColor: ctaBgColor } : undefined}
                  >
                    {isStepSubmitting ? (
                      `Submitting${".".repeat(submittingDotCount)}`
                    ) : (
                      <span
                        className="cta-text"
                        dangerouslySetInnerHTML={{
                          __html: wrapLegalSignsHtml(step.ctaText ?? mainPage.ctaText),
                        }}
                      />
                    )}
                  </button>
                ) : null}

                {teamTrustHtml ? (
                  <div
                    className="mt-3 text-xs text-zinc-700"
                    dangerouslySetInnerHTML={{
                      __html: wrapLegalSignsHtml(teamTrustHtml),
                    }}
                  />
                ) : null}

                <div className="mt-3">
                  <SocialLinksBar
                    base={socialSourcePage.domain}
                    overrides={socialSourcePage.socialOverrides ?? null}
                  />
                </div>
              </div>
            </div>

            <div className="relative min-h-[260px] md:min-h-[420px] team-img self-end md:sticky md:bottom-0 max-[768px]:!relative">
              {teamImageUrl ? (
                <Image
                  src={teamImageUrl}
                  alt="Team"
                  fill
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 40vw"
                  className="object-contain object-bottom"
                />
              ) : (
                <div className="h-full w-full rounded-[2px] border border-white/20 bg-black/25" />
              )}
              {teamInfoHtml ? (
                <div
                  className="absolute bottom-2 right-2 max-w-[100%] bottom-[10%] right-[10%] rounded-[2px] px-3 py-2 text-right text-xs text-white md:text-sm"
                  dangerouslySetInnerHTML={{
                    __html: wrapLegalSignsHtml(teamInfoHtml),
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={
        isThankYouStep
          ? "relative text-white pt-[110px] max-[768px]:pt-20 pb-8"
          : "relative text-white min-h-[calc(100vh_-_85px)] pt-[120px] max-[768px]:pt-20"
      }
    >
      {(mainPage.heroImageUrl || step.heroImageUrl) && (
        <div className="pointer-events-none inset-0 fixed top-0 left-0 right-0 bottom-0">
          <HeroBackgroundImage
            src={(step.heroImageUrl || mainPage.heroImageUrl) as string}
            alt={step.headline}
            priority
            className="object-cover"
            style={{ filter: `brightness(${defaultHeroBrightness})` }}
          />
        </div>
      )}

      <div className="mx-auto flex h-full max-w-6xl flex-col justify-start pt-[30px] gap-8 px-4 pb-6 max-[768px]:px-4 md:gap-10 md:px-0 md:pb-8">
        <div className={gridWrapperClass} style={gridWrapperStyle}>
          <div className={textContainerClass} style={textContainerStyle}>
            <div>
              {/* <p className="mb-2 text-[14px] font-semibold uppercase tracking-[0.26em] text-zinc-300">
                {mainPage.domain.displayName}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
                {step.headline}
              </h1>
              {step.subheadline && (
                <p className="mt-3 text-sm md:text-base text-zinc-200">
                  {step.subheadline}
                </p>
              )} */}
              {layout?.leftMainHtml && (
                <div
                  className="mt-4 space-y-2"
                  dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(layout.leftMainHtml) }}
                />
              )}
            </div>
          </div>

          <div className={formContainerClass} style={formContainerStyle}>
            {isNextSteps ? (
              <div
                className="cust1 form-area relative w-full rounded-[2px] p-6 text-zinc-900 shadow-2xl bg-amber-50/95 opacity-95 border border-amber-200/60"
                style={formBgColor ? { backgroundColor: formBgColor } : undefined}
              >
                {formHeading && (
                  <h2
                    className="mb-5 text-xl font-semibold text-zinc-800 font-serif leading-tight text-center md:text-left"
                    dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(formHeading) }}
                  />
                )}

                {isProfileOnlyNextSteps ? (
                  <div className="space-y-3">
                    <div className="relative flex items-stretch rounded-[2px] border border-[#cbb1a7ab] bg-[#fff6f1] px-4 py-4 max-[768px]:flex-wrap">
                      {(layout?.nextStepsSecondImageUrl ||
                        layout?.profileImageUrl) && (
                        <div className="relative h-[110px] w-[90px] flex-shrink-0 self-center overflow-hidden rounded-[2px] mr-[15px] max-[768px]:mb-2">
                          <Image
                            src={
                              (layout?.nextStepsSecondImageUrl ||
                                layout?.profileImageUrl) as string
                            }
                            alt={(layout?.profileName as string) || "Profile"}
                            fill
                            loading="lazy"
                            className="object-cover rounded-[4px]"
                          />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col justify-center space-y-1.5 pr-4">
                        {layout?.nextStepsSecondHtml ? (
                          <div
                            className="text-sm text-zinc-800 font-serif leading-relaxed space-y-1.5"
                            dangerouslySetInnerHTML={{
                              __html: wrapLegalSignsHtml(layout.nextStepsSecondHtml),
                            }}
                          />
                        ) : (
                          <>
                            {layout?.profileName && (
                              <h3 className="text-base font-semibold text-zinc-800 font-serif">
                                {layout.profileName as string}
                              </h3>
                            )}
                            {layout?.profileRole && (
                              <p className="text-sm text-zinc-700 font-serif">
                                {layout.profileRole as string}
                              </p>
                            )}
                            {layout?.profileTitle && (
                              <p className="text-sm text-zinc-600 font-serif">
                                {layout.profileTitle as string}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-3">
                      <button
                        type="button"
                        onClick={isLastStep ? handleFinalSubmitFromNextSteps : undefined}
                        disabled={isSubmittingFinal}
                        className="inline-flex w-full items-center justify-center rounded-[2px] px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        style={
                          ctaBgColor
                            ? { backgroundColor: ctaBgColor }
                            : { backgroundColor: "#a5883b" }
                        }
                      >
                        {isSubmittingFinal ? (
                          `Submitting${".".repeat(submittingDotCount)}`
                        ) : (
                          <span
                            dangerouslySetInnerHTML={{
                              __html: wrapLegalSignsHtml(step.ctaText),
                            }}
                          />
                        )}
                      </button>
                      <SocialLinksBar
                        base={socialSourcePage.domain}
                        overrides={socialSourcePage.socialOverrides ?? null}
                        className="mt-2"
                      />
                      {isFinalSubmitted && mainPage.successMessage && (
                        <div
                          className="text-md text-emerald-800 font-serif text-center"
                          dangerouslySetInnerHTML={{
                            __html: wrapLegalSignsHtml(mainPage.successMessage),
                          }}
                        />
                      )}
                      {submitError && (
                        <p className="text-[14px] text-red-700 font-serif text-center">
                          {submitError}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 max-[768px]:grid-cols-1 md:grid-cols-2 md:gap-4">
                    <div className="space-y-3">
                      <div className="rounded-[2px] border border-[#cbb1a7ab] bg-[#fff6f1] px-4 py-4">
                        {(layout?.nextStepsFirstHtml || layout?.leftMainHtml) && (
                          <div
                            className="text-sm text-zinc-800 font-serif leading-relaxed space-y-2"
                            dangerouslySetInnerHTML={{
                              __html:
                                layout?.nextStepsFirstHtml ||
                                layout?.leftMainHtml ||
                                "",
                            }}
                          />
                        )}
                      </div>
                      <div className="relative flex items-stretch rounded-[2px] border border-[#cbb1a7ab] bg-[#fff6f1] px-4 py-4 max-[768px]:flex-wrap">
                        {(layout?.nextStepsSecondImageUrl ||
                          layout?.profileImageUrl) && (
                          <div className="relative h-[110px] w-[90px] flex-shrink-0 self-center overflow-hidden rounded-[2px] mr-[15px] max-[768px]:mb-2">
                            <Image
                              src={
                                (layout?.nextStepsSecondImageUrl ||
                                  layout?.profileImageUrl) as string
                              }
                              alt={(layout?.profileName as string) || "Profile"}
                              fill
                              loading="lazy"
                              className="object-cover rounded-[4px]"
                            />
                          </div>
                        )}
                        <div className="flex flex-1 flex-col justify-center space-y-1.5 pr-4">
                          {layout?.nextStepsSecondHtml ? (
                            <div
                              className="text-sm text-zinc-800 font-serif leading-relaxed space-y-1.5"
                              dangerouslySetInnerHTML={{
                                __html: wrapLegalSignsHtml(layout.nextStepsSecondHtml),
                              }}
                            />
                          ) : (
                            <>
                              {layout?.profileName && (
                                <h3 className="text-base font-semibold text-zinc-800 font-serif">
                                  {layout.profileName as string}
                                </h3>
                              )}
                              {layout?.profileRole && (
                                <p className="text-sm text-zinc-700 font-serif">
                                  {layout.profileRole as string}
                                </p>
                              )}
                              {layout?.profileTitle && (
                                <p className="text-sm text-zinc-600 font-serif">
                                  {layout.profileTitle as string}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex h-full flex-col justify-between rounded-[2px] border border-[#cbb1a7ab] bg-[#fff6f1] px-4 py-4">
                        <div className="space-y-2">
                          {layout?.formIntro?.trim() && (
                            <div
                              className="text-sm text-zinc-800 font-serif leading-relaxed space-y-1.5"
                              dangerouslySetInnerHTML={{
                                __html: wrapLegalSignsHtml(layout.formIntro ?? ""),
                              }}
                            />
                          )}
                        </div>
                        <div className="mt-3 space-y-3">
                          <button
                            type="button"
                            onClick={
                              isLastStep ? handleFinalSubmitFromNextSteps : undefined
                            }
                            disabled={isSubmittingFinal}
                            className="inline-flex w-full items-center justify-center rounded-[2px] px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            style={
                              ctaBgColor
                                ? { backgroundColor: ctaBgColor }
                                : undefined
                            }
                          >
                            {isSubmittingFinal ? (
                              `Submitting${".".repeat(submittingDotCount)}`
                            ) : (
                              <span
                                dangerouslySetInnerHTML={{
                                  __html: wrapLegalSignsHtml(step.ctaText),
                                }}
                              />
                            )}
                          </button>
                          <SocialLinksBar
                            base={socialSourcePage.domain}
                            overrides={socialSourcePage.socialOverrides ?? null}
                            className="mt-1.5"
                          />
                          {isFinalSubmitted && mainPage.successMessage && (
                            <div
                              className="text-md text-emerald-800 font-serif text-center"
                              dangerouslySetInnerHTML={{
                                __html: wrapLegalSignsHtml(mainPage.successMessage),
                              }}
                            />
                          )}
                          {submitError && (
                            <p className="text-[14px] text-red-700 font-serif text-center">
                              {submitError}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : isDetailedPerspective ? (
              <div
                className="cust1 form-area relative w-full rounded-[2px] p-6 text-zinc-900 shadow-2xl bg-amber-50/95 opacity-95 border border-amber-200/60"
                style={formBgColor ? { backgroundColor: formBgColor } : undefined}
              >
                <div className="grid max-[768px]:grid-cols-1 md:grid-cols-[52%_45%] gap-[3%]">
                  <div className="space-y-5">
                    {formHeading && (
                      <h2
                        className="text-xl font-semibold text-zinc-800 font-serif leading-tight"
                        dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(formHeading) }}
                      />
                    )}
                    {layout?.formIntro?.trim() && (
                      <p
                        className="text-sm text-zinc-700 font-serif leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(layout.formIntro) }}
                      />
                    )}
                    {formSchema && formSchema.fields?.length > 0 && (
                      <>
                        <DynamicForm
                          key={step.slug || `step-${currentStep}`}
                          schema={formSchema}
                          ctaText={step.ctaText}
                          successMessage={mainPage.successMessage}
                          textSize={formTextSize}
                          ctaBgColor={ctaBgColor}
                          formStyle="detailed-perspective"
                          helperText={
                            layout?.formIntro?.trim()
                              ? undefined
                              : "This helps us ensure the data you receive is relevant to your situation."
                          }
                          postCtaText={layout?.formPostCtaText?.trim() || undefined}
                          extraHiddenFields={
                            isLastStep ? extraHiddenFieldsForSubmit : undefined
                          }
                          onNextStep={isLastStep ? undefined : handleNextStep}
                          ctaForwardingRules={
                            isLastStep ? stepCtaForwardingRules : undefined
                          }
                        />
                        <SocialLinksBar
                          base={socialSourcePage.domain}
                          overrides={socialSourcePage.socialOverrides ?? null}
                          className="mt-3"
                        />
                      </>
                    )}
                  </div>
                  <div className="space-y-4 relative flex flex-col justify-center">
                    <DetailedPerspectiveProfileColumn layout={layout} />
                  </div>
                </div>
                {layout?.formFooterText?.trim() && (
                  <div
                    className="mt-4 text-sm text-zinc-700 font-serif leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(layout.formFooterText) }}
                  />
                )}
              </div>
            ) : (
              <div
                className={`cust1 relative w-full rounded-[2px] p-5 text-zinc-900 shadow-2xl md:w-full md:p-6 ${
                  isQuestionnaire
                    ? "bg-amber-50/95 opacity-95 border border-amber-200/60"
                    : "bg-white/95 opacity-90"
                }`}
                style={formBgColor ? { backgroundColor: formBgColor } : undefined}
              >
                {formHeading && (
                  <h2
                    className="mb-4 text-base font-semibold border-b border-[#eadbd3] dot font-serif"
                    dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(formHeading) }}
                  />
                )}
                {formSchema && formSchema.fields?.length > 0 ? (
                  <>
                    <DynamicForm
                      key={step.slug || `step-${currentStep}`}
                      schema={formSchema}
                      ctaText={step.ctaText}
                      successMessage={mainPage.successMessage}
                      textSize={formTextSize}
                      ctaBgColor={ctaBgColor}
                      formStyle={isQuestionnaire ? "questionnaire" : "default"}
                      extraHiddenFields={
                        isLastStep ? extraHiddenFieldsForSubmit : undefined
                      }
                      onNextStep={isLastStep ? undefined : handleNextStep}
                      ctaForwardingRules={
                        isLastStep ? stepCtaForwardingRules : undefined
                      }
                    />
                    <SocialLinksBar
                      base={socialSourcePage.domain}
                      overrides={socialSourcePage.socialOverrides ?? null}
                      className="mt-3"
                    />
                  </>
                ) : !isLastStep ? (
                  <button
                    type="button"
                    onClick={() => handleNextStep({})}
                    disabled={isStepSubmitting}
                    className="inline-flex w-full items-center justify-center bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    style={ctaBgColor ? { backgroundColor: ctaBgColor } : undefined}
                  >
                    {isStepSubmitting ? (
                      `Submitting${".".repeat(submittingDotCount)}`
                    ) : (
                      <span
                        dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(step.ctaText) }}
                      />
                    )}
                  </button>
                ) : null}

                {layout?.formIntro?.trim() && (
                  <div
                    className={`mt-2 text-md text-zinc-500 space-y-2 font-serif text-center`}
                    dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(layout.formIntro) }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
