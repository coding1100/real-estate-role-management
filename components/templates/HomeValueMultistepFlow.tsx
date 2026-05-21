"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Image from "next/image";
import Script from "next/script";
import { Search } from "lucide-react";
import type { LandingPageContent } from "@/lib/types/page";
import type { FormSchema } from "@/lib/types/form";
import type { CtaForwardingRule } from "@/lib/types/ctaForwarding";
import { wrapLegalSignsHtml } from "@/lib/richTextSigns";
import { DynamicForm } from "@/components/forms/DynamicForm";
import { useRecaptcha } from "@/components/forms/Captcha";
import { SocialLinksBar } from "@/components/templates/SocialLinksBar";
import { HeroBackgroundImage } from "@/components/templates/HeroBackgroundImage";
import { DetailedPerspectiveProfileColumn } from "@/components/templates/DetailedPerspectiveProfileColumn";
import { useToast } from "@/components/ui/use-toast";
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
  heroImageBrightness?: number;
}

type SearchState = "idle" | "found" | "error";

export interface ZestimateResult {
  found: boolean;
  address: string;
  lat?: number | null;
  lng?: number | null;
  estimate?: number | null;
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;

interface PropertyFindingStepProps {
  page: LandingPageContent;
  layout: {
    leftMainHtml?: string;
    formHeading?: string;
    formIntro?: string;
    formFooterText?: string;
    formBgColor?: string;
    ctaBgColor?: string;
    heroLowerStripHtml?: string;
  };
  formSchema: FormSchema | null;
  onNextStep: (
    values: Record<string, unknown>,
    context: { address: string; result: ZestimateResult | null },
  ) => void;
  initialAddress?: string;
  initialResult?: ZestimateResult | null;
  onContextChange?: (context: {
    address: string;
    result: ZestimateResult | null;
  }) => void;
}

export function PropertyFindingStep({
  page,
  layout,
  formSchema,
  onNextStep,
  initialAddress = "",
  initialResult = null,
  onContextChange,
}: PropertyFindingStepProps) {
  const [address, setAddress] = useState(initialAddress);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [result, setResult] = useState<ZestimateResult | null>(initialResult);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [placesLoaded, setPlacesLoaded] = useState(false);
  const addressInputRef = useRef<HTMLInputElement | null>(null);

  const hasFoundProperty =
    searchState === "found" && !!result && !!result.lat && !!result.lng;

  useEffect(() => {
    onContextChange?.({ address, result });
  }, [address, result, onContextChange]);

  useEffect(() => {
    if (!placesLoaded || !addressInputRef.current) return;
    const win = window as any;
    if (!win.google || !win.google.maps || !win.google.maps.places) return;

    const autocomplete = new win.google.maps.places.Autocomplete(
      addressInputRef.current,
      {
        types: ["address"],
        fields: ["formatted_address", "geometry"],
      },
    );

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const geometry = place?.geometry;
      const location = geometry?.location;

      if (!location) {
        setResult(null);
        setSearchState("error");
        setSearchError(
          "We couldn’t find this address. Please choose a suggestion or try again.",
        );
        return;
      }

      const formatted =
        place.formatted_address || addressInputRef.current?.value || "";
      const lat = location.lat();
      const lng = location.lng();

      const nextResult: ZestimateResult = {
        found: true,
        address: formatted,
        lat,
        lng,
        estimate: null,
      };

      setAddress(formatted);
      setResult(nextResult);
      setSearchState("found");
      setSearchError(null);
    });

    return () => {
      if (listener && typeof listener.remove === "function") {
        listener.remove();
      }
    };
  }, [placesLoaded]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearchError(null);
    const trimmed = address.trim();
    if (!trimmed) {
      setSearchError("Please enter a property address.");
      return;
    }
    if (!hasFoundProperty) {
      setSearchError("Please select an address from the suggestions above.");
      setSearchState("error");
    }
  }

  function getMapSrc() {
    if (!MAPS_KEY || !hasFoundProperty || !result?.lat || !result.lng) {
      return null;
    }
    const center = `${result.lat},${result.lng}`;
    const url = new URL("https://www.google.com/maps/embed/v1/place");
    url.searchParams.set("key", MAPS_KEY);
    url.searchParams.set("q", center);
    url.searchParams.set("zoom", "15");
    return url.toString();
  }

  const mapSrc = getMapSrc();
  const hasHeroRichText = !!layout?.leftMainHtml;
  const hasFormHeading = !!layout?.formHeading;
  const hasFormIntro = !!layout?.formIntro;
  const hasFooterText = !!layout?.formFooterText;
  const lowerStripHtml = layout?.heroLowerStripHtml;
  const formBgStyle = layout?.formBgColor
    ? { backgroundColor: layout.formBgColor }
    : undefined;

  const handleFormNextStep = (values: Record<string, unknown>) => {
    onNextStep(values, { address: address.trim(), result });
  };

  return (
    <div className="relative min-h-screen text-zinc-50 bg-[#d4c8c8]">
      {MAPS_KEY && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`}
          strategy="afterInteractive"
          onLoad={() => setPlacesLoaded(true)}
        />
      )}

      {page.heroImageUrl && (
        <div className="pointer-events-none inset-0 z-0 max-h-[42vh] min-[768px]:max-h-[500px]">
          <HeroBackgroundImage
            src={page.heroImageUrl}
            alt={page.headline}
            className="object-cover min-[768px]:!max-h-[800px]"
          />
          <div className="absolute inset-0 max-h-[50vh] min-[768px]:h-[800px]" />
        </div>
      )}

      <div className="relative z-10 mx-auto flex flex-col px-4 pb-8 pt-[120px] min-[768px]:px-6 min-[768px]:pb-12 min-[768px]:pt-[140px] lg:px-8">
        <div className="mx-auto w-full max-w-6xl text-center min-h-0 max-[767px]:mb-6 min-[768px]:min-h-[min(100vh,660px)]">
          {hasHeroRichText ? (
            <div
              className="space-y-2 break-words text-amber-50"
              dangerouslySetInnerHTML={{
                __html: wrapLegalSignsHtml(layout!.leftMainHtml as string),
              }}
            />
          ) : (
            <>
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-amber-50 sm:text-4xl md:text-5xl">
                {page.headline}
              </h1>
              {page.subheadline && (
                <p className="mt-3 text-sm text-amber-100/90 md:text-base">
                  {page.subheadline}
                </p>
              )}
            </>
          )}

          <form
            onSubmit={handleSearch}
            className="mt-6 flex flex-col items-stretch gap-2 min-[768px]:flex-row min-[768px]:items-center min-[768px]:gap-0"
          >
            <div className="relative min-w-0 flex-1 text-left">
              <label htmlFor="home-value-address" className="sr-only">
                Property address
              </label>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-amber-200/80 ">
                <Search className="h-4 w-4 stroke-[#694636]" />
              </span>
              <input
                id="home-value-address"
                type="text"
                ref={addressInputRef}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="61311 McRoberts Ln, Bend, OR 97702"
                className="h-[46px] w-full min-w-0 rounded-xl rounded-b-none py-2.5 pl-3 pr-9 text-base focus:outline-none focus:ring-0 shadow-sm placeholder:text-[#453D3D] text-[#453D3D] !bg-[#ebe4e2] min-[768px]:rounded-br-none min-[768px]:rounded-tr-none min-[768px]:rounded-tl-[5px] min-[768px]:rounded-bl-[5px] min-[768px]:text-md"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-[46px] w-full shrink-0 items-center justify-center rounded-xl rounded-t-none bg-[#5B4534] px-6 py-2.5 text-sm font-medium text-amber-50 shadow-md shadow-amber-900/40 transition disabled:cursor-not-allowed disabled:opacity-70 min-[768px]:w-auto min-[768px]:rounded-xl min-[768px]:rounded-tl-none min-[768px]:rounded-bl-none"
            >
              Next
            </button>
          </form>
          {searchError && (
            <p className="mt-2 text-xs text-[#453D3D]">{searchError}</p>
          )}
        </div>
        <div className="w-full bg-[#cdbfbc]">
          <div className="mx-auto flex min-h-[100px] max-w-6xl items-center px-4 py-6 min-[768px]:px-6 min-[768px]:py-9 lg:px-8">
            {lowerStripHtml ? (
              <div
                className="text-[13px] leading-snug text-[#433124]"
                dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(lowerStripHtml) }}
              />
            ) : (
              <p className="text-[13px] leading-snug text-[#433124]">
                Licensed Oregon Broker | Bend &amp; Tetherow Luxury Specialist
              </p>
            )}
          </div>
        </div>
        <div className="mx-auto mt-6 grid max-w-6xl w-full grid-cols-1 gap-6 min-[768px]:mt-[-340px] min-[768px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] min-[768px]:items-start">
          <div className="order-2 min-w-0 overflow-hidden rounded-2xl min-[768px]:order-1 min-[768px]:mt-[230px]">
            {mapSrc ? (
              <div className="relative aspect-[4/3] w-full min-h-[200px] min-[768px]:aspect-auto">
                <iframe
                  key={mapSrc}
                  title={result?.address || "Property map"}
                  src={mapSrc}
                  className="absolute inset-0 h-full w-full rounded-2xl border-0 min-[768px]:relative min-[768px]:h-[380px]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : hasFooterText ? (
              <div className="flex min-h-[220px] w-full flex-col items-center justify-center px-3 py-8 text-center md:min-h-[440px]">
                <div
                  className="max-w-lg text-sm text-amber-100/95"
                  dangerouslySetInnerHTML={{
                    __html: wrapLegalSignsHtml(layout!.formFooterText as string),
                  }}
                />
              </div>
            ) : (
              <div className="flex min-h-[220px] w-full flex-col items-center justify-center gap-3 px-4 py-8 text-center md:min-h-[340px] md:px-6">
                <p className="font-serif text-lg font-semibold text-amber-50">
                  Private. Confidential. No automated spam.
                </p>
                <p className="max-w-md text-sm text-amber-100/90">
                  Enter your property address above and we’ll pinpoint it on the
                  map, then prepare a bespoke valuation report just for you.
                </p>
              </div>
            )}
          </div>

          <div className="relative order-1 min-w-0 min-[768px]:order-2">
            <div
              className="w-full rounded-[2px] border border-amber-100/40 bg-amber-50/95 p-4 min-[768px]:p-5"
              style={formBgStyle}
            >
              {hasFormHeading ? (
                <div
                  className="font-serif text-lg font-semibold leading-tight text-amber-900"
                  dangerouslySetInnerHTML={{
                    __html: wrapLegalSignsHtml(layout!.formHeading as string),
                  }}
                />
              ) : (
                <h2 className="font-serif text-lg font-semibold leading-tight text-amber-900">
                  Property Located!
                </h2>
              )}

              <div className="mt-4">
                {formSchema && formSchema.fields?.length ? (
                  <>
                    <DynamicForm
                      schema={formSchema}
                      ctaText={page.ctaText}
                      successMessage={page.successMessage}
                      ctaBgColor={layout?.ctaBgColor}
                      onNextStep={handleFormNextStep}
                    />
                    <SocialLinksBar
                      base={page.domain}
                      overrides={page.socialOverrides ?? null}
                      className="mt-3"
                    />
                    {hasFormIntro && (
                      <div
                        className="mt-2 text-xs text-amber-800/80"
                        dangerouslySetInnerHTML={{
                          __html: wrapLegalSignsHtml(layout!.formIntro as string),
                        }}
                      />
                    )}
                  </>
                ) : (
                  <p className="text-xs text-amber-800/80">
                    No form is configured for this page yet. Add fields in the
                    Form tab in admin.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HomeValueMultistepFlowProps {
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

export function HomeValueMultistepFlow({
  mainPage,
  steps,
  layoutData,
  utmHiddenFields,
  ctaForwardingRules,
}: HomeValueMultistepFlowProps) {
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
  // Normalize steps list and drop any step whose slug matches the entry page
  // slug. This prevents an extra \"copy\" of the entry page from appearing
  // as an in-between step after the entry.
  const baseSteps = (Array.isArray(steps) ? steps : []).filter(
    (s) => (s.slug ?? "") !== (mainPage.slug ?? ""),
  );

  // Detect whether this entry page uses the special Home Value layout
  // (search bar + map + lower strip + right-hand form). For any such
  // page, we want the multistep entry (step 0) to look exactly like
  // the single-step UI.
  const entrySections = Array.isArray(mainPage.sections)
    ? mainPage.sections
    : [];
  const entryHeroSection = entrySections.find((s) => s.kind === "hero") as
    | { props?: any }
    | undefined;
  const entryLayoutProps = (entryHeroSection?.props || {}) as {
    heroLowerStripHtml?: string;
    formFooterText?: string;
    formStyle?: string;
  };
  const normalizedEntrySlug = String(mainPage.slug ?? "")
    .trim()
    .replace(/^\//, "")
    .toLowerCase();
  const isPropertyFinding = entryLayoutProps.formStyle === "property-finding";
  const isHomeValueStyleEntry =
    // Any page that explicitly selects the property-finding layout should
    // render the home-value style entry UI, regardless of its slug.
    isPropertyFinding ||
    // Back-compat: home-value family pages using the legacy lower strip / footer fields.
    (normalizedEntrySlug.startsWith("home-value") &&
      (!!entryLayoutProps.heroLowerStripHtml || !!entryLayoutProps.formFooterText));

  const useHomeValueEntryLayout = isHomeValueStyleEntry;

  const effectiveSteps = baseSteps;

  const totalSteps = useHomeValueEntryLayout
    ? 1 + effectiveSteps.length
    : effectiveSteps.length;
  if (!totalSteps) return null;

  const [currentStep, setCurrentStep] = useState(0);
  const [accumulatedData, setAccumulatedData] = useState<
    Record<string, Record<string, unknown>>
  >({});
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
  const [propertyFindingContext, setPropertyFindingContext] = useState<{
    address: string;
    result: ZestimateResult | null;
  }>({ address: "", result: null });
  const isOverallLastStep = currentStep === totalSteps - 1;

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
    const visibleStepSlug =
      useHomeValueEntryLayout && currentStep === 0
        ? String(mainPage.slug ?? "")
        : String(
            effectiveSteps[
              useHomeValueEntryLayout ? currentStep - 1 : currentStep
            ]?.slug ?? mainPage.slug ?? "",
          );
    const key = `${visibleStepSlug}:${currentStep}`;
    if (trackedStepViewKeys.current.has(key)) return;
    trackedStepViewKeys.current.add(key);
    trackDataLayerEvent("lead_step_view", {
      entry_slug: String(mainPage.slug ?? ""),
      step_slug: visibleStepSlug,
      step_index: currentStep + 1,
      is_last_step: isOverallLastStep,
      flow_type: "multistep",
      page_type: String(mainPage.type ?? ""),
      domain_host: String(mainPage.domain?.hostname ?? ""),
      cta_title: String(
        (useHomeValueEntryLayout && currentStep === 0
          ? mainPage.ctaText
          : effectiveSteps[
              useHomeValueEntryLayout ? currentStep - 1 : currentStep
            ]?.ctaText) ?? "",
      ),
    });
  }, [
    currentStep,
    effectiveSteps,
    isOverallLastStep,
    mainPage.ctaText,
    mainPage.domain?.hostname,
    mainPage.slug,
    mainPage.type,
    useHomeValueEntryLayout,
  ]);

  const handleNextStep = async (
    values: Record<string, unknown>,
    propertyContext?: { address: string; result: ZestimateResult | null },
  ) => {
      if (isStepSubmitting) return;
      setIsStepSubmitting(true);
      try {
      const stepForNotify: LandingPageContent =
        useHomeValueEntryLayout && currentStep === 0
          ? mainPage
          : (effectiveSteps[
              useHomeValueEntryLayout ? currentStep - 1 : currentStep
            ] ?? mainPage);

      const mergedValues: Record<string, unknown> = { ...values };
      if (propertyContext && useHomeValueEntryLayout && currentStep === 0) {
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
        stepForNotify.multistepNotifyEachStep === true && !isOverallLastStep;
      if (shouldNotify) {
        const result = await postMultistepStepNotify({
          getRecaptchaToken: () => execute("lead_step_notify"),
          mainPage,
          currentStepIndex: currentStep,
          accumulatedData,
          stepPage: stepForNotify,
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
        step_slug: String(stepForNotify.slug ?? mainPage.slug ?? ""),
        step_index: currentStep + 1,
        is_last_step: isOverallLastStep,
        flow_type: "multistep",
        page_type: String(mainPage.type ?? ""),
        domain_host: String(mainPage.domain?.hostname ?? ""),
        cta_title: String(stepForNotify.ctaText ?? ""),
      });
      setCurrentStep((i) => i + 1);
      } finally {
        setIsStepSubmitting(false);
      }
  };

  const extraHiddenFieldsForSubmit: Record<string, string> = {
    domain: mainPage.domain.hostname,
    slug: mainPage.slug,
    type: mainPage.type,
  };
  if (Object.keys(accumulatedData).length > 0) {
    extraHiddenFieldsForSubmit._multistepData = JSON.stringify(
      accumulatedData,
    );
  }
  if (fubPersonId) {
    extraHiddenFieldsForSubmit.fubPersonId = fubPersonId;
  }
  const trimmedAddress = propertyFindingContext.address.trim();
  if (trimmedAddress) {
    extraHiddenFieldsForSubmit.searchedAddress = trimmedAddress;
  }
  if (propertyFindingContext.result?.address) {
    extraHiddenFieldsForSubmit.resolvedAddress =
      propertyFindingContext.result.address;
  }
  if (typeof propertyFindingContext.result?.estimate === "number") {
    extraHiddenFieldsForSubmit.estimate = String(
      propertyFindingContext.result.estimate,
    );
  }
  if (typeof propertyFindingContext.result?.lat === "number") {
    extraHiddenFieldsForSubmit.latitude = String(
      propertyFindingContext.result.lat,
    );
  }
  if (typeof propertyFindingContext.result?.lng === "number") {
    extraHiddenFieldsForSubmit.longitude = String(
      propertyFindingContext.result.lng,
    );
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

  const handleFinalSubmitFromNextSteps = async () => {
    if (isSubmittingFinal) return;
    setIsSubmittingFinal(true);
    setSubmitError(null);
    try {
      const resolvedCtaText = step?.ctaText ?? mainPage.ctaText ?? "";
      const buildBody = (token: string | null): Record<string, unknown> => {
        const body: Record<string, unknown> = {
        domain: mainPage.domain.hostname,
        slug: mainPage.slug,
        type: mainPage.type,
        _ctaText: resolvedCtaText,
        _stepSlug: step?.slug ?? mainPage.slug,
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
        if (trimmedAddress) {
          body.searchedAddress = trimmedAddress;
        }
        if (propertyFindingContext.result?.address) {
          body.resolvedAddress = propertyFindingContext.result.address;
        }
        if (typeof propertyFindingContext.result?.estimate === "number") {
          body.estimate = String(propertyFindingContext.result.estimate);
        }
        if (typeof propertyFindingContext.result?.lat === "number") {
          body.latitude = String(propertyFindingContext.result.lat);
        }
        if (typeof propertyFindingContext.result?.lng === "number") {
          body.longitude = String(propertyFindingContext.result.lng);
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
          cta_title: String(step?.ctaText ?? mainPage.ctaText ?? ""),
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

  // STEP 0: Home Value-style entry UI (search + map), with CTA advancing to the next step.
  // Used for any entry page that uses the Home Value layout family (including
  // /home-value and pages derived from it). This keeps the multistep entry UI
  // visually identical to the single-step version.
  if (useHomeValueEntryLayout && currentStep === 0) {
    const heroSections = Array.isArray(mainPage.sections)
      ? mainPage.sections
      : [];
    const heroSection = heroSections.find((s) => s.kind === "hero");
    const layout = (heroSection?.props || {}) as {
      leftMainHtml?: string;
      formHeading?: string;
      formIntro?: string;
      formFooterText?: string;
      formBgColor?: string;
      ctaBgColor?: string;
      heroLowerStripHtml?: string;
    };
    const formSchema = (mainPage.formSchema as FormSchema) ?? null;

    return (
      <PropertyFindingStep
        page={mainPage}
        layout={layout}
        formSchema={formSchema}
        onNextStep={(values, context) => {
          setPropertyFindingContext(context);
          handleNextStep(values, context);
        }}
        initialAddress={propertyFindingContext.address}
        initialResult={propertyFindingContext.result}
        onContextChange={setPropertyFindingContext}
      />
    );
  }

  // Steps: generic multistep hero flow, reusing the existing layout patterns.
  // When useHomeValueEntryLayout is true, currentStep 1 maps to effectiveSteps[0];
  // when false, currentStep 0 maps to effectiveSteps[0] (no special entry step).
  const innerIndex = useHomeValueEntryLayout ? currentStep - 1 : currentStep;
  const step = effectiveSteps[innerIndex];
  extraHiddenFieldsForSubmit._stepSlug = step?.slug ?? mainPage.slug;
  const stepCtaForwardingRules = (() => {
    const stepRules = step ? readPageCtaRules(step) : [];
    return stepRules.length > 0 ? stepRules : (ctaForwardingRules ?? []);
  })();

  const stepLayoutData =
    (step.pageLayout?.layoutData as LayoutItem[] | undefined) ||
    (layoutData as LayoutItem[] | undefined) ||
    undefined;
  const heroSection = step.sections?.find(
    (s: { kind: string }) => s.kind === "hero",
  );
  const layout = (heroSection?.props as HeroLayoutConfig) || {};
  const formSchema = (step.formSchema as FormSchema) ?? null;
  const formHeading = layout?.formHeading?.trim() ?? "";
  const formBgColor = layout?.formBgColor;
  const formTextSize = layout?.formTextSize;
  const ctaBgColor = layout?.ctaBgColor;
  const isQuestionnaire = layout?.formStyle === "questionnaire";
  const isDetailedPerspective = layout?.formStyle === "detailed-perspective";
  const isNextSteps = layout?.formStyle === "next-steps";
  const isProfileOnlyNextSteps =
    isNextSteps &&
    ((((layout as any)?.nextStepsSecondOnly as boolean | undefined) === true) ||
      step.slug === "strategy-call");

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
    ? {
        display: "grid",
        gridTemplateColumns: "repeat(12, 1fr)",
        gap: "1.5rem 2rem",
        alignItems: "start" as const,
      }
    : undefined;
  const textContainerStyle =
    useSavedLayout && textLayout
      ? ({
          gridColumn: `${textLayout.x + 1} / span ${textLayout.w}`,
          gridRow: `${textLayout.y + 1} / span ${textLayout.h}`,
        } as const)
      : undefined;
  const formContainerStyle =
    useSavedLayout && formLayout
      ? ({
          gridColumn: `${formLayout.x + 1} / span ${formLayout.w}`,
          gridRow: `${formLayout.y + 1} / span ${formLayout.h}`,
        } as const)
      : undefined;
  const textContainerClass = useSavedLayout
    ? "relative mt-0 space-y-4 md:-mt-4 md:space-y-6 lg:-mt-[50px] content-area"
    : "relative col-span-12 mt-0 space-y-4 md:col-span-8 md:-mt-4 md:space-y-6 lg:-mt-[50px]";
  const formContainerClass = useSavedLayout
    ? "w-full md:w-auto form-area"
    : "col-span-12 w-full md:col-span-4 md:w-auto";

  const isLastStep = isOverallLastStep;

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
  const isTeamShowcaseStep = layout?.formStyle === "team-showcase";
  const heroBackgroundBrightness = normalizeBrightness(
    layout?.heroImageBrightness,
    isTeamShowcaseStep ? 0.58 : 0.65,
  );

  return (
    <section className="relative text-white min-h-[calc(100vh_-_85px)] pt-[120px] max-[768px]:pt-20">
      {(mainPage.heroImageUrl || step.heroImageUrl) && (
        <div className="pointer-events-none inset-0 fixed top-0 left-0 right-0 bottom-0">
          <HeroBackgroundImage
            src={(step.heroImageUrl || mainPage.heroImageUrl) as string}
            alt={step.headline}
            priority
            className="object-cover max-h-[1000px]"
            style={{ filter: `brightness(${heroBackgroundBrightness})` }}
          />
        </div>
      )}

      <div className="mx-auto flex h-full max-w-6xl flex-col justify-start gap-8 pt-[30px] px-4 pb-6 max-[768px]:px-4 md:gap-10 md:px-0 md:pb-8">
        <div className={gridWrapperClass} style={gridWrapperStyle}>
          <div className={textContainerClass} style={textContainerStyle}>
            <div>
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

                    <div className="mt-2 space-y-2">
                      <button
                        type="button"
                        disabled={isSubmittingFinal}
                        onClick={handleFinalSubmitFromNextSteps}
                        className="inline-flex w-full items-center justify-center rounded-[2px] bg-amber-800 px-4 py-2.5 text-sm font-semibold text-amber-50 shadow-md hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                        style={
                          ctaBgColor ? { backgroundColor: ctaBgColor } : undefined
                        }
                      >
                        {isSubmittingFinal ? (
                          `Submitting${".".repeat(submittingDotCount)}`
                        ) : (
                          <span
                            dangerouslySetInnerHTML={{
                              __html: wrapLegalSignsHtml(step.ctaText ?? mainPage.ctaText),
                            }}
                          />
                        )}
                      </button>
                      <SocialLinksBar
                        base={mainPage.domain}
                        overrides={mainPage.socialOverrides ?? null}
                        className="mt-1.5"
                      />
                      {layout?.formFooterText?.trim() && (
                        <div
                          className="text-xs text-zinc-700 font-serif leading-relaxed text-center"
                          dangerouslySetInnerHTML={{
                            __html: wrapLegalSignsHtml(layout.formFooterText ?? ""),
                          }}
                        />
                      )}
                      {submitError && (
                        <p className="text-xs text-red-600 text-center">
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
                        <div className="mt-3 space-y-2">
                          <button
                            type="button"
                            disabled={isSubmittingFinal}
                            onClick={handleFinalSubmitFromNextSteps}
                            className="inline-flex w-full items-center justify-center rounded-[2px] bg-amber-800 px-4 py-2.5 text-sm font-semibold text-amber-50 shadow-md hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                            style={
                              ctaBgColor ? { backgroundColor: ctaBgColor } : undefined
                            }
                          >
                            {isSubmittingFinal ? (
                              `Submitting${".".repeat(submittingDotCount)}`
                            ) : (
                              <span
                                dangerouslySetInnerHTML={{
                                  __html: wrapLegalSignsHtml(step.ctaText ?? mainPage.ctaText),
                                }}
                              />
                            )}
                          </button>
                          <SocialLinksBar
                            base={mainPage.domain}
                            overrides={mainPage.socialOverrides ?? null}
                            className="mt-1.5"
                          />
                          {layout?.formFooterText?.trim() && (
                            <div
                              className="text-xs text-zinc-700 font-serif leading-relaxed text-center"
                              dangerouslySetInnerHTML={{
                                __html: wrapLegalSignsHtml(layout.formFooterText ?? ""),
                              }}
                            />
                          )}
                          {submitError && (
                            <p className="text-xs text-red-600 text-center">
                              {submitError}
                            </p>
                          )}
                          
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : isDetailedPerspective && formSchema ? (
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
                    <>
                      <DynamicForm
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
                        postCtaText={
                          layout?.formPostCtaText?.trim() || undefined
                        }
                        extraHiddenFields={
                          isLastStep ? extraHiddenFieldsForSubmit : undefined
                        }
                        onNextStep={isLastStep ? undefined : handleNextStep}
                        skipValidationForNextStep={false}
                        ctaForwardingRules={
                          isLastStep ? stepCtaForwardingRules : undefined
                        }
                      />
                      <SocialLinksBar
                        base={mainPage.domain}
                        overrides={mainPage.socialOverrides ?? null}
                        className="mt-3"
                      />
                    </>
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
                      skipValidationForNextStep={false}
                      ctaForwardingRules={
                        isLastStep ? stepCtaForwardingRules : undefined
                      }
                    />
                    <SocialLinksBar
                      base={mainPage.domain}
                      overrides={mainPage.socialOverrides ?? null}
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
                        dangerouslySetInnerHTML={{
                          __html: wrapLegalSignsHtml(step.ctaText ?? mainPage.ctaText),
                        }}
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

