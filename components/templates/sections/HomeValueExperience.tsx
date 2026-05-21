"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Script from "next/script";
import { Search } from "lucide-react";
import type { LandingPageContent } from "@/lib/types/page";
import type { FormSchema } from "@/lib/types/form";
import type { CtaForwardingRule } from "@/lib/types/ctaForwarding";
import { wrapLegalSignsHtml } from "@/lib/richTextSigns";
import { DynamicForm } from "@/components/forms/DynamicForm";
import { SocialLinksBar } from "@/components/templates/SocialLinksBar";
import { HeroBackgroundImage } from "@/components/templates/HeroBackgroundImage";

type SearchState = "idle" | "found" | "error";

interface ZestimateResult {
  found: boolean;
  address: string;
  lat?: number | null;
  lng?: number | null;
  estimate?: number | null;
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;

interface HomeValueLayout {
  leftMainHtml?: string;
  formHeading?: string;
  formIntro?: string;
  formFooterText?: string;
  formBgColor?: string;
  ctaBgColor?: string;
  heroLowerStripHtml?: string;
}

interface HomeValueExperienceProps {
  page: LandingPageContent;
  layout?: HomeValueLayout | null;
  formSchema?: FormSchema | null;
  utmHiddenFields?: Record<string, string | undefined>;
  ctaForwardingRules?: CtaForwardingRule[];
}

export function HomeValueExperience({
  page,
  layout,
  formSchema,
  utmHiddenFields,
  ctaForwardingRules,
}: HomeValueExperienceProps) {
  const [address, setAddress] = useState("");
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [result, setResult] = useState<ZestimateResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [placesLoaded, setPlacesLoaded] = useState(false);
  const addressInputRef = useRef<HTMLInputElement | null>(null);

  const hasFoundProperty =
    searchState === "found" && !!result && !!result.lat && !!result.lng;

  // Initialize Google Places Autocomplete on the address input when the script is ready.
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

      setAddress(formatted);
      setResult({
        found: true,
        address: formatted,
        lat,
        lng,
        estimate: null,
      });
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

  return (
    <div className="relative min-h-screen text-zinc-50 bg-[#d4c8c8]">
      {MAPS_KEY && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`}
          strategy="afterInteractive"
          onLoad={() => setPlacesLoaded(true)}
        />
      )}

      {/* Hero background image with warm gradient overlay */}
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

      <div className="relative z-10 mx-auto flex flex-col px-4 pt-[120px] pb-8 min-[768px]:px-6 min-[768px]:pt-[140px] min-[768px]:pb-12 lg:px-8">
        {/* Hero copy + search bar */}
        <div className="mx-auto w-full max-w-6xl text-center min-h-0 max-[767px]:mb-6 min-[768px]:min-h-[min(100vh,660px)]">
          {hasHeroRichText ? (
            <div
              className="space-y-2 break-words text-amber-50"
              dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(layout!.leftMainHtml as string) }}
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
              <label
                htmlFor="home-value-experience-address"
                className="sr-only"
              >
                Property address
              </label>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-amber-200/80 ">
                <Search className="h-4 w-4 stroke-[#694636]" />
              </span>
              <input
                id="home-value-experience-address"
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
        {/* Main content: map + lead form (form first on small screens) */}
        <div className="mx-auto mt-6 grid max-w-6xl w-full grid-cols-1 gap-6 min-[768px]:mt-[-340px] min-[768px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] min-[768px]:items-start">
          {/* Map */}
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

          {/* Form card */}
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
                  <DynamicForm
                    schema={formSchema}
                    ctaText={page.ctaText}
                    successMessage={page.successMessage}
                    ctaForwardingRules={ctaForwardingRules}
                    ctaBgColor={layout?.ctaBgColor}
                    extraHiddenFields={{
                      domain: page.domain.hostname,
                      slug: page.slug,
                      type: "home-value",
                      searchedAddress: address.trim(),
                      resolvedAddress: result?.address ?? "",
                      estimate:
                        typeof result?.estimate === "number"
                          ? String(result.estimate)
                          : "",
                      latitude:
                        typeof result?.lat === "number"
                          ? String(result.lat)
                          : "",
                      longitude:
                        typeof result?.lng === "number"
                          ? String(result.lng)
                          : "",
                      ...(utmHiddenFields ?? {}),
                    }}
                  />
                ) : (
                  <p className="text-xs text-amber-800/80">
                    No form is configured for this page yet. Add fields in the
                    Form tab in admin.
                  </p>
                )}
                <SocialLinksBar
                  base={page.domain}
                  overrides={page.socialOverrides ?? null}
                />
                {hasFormIntro && (
                  <div
                    className="mt-2 text-xs text-zinc-800"
                    dangerouslySetInnerHTML={{
                      __html: wrapLegalSignsHtml(layout!.formIntro as string),
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

