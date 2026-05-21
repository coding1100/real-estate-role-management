"use client";

import { useMemo, useState, useTransition, useRef } from "react";
import { HexAlphaColorField } from "@/components/admin/HexAlphaColorField";
import type {
  LandingPageContent,
  BlockConfig,
  HeroElementsByColumn,
} from "@/lib/types/page";
import type { FormSchema } from "@/lib/types/form";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { FormEditor } from "@/components/admin/FormEditor";
import { SeoEditor } from "@/components/admin/SeoEditor";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { CtaForwardingSettingsForm } from "@/components/admin/CtaForwardingSettingsForm";
import {
  PageToastSettingsForm,
  type PageToastThemeOverride,
} from "@/components/admin/PageToastSettingsForm";
import { PageBlockLayoutEditor } from "@/components/admin/craft/PageBlockLayoutEditor";
import { DragDropPageLayoutEditor } from "@/components/admin/DragDropPageLayoutEditor";
import { MultistepPageSelector } from "@/components/admin/MultistepPageSelector";
import {
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Globe2,
  ListChecks,
  Search,
  LayoutDashboard,
  Pencil,
  Check,
  Save,
  X,
} from "lucide-react";
import { useAdminToast } from "@/components/admin/useAdminToast";
import type { CtaForwardingRule } from "@/lib/types/ctaForwarding";
import { buildCustomerSiteUrl } from "@/lib/customerSiteUrl";

interface PageEditorProps {
  initialPage: LandingPageContent & {
    dbId: string;
    domainId: string;
    status?: string;
    multistepStepSlugs?: string[] | null;
    isFixedDefaultHomepage?: boolean;
    domainPages?: DomainPageOption[];
  };
  editorFonts?: { label: string; cssFamily: string }[];
  initialCtaForwardingRules?: CtaForwardingRule[];
  initialToastThemeOverride?: Record<string, unknown> | null;
}

type Tab = "content" | "form" | "seo" | "layout" | "cta";
type DomainPageOption = {
  id: string;
  slug: string;
  title: string;
  status?: string | null;
  hostname?: string;
};

function SearchablePageSelector({
  options,
  onSelect,
  placeholder = "Search pages by title, slug, or domain...",
  className = "",
}: {
  options: DomainPageOption[];
  onSelect: (slug: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((p) =>
      `${p.title} ${p.slug} ${p.hostname ?? ""}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <div
      className={`relative w-full min-w-[260px] ${className}`}
      onBlur={(e) => {
        const next = e.relatedTarget;
        if (next && e.currentTarget.contains(next as Node)) return;
        setOpen(false);
      }}
    >
      <input
        className="w-full !rounded-md border border-zinc-300 pl-8 pr-2 py-1.5 text-sm"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-zinc-400" />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto !rounded-md border border-zinc-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-xs text-zinc-500">No pages found.</p>
          ) : (
            filtered.map((p) => (
              <button
                key={`search-page-${p.id}`}
                type="button"
                className="block w-full border-b border-zinc-100 px-2 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 last:border-b-0"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(p.slug);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {p.title} ({p.slug})
                {p.hostname ? ` - ${p.hostname}` : ""}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function deriveSlugFromCanonicalUrl(canonicalUrl: string): string | null {
  const raw = canonicalUrl.trim();
  if (!raw) return null;

  let pathname = "";
  try {
    if (raw.startsWith("/")) {
      pathname = raw;
    } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
      pathname = new URL(raw).pathname;
    } else {
      pathname = new URL(`https://${raw}`).pathname;
    }
  } catch {
    return null;
  }

  const normalized = pathname
    .trim()
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();

  return normalized.length > 0 ? normalized : null;
}

export function PageEditor({
  initialPage,
  editorFonts,
  initialCtaForwardingRules = [],
  initialToastThemeOverride = null,
}: PageEditorProps) {
  const [tab, setTab] = useState<Tab>("content");
  const [page, setPage] = useState(initialPage);
  const [status, setStatus] = useState<string>(initialPage.status ?? "draft");
  const [multistepStepSlugs, setMultistepStepSlugs] = useState<string[]>(
    Array.isArray(initialPage.multistepStepSlugs) ? initialPage.multistepStepSlugs : [],
  );
  const [multistepNotifyEachStep, setMultistepNotifyEachStep] = useState(
    Boolean((initialPage as { multistepNotifyEachStep?: boolean }).multistepNotifyEachStep),
  );
  const [pageMode, setPageMode] = useState<"single" | "multistep">(
    Array.isArray(initialPage.multistepStepSlugs) &&
      initialPage.multistepStepSlugs.length > 0
      ? "multistep"
      : "single",
  );
  const [formSchema, setFormSchema] = useState<FormSchema | null>(
    (initialPage.formSchema as any) ?? { fields: [] },
  );
  const [socialOverrides, setSocialOverrides] = useState<
    LandingPageContent["socialOverrides"]
  >((initialPage as any).socialOverrides ?? null);
  const [ctaForwardingRules, setCtaForwardingRules] = useState<CtaForwardingRule[]>(
    initialCtaForwardingRules,
  );
  const [pageToastThemeOverride, setPageToastThemeOverride] = useState<
    PageToastThemeOverride | null
  >(initialToastThemeOverride as PageToastThemeOverride | null);
  const [saving, startSaving] = useTransition();
  const [activeSaveAction, setActiveSaveAction] = useState<
    "save-draft" | "unpublish" | "publish" | null
  >(null);
  const isFixedDefaultHomepage = initialPage.isFixedDefaultHomepage === true;
  const effectivePageMode: "single" | "multistep" = isFixedDefaultHomepage
    ? "single"
    : pageMode;
  const [message, setMessage] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(
    ((initialPage as { title?: string | null }).title || initialPage.headline || "").trim(),
  );
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const layoutGetBlocksRef = useRef<(() => BlockConfig[]) | null>(null);
  const layoutGetHeroElementsRef =
    useRef<(() => HeroElementsByColumn | null) | null>(null);
  const layoutGetLayoutRef = useRef<(() => any[]) | null>(null);
  const { success: successToast, error: errorToast } = useAdminToast();
  const heroSections = Array.isArray(page.sections) ? page.sections : [];
  const heroSection = heroSections.find((s) => s.kind === "hero") || null;
  const heroLayout = (heroSection?.props as any) || {};
  type HomeNavItem = {
    label?: string;
    href?: string;
    megaMenuColumns?: Array<{
      title?: string;
      links?: Array<{ label?: string; href?: string }>;
    }>;
  };
  const rawHomeNavLinks = Array.isArray((heroLayout as any).homeNavLinks)
    ? ((heroLayout as any).homeNavLinks as HomeNavItem[])
    : [];
  const legacyHomeMegaColumns = Array.isArray((heroLayout as any).homeMegaMenuColumns)
    ? ((heroLayout as any).homeMegaMenuColumns as Array<{
        title?: string;
        links?: Array<{ label?: string; href?: string }>;
      }>)
    : [];
  const homeNavLinks: HomeNavItem[] = rawHomeNavLinks.map((item, idx) => ({
    ...item,
    megaMenuColumns:
      Array.isArray(item.megaMenuColumns) && item.megaMenuColumns.length > 0
        ? item.megaMenuColumns
        : idx === 0 && legacyHomeMegaColumns.length > 0
          ? legacyHomeMegaColumns
          : [],
  }));
  const domainPageOptions = Array.isArray((initialPage as any).domainPages)
    ? ((initialPage as any).domainPages as DomainPageOption[])
    : [];

  const blockquoteStyle = (heroLayout.blockquoteStyle || {}) as {
    bg?: string;
    border?: string;
  };

  const adminBlockquoteVars =
    blockquoteStyle && (blockquoteStyle.bg || blockquoteStyle.border)
      ? ({
          ["--blockquote-bg" as any]: blockquoteStyle.bg,
          ["--blockquote-border" as any]: blockquoteStyle.border,
        } as React.CSSProperties)
      : undefined;
  const currentTitle =
    ((page as { title?: string | null }).title || page.headline || "").trim() || "—";

  function updateBlockquoteStyle(patch: Partial<typeof blockquoteStyle>) {
    const next = {
      bg: (patch.bg ?? blockquoteStyle.bg ?? "").trim(),
      border: (patch.border ?? blockquoteStyle.border ?? "").trim(),
    };
    const cleaned = {
      bg: next.bg.length > 0 ? next.bg : undefined,
      border: next.border.length > 0 ? next.border : undefined,
    };
    const hasAny = !!(cleaned.bg || cleaned.border);
    updateHeroLayout({
      blockquoteStyle: hasAny ? cleaned : undefined,
    });
  }

  // Treat the dedicated /home-value entry page and any pages derived from it
  // (e.g. /home-value-copy, /home-value-qualify) as part of the Home Value family.
  // Also treat multistep entries whose first step is "home-value" (e.g. duplicated
  // page with a custom slug). These pages must not show the Layout tab.
  const normalizedSlug = (page.slug ?? "")
    .trim()
    .replace(/^\//, "")
    .toLowerCase();
  const slugIsHomeValueFamily =
    normalizedSlug === "home-value" || normalizedSlug.startsWith("home-value");
  const firstStepIsHomeValue =
    Array.isArray(multistepStepSlugs) &&
    typeof multistepStepSlugs[0] === "string" &&
    multistepStepSlugs[0].toLowerCase() === "home-value";
  // Explicit exceptions: these slugs are independent funnels and should
  // behave like normal pages even though they contain 'home-value' in the slug.
  const isHomeValueException =
    normalizedSlug === "home-value(questionnaire)" ||
    normalizedSlug === "home-value(thankyou-strategy-call)";
  const isPropertyFindingLayout =
    (heroLayout.formStyle as string) === "property-finding";
  const isHomeValueFamily =
    !isHomeValueException && (slugIsHomeValueFamily || firstStepIsHomeValue);
  const hideLayoutTab =
    isHomeValueFamily || isPropertyFindingLayout || isFixedDefaultHomepage;

  const layoutData = page.pageLayout?.layoutData as any[] | undefined;
  const savedLayout =
    layoutData && layoutData.length > 0
      ? {
        header: layoutData.find((l: any) => l.i === "header-bar"),
        text: layoutData.find((l: any) => l.i === "text-container"),
        form: layoutData.find((l: any) => l.i === "form-container"),
        footer: layoutData.find((l: any) => l.i === "footer-bar"),
      }
      : undefined;



  function update<K extends keyof LandingPageContent>(
    key: K,
    value: LandingPageContent[K],
  ) {
    setPage((prev) => ({ ...prev, [key]: value }));
  }

  function updateHeroLayout(patch: Record<string, unknown>) {
    setPage((prev) => {
      const sections = Array.isArray(prev.sections) ? [...prev.sections] : [];
      const idx = sections.findIndex((s) => s.kind === "hero");
      if (idx === -1) {
        sections.push({
          id: "hero",
          kind: "hero",
          props: { ...patch },
        } as any);
      } else {
        const existing = sections[idx];
        sections[idx] = {
          ...existing,
          props: { ...(existing.props || {}), ...patch },
        } as any;
      }
      return { ...prev, sections };
    });
  }

  async function save(
    nextStatus?: "draft" | "published",
    action: "save-draft" | "unpublish" | "publish" = "save-draft",
  ) {
    if (saving) return;
    setMessage(null);
    setActiveSaveAction(action);
    startSaving(async () => {
      try {
        const normalizedTitle = titleDraft.trim();
        const effectiveTitle =
          normalizedTitle.length > 0
            ? normalizedTitle
            : ((page as any).title ?? page.headline ?? "").trim();
      let sections = page.sections;
      const blocks =
        tab === "layout" && layoutGetBlocksRef.current
          ? layoutGetBlocksRef.current()
          : page.blocks;
      if (tab === "layout" && layoutGetBlocksRef.current) {
        setPage((prev) => ({ ...prev, blocks }));
      }
      if (tab === "layout" && layoutGetHeroElementsRef.current) {
        const heroElements = layoutGetHeroElementsRef.current();
        if (heroElements && Array.isArray(sections)) {
          sections = sections.map((s) =>
            s.kind === "hero"
              ? {
                ...s,
                props: {
                  ...(s.props || {}),
                  heroElements,
                },
              }
              : s,
          );
        }
      }
        // Always persist the latest CTA rules + local toast override into hero
        // props so publish/save never overwrites CTA/Toast edits with stale sections.
        if (Array.isArray(sections)) {
          const heroIndex = sections.findIndex((s) => s?.kind === "hero");
          if (heroIndex >= 0) {
            const heroSection = sections[heroIndex] as any;
            sections = sections.map((s, idx) =>
              idx === heroIndex
                ? {
                    ...heroSection,
                    props: {
                      ...(heroSection?.props || {}),
                      ctaForwardingRules,
                      ...(pageToastThemeOverride
                        ? { toastThemeOverride: pageToastThemeOverride }
                        : { toastThemeOverride: undefined }),
                    },
                  }
                : s,
            );
          } else {
            sections = [
              ...sections,
              {
                id: "hero",
                kind: "hero",
                props: {
                  ctaForwardingRules,
                  ...(pageToastThemeOverride
                    ? { toastThemeOverride: pageToastThemeOverride }
                    : {}),
                },
              } as any,
            ];
          }
        }
      const body: any = {
          title: effectiveTitle.length > 0 ? effectiveTitle : null,
          headline: effectiveTitle.length > 0 ? effectiveTitle : page.headline,
        subheadline: page.subheadline,
        heroImageUrl: page.heroImageUrl,
        ctaText: page.ctaText,
        successMessage: page.successMessage,
        footerHtml: (page as any).footerHtml ?? null,
        sections,
        blocks,
        formSchema,
        socialOverrides,
        seoTitle: page.seo.title,
        seoDescription: page.seo.description,
        canonicalUrl: page.seo.canonicalUrl,
        noIndex: page.seo.noIndex,
          // Keep CTA rules as a top-level patch field as well, so the API
          // normalizer always runs and persists deliveryMode reliably.
          ctaForwardingRules,
      };
      body.multistepStepSlugs =
          effectivePageMode === "multistep" && multistepStepSlugs.length > 0
          ? multistepStepSlugs
          : null;
      body.multistepNotifyEachStep = multistepNotifyEachStep;

      const getLayout = layoutGetLayoutRef.current;
        if (!isFixedDefaultHomepage && getLayout) {
        const raw = getLayout();
        if (Array.isArray(raw) && raw.length > 0) {
          body.layoutData = raw.map((item: { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number; static?: boolean; hidden?: boolean }) => ({
            i: item.i,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
            ...(item.minW != null && { minW: item.minW }),
            ...(item.minH != null && { minH: item.minH }),
            ...(item.static != null && { static: item.static }),
            ...(item.hidden === true && { hidden: true }),
          }));
        }
      }
        if (nextStatus) {
          body.status = nextStatus;
      }
      const res = await fetch(`/api/admin/pages/${initialPage.dbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
          const data = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          const errorMessage =
            (data && typeof data.error === "string" && data.error) ||
            "Failed to save";
          setMessage(errorMessage);
          errorToast(errorMessage, "Unable to save page");
        return;
      }
      // Keep local page state in sync with what we just saved so
      // switching tabs does not resurrect older data.
      setPage((prev) => ({
        ...prev,
          title: body.title,
          headline: body.headline,
        sections,
        blocks,
        formSchema,
        socialOverrides,
        multistepNotifyEachStep: body.multistepNotifyEachStep,
        ...(body.layoutData
          ? {
            pageLayout: {
              ...(prev.pageLayout ?? {}),
              layoutData: body.layoutData,
            } as any,
          }
          : {}),
      }));
        // Save buttons also commit pending title edits (without requiring check icon).
        setIsEditingTitle(false);
        setTitleDraft(body.title ?? body.headline ?? "");
        const isPublishing = nextStatus === "published";
        const isUnpublishing = nextStatus === "draft";
        if (nextStatus) {
          setStatus(nextStatus);
        }
        setMessage(
          isPublishing ? "Published" : isUnpublishing ? "Unpublished" : "Saved",
        );
      successToast(
          isPublishing
            ? "Page published."
            : isUnpublishing
              ? "Page moved to draft."
              : "Draft saved.",
          isPublishing ? "Published" : isUnpublishing ? "Unpublished" : "Saved",
      );

      // Refresh preview iframe so changes are visible - with cache busting
      setTimeout(() => {
        const iframe = document.getElementById(
          "page-preview",
        ) as HTMLIFrameElement | null;
        if (iframe) {
          // Add timestamp to force fresh fetch
            iframe.src = `/${encodeURIComponent(page.slug)}?preview=1&domain=${encodeURIComponent(page.domain.hostname)}&t=${Date.now()}`;
        }
      }, 100);
      } finally {
        setActiveSaveAction(null);
      }
    });
  }

  return (
    <div
      className={`space-y-4 custom ${isFixedDefaultHomepage ? "default-homepage" : ""}`}
      style={adminBlockquoteVars}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Edit page
          </h1>
          <p className="text-xl text-zinc-600">
            <span className="font-medium text-zinc-800">Title:</span>{" "}
            {isEditingTitle ? (
              <span className="inline-flex items-center gap-2 align-middle">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className="w-[340px] !rounded-md border border-zinc-300 bg-white px-2 py-1 text-base text-zinc-800"
                  placeholder="Enter page title"
                />
                <button
                  type="button"
                  title="Apply title"
                  onClick={() => {
                    const nextTitle = titleDraft.trim();
                    if (!nextTitle) return;
                    update("title" as any, nextTitle as any);
                    update("headline", nextTitle as any);
                    setIsEditingTitle(false);
                  }}
                  className="inline-flex items-center !rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-50"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Cancel title edit"
                  onClick={() => {
                    setTitleDraft(currentTitle === "—" ? "" : currentTitle);
                    setIsEditingTitle(false);
                  }}
                  className="inline-flex items-center !rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 align-middle">
                <span>{currentTitle}</span>
                <button
                  type="button"
                  title="Edit title"
                  onClick={() => {
                    setTitleDraft(currentTitle === "—" ? "" : currentTitle);
                    setIsEditingTitle(true);
                  }}
                  className="inline-flex items-center !rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </span>
            )}{" "}
            <span className="capitalize">({page.type})</span>
          </p>
          {/* <p className="text-sm text-zinc-500">
            <span className="font-medium text-zinc-700">{page.slug}</span>
            <span className="px-1">·</span>
            {page.domain.hostname}
            <span className="px-1">·</span>
            <span className="capitalize">{page.type}</span>
          </p> */}
        </div>
        <div className="flex items-center gap-3 max-[768px]:flex-col max-[768px]:items-stretch">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status === "published"
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
              : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
              }`}
          >
            {status === "published" ? "Published" : "Draft"}
          </span>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                const q = new URLSearchParams({
                  preview: "1",
                  domain: page.domain.hostname,
                });
                window.open(
                  `/${encodeURIComponent(page.slug)}?${q.toString()}`,
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
              className="inline-flex items-center gap-1.5 !rounded-md border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              <Eye className="h-3.5 w-3.5" />
              View draft
            </button>
            <button
              type="button"
              disabled={status !== "published"}
              title={
                status === "published"
                  ? "Open the published page on the customer domain"
                  : "Publish the page to open the live URL on the customer domain"
              }
              onClick={() => {
                if (status !== "published") return;
                window.open(
                  buildCustomerSiteUrl(
                    page.domain.hostname,
                    `/${encodeURIComponent(page.slug)}`,
                  ),
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
              className="inline-flex items-center gap-1.5 !rounded-md border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View live
            </button>
            <button
              type="button"
              onClick={() => save(undefined, "save-draft")}
              disabled={saving && activeSaveAction === "save-draft"}
              className="inline-flex items-center gap-1.5 !rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {saving && activeSaveAction === "save-draft" ? "Saving..." : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => save("draft", "unpublish")}
              disabled={(saving && activeSaveAction === "unpublish") || status !== "published" || isFixedDefaultHomepage}
              title={
                isFixedDefaultHomepage
                  ? "This fixed default homepage cannot be unpublished."
                  : status !== "published"
                    ? "Page is already draft."
                    : "Move this page from published to draft"
              }
              className="inline-flex items-center gap-1.5 !rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 shadow-sm hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <EyeOff className="h-3.5 w-3.5" />
              {saving && activeSaveAction === "unpublish" ? "Unpublishing..." : "Unpublish"}
            </button>
            <button
              type="button"
              onClick={() => save("published", "publish")}
              disabled={saving && activeSaveAction === "publish"}
              className="inline-flex items-center gap-1.5 !rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
            >
              <Globe2 className="h-3.5 w-3.5" />
              {saving && activeSaveAction === "publish" ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
      </div>
      {/* {message && (
        <p className="text-sm text-emerald-700">
          {message}
        </p>
      )} */}
      {!isFixedDefaultHomepage && (
      <div className="!rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 default-homepage">
          Page mode
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Choose whether this is a normal single-step landing page or a multistep
          entry page that chains together other slugs.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="page-mode"
              className="h-3.5 w-3.5 border border-zinc-400 text-zinc-900 focus:ring-zinc-900"
              checked={effectivePageMode === "single"}
              onChange={() => setPageMode("single")}
            />
            <span className="font-medium">Single form page</span>
            <span className="text-xs text-zinc-500">
              Edit content, form, SEO, and layout as usual.
            </span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="page-mode"
              className="h-3.5 w-3.5 border border-zinc-400 text-zinc-900 focus:ring-zinc-900"
              checked={effectivePageMode === "multistep"}
              onChange={() => {
                setPageMode("multistep");
                setTab("content");
              }}
            />
            <span className="font-medium">Multistep form page</span>
            <span className="text-xs text-zinc-500">
              Only configure the step slugs. Other settings are controlled by the
              first step page.
            </span>
          </label>
        </div>
      </div>
      )}
      {isFixedDefaultHomepage && (
        <div className="!rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          This page is configured as the domain default homepage. Layout changes and
          deletion are locked, but content remains editable.
        </div>
      )}
      <div className="border-b border-zinc-200 max-[768px]:overflow-x-auto max-[768px]:pb-1">
        <nav className="flex gap-4 text-sm font-medium text-zinc-600">
          {(isFixedDefaultHomepage
            ? (["content", "cta", "seo"] as Tab[])
            : hideLayoutTab
              ? (["content", "cta", "form", "seo"] as Tab[])
              : (["content", "cta", "form", "seo", "layout"] as Tab[])
          ).map((t) => {
            const isActive = tab === t;
            const Icon =
              t === "content"
                ? FileText
                : t === "form"
                  ? ListChecks
                  : t === "seo"
                    ? Search
                  : t === "cta"
                    ? ExternalLink
                    : LayoutDashboard;
            const label =
              t === "content"
                ? "Content"
                : t === "form"
                  ? "Form"
                  : t === "seo"
                    ? "SEO"
                    : t === "cta"
                      ? "CTA Management"
                    : "Layout";
            const disabledInMultistep =
              effectivePageMode === "multistep" && t !== "content" && t !== "cta";
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  if (disabledInMultistep) return;
                  setTab(t);
                }}
                aria-disabled={disabledInMultistep}
                className={`inline-flex items-center gap-1.5 border-b-2 px-1 pb-2 pt-1 transition-colors ${isActive
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                  } ${disabledInMultistep
                    ? "cursor-not-allowed opacity-40 hover:text-zinc-500"
                    : ""
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="grid gap-6 col-span-1">
        <div className="space-y-4">
          {tab === "content" && (
            <div className="space-y-4">
              {effectivePageMode === "single" ? (
                <>
                  <div className="grid gap-4 md:grid-cols-1">
                    {isFixedDefaultHomepage && (
                      <div className="space-y-4 !rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                          Default homepage settings
                        </p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <div className="mb-2 flex items-center justify-between">
                              <label className="block text-sm font-medium text-zinc-700">
                                Navigation links
                              </label>
                              <button
                                type="button"
                                className="!rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                                onClick={() =>
                                  updateHeroLayout({
                                    homeNavLinks: [
                                      ...homeNavLinks,
                                      { label: "", href: "" },
                                    ],
                                  })
                                }
                              >
                                + Add link
                              </button>
                            </div>
                            <div className="space-y-2">
                              {homeNavLinks.map((item, idx) => (
                                <div key={`home-nav-${idx}`} className="flex gap-2">
                                  <input
                                    className="col-span-4 flex-1 !rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                                    placeholder="Label"
                                    value={item.label ?? ""}
                                    onChange={(e) => {
                                      const next = [...homeNavLinks];
                                      next[idx] = { ...next[idx], label: e.target.value };
                                      updateHeroLayout({ homeNavLinks: next });
                                    }}
                                  />
                                  <input
                                    className="col-span-7 flex-1 !rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                                    placeholder="/path or https://..."
                                    value={item.href ?? ""}
                                    onChange={(e) => {
                                      const next = [...homeNavLinks];
                                      next[idx] = { ...next[idx], href: e.target.value };
                                      updateHeroLayout({ homeNavLinks: next });
                                    }}
                                  />
                                  <SearchablePageSelector
                                    options={domainPageOptions}
                                    className="flex-[2]"
                                    onSelect={(selectedSlug) => {
                                      const next = [...homeNavLinks];
                                      next[idx] = { ...next[idx], href: `/${selectedSlug}` };
                                      updateHeroLayout({ homeNavLinks: next });
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="col-span-1 !rounded-md w-[50px] border border-zinc-300 px-1 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                                    onClick={() => {
                                      const next = homeNavLinks.filter((_, i) => i !== idx);
                                      updateHeroLayout({ homeNavLinks: next });
                                    }}
                                  >
                                    x
                                  </button>
                                </div>
                              ))}
                              {homeNavLinks.length === 0 && (
                                <p className="text-xs text-zinc-500">
                                  No links yet. Add links for top navigation.
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <div className="space-y-3">
                              <label className="block text-sm font-medium text-zinc-700">
                                Mega menu linked to navigation
                              </label>
                              {homeNavLinks.map((navItem, navIdx) => {
                                const megaColumns = Array.isArray(navItem.megaMenuColumns)
                                  ? navItem.megaMenuColumns
                                  : [];
                                return (
                                  <div
                                    key={`nav-mega-${navIdx}`}
                                    className="!rounded-md border border-zinc-200 bg-zinc-50 p-3"
                                  >
                                    <div className="mb-2 flex items-center justify-between">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                                        {navItem.label?.trim() || `Navigation ${navIdx + 1}`}
                                      </p>
                                      <button
                                        type="button"
                                        className="!rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                                        onClick={() => {
                                          const next = [...homeNavLinks];
                                          const current = Array.isArray(next[navIdx].megaMenuColumns)
                                            ? [...(next[navIdx].megaMenuColumns as any[])]
                                            : [];
                                          current.push({ title: "", links: [] });
                                          next[navIdx] = {
                                            ...next[navIdx],
                                            megaMenuColumns: current,
                                          };
                                          updateHeroLayout({
                                            homeNavLinks: next,
                                            homeMegaMenuColumns: undefined,
                                          });
                                        }}
                                      >
                                        + Add column for this nav
                                      </button>
                                    </div>
                                    <div className="space-y-3">
                                      {megaColumns.map((column, colIdx) => (
                                        <div
                                          key={`nav-${navIdx}-mega-${colIdx}`}
                                          className="!rounded-md border border-zinc-200 bg-white p-3"
                                        >
                                          <div className="mb-2 flex gap-2">
                                            <input
                                              className="col-span-10 flex-1 !rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                                              placeholder="Column title"
                                              value={column.title ?? ""}
                                              onChange={(e) => {
                                                const next = [...homeNavLinks];
                                                const current = Array.isArray(next[navIdx].megaMenuColumns)
                                                  ? [...(next[navIdx].megaMenuColumns as any[])]
                                                  : [];
                                                current[colIdx] = {
                                                  ...current[colIdx],
                                                  title: e.target.value,
                                                };
                                                next[navIdx] = {
                                                  ...next[navIdx],
                                                  megaMenuColumns: current,
                                                };
                                                updateHeroLayout({
                                                  homeNavLinks: next,
                                                  homeMegaMenuColumns: undefined,
                                                });
                                              }}
                                            />
                                            <button
                                              type="button"
                                              className="col-span-2 !rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                                              onClick={() => {
                                                const next = [...homeNavLinks];
                                                const current = Array.isArray(next[navIdx].megaMenuColumns)
                                                  ? (next[navIdx].megaMenuColumns as any[]).filter(
                                                      (_: unknown, i: number) => i !== colIdx,
                                                    )
                                                  : [];
                                                next[navIdx] = {
                                                  ...next[navIdx],
                                                  megaMenuColumns: current,
                                                };
                                                updateHeroLayout({
                                                  homeNavLinks: next,
                                                  homeMegaMenuColumns: undefined,
                                                });
                                              }}
                                            >
                                              Remove
                                            </button>
                                          </div>
                                          <div className="space-y-2">
                                            {(Array.isArray(column.links) ? column.links : []).map(
                                              (link, linkIdx) => (
                                                <div
                                                  key={`nav-${navIdx}-col-${colIdx}-item-${linkIdx}`}
                                                  className="flex gap-2"
                                                >
                                                  <input
                                                    className="col-span-4 flex-1 !rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                                                    placeholder="Label"
                                                    value={link.label ?? ""}
                                                    onChange={(e) => {
                                                      const next = [...homeNavLinks];
                                                      const current = Array.isArray(next[navIdx].megaMenuColumns)
                                                        ? [...(next[navIdx].megaMenuColumns as any[])]
                                                        : [];
                                                      const links = Array.isArray(current[colIdx]?.links)
                                                        ? [...(current[colIdx].links as any[])]
                                                        : [];
                                                      links[linkIdx] = {
                                                        ...links[linkIdx],
                                                        label: e.target.value,
                                                      };
                                                      current[colIdx] = {
                                                        ...current[colIdx],
                                                        links,
                                                      };
                                                      next[navIdx] = {
                                                        ...next[navIdx],
                                                        megaMenuColumns: current,
                                                      };
                                                      updateHeroLayout({
                                                        homeNavLinks: next,
                                                        homeMegaMenuColumns: undefined,
                                                      });
                                                    }}
                                                  />
                                                  <input
                                                    className="col-span-7 flex-1 !rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                                                    placeholder="/path or https://..."
                                                    value={link.href ?? ""}
                                                    onChange={(e) => {
                                                      const next = [...homeNavLinks];
                                                      const current = Array.isArray(next[navIdx].megaMenuColumns)
                                                        ? [...(next[navIdx].megaMenuColumns as any[])]
                                                        : [];
                                                      const links = Array.isArray(current[colIdx]?.links)
                                                        ? [...(current[colIdx].links as any[])]
                                                        : [];
                                                      links[linkIdx] = {
                                                        ...links[linkIdx],
                                                        href: e.target.value,
                                                      };
                                                      current[colIdx] = {
                                                        ...current[colIdx],
                                                        links,
                                                      };
                                                      next[navIdx] = {
                                                        ...next[navIdx],
                                                        megaMenuColumns: current,
                                                      };
                                                      updateHeroLayout({
                                                        homeNavLinks: next,
                                                        homeMegaMenuColumns: undefined,
                                                      });
                                                    }}
                                                  />
                                                  <SearchablePageSelector
                                                    options={domainPageOptions}
                                                    className="flex-[2]"
                                                    onSelect={(selectedSlug) => {
                                                      const next = [...homeNavLinks];
                                                      const current = Array.isArray(next[navIdx].megaMenuColumns)
                                                        ? [...(next[navIdx].megaMenuColumns as any[])]
                                                        : [];
                                                      const links = Array.isArray(current[colIdx]?.links)
                                                        ? [...(current[colIdx].links as any[])]
                                                        : [];
                                                      links[linkIdx] = {
                                                        ...links[linkIdx],
                                                        href: `/${selectedSlug}`,
                                                      };
                                                      current[colIdx] = {
                                                        ...current[colIdx],
                                                        links,
                                                      };
                                                      next[navIdx] = {
                                                        ...next[navIdx],
                                                        megaMenuColumns: current,
                                                      };
                                                      updateHeroLayout({
                                                        homeNavLinks: next,
                                                        homeMegaMenuColumns: undefined,
                                                      });
                                                    }}
                                                  />
                                                  <button
                                                    type="button"
                                                    className="col-span-1 w-[50px] !rounded-md border border-zinc-300 px-1 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                                                    onClick={() => {
                                                      const next = [...homeNavLinks];
                                                      const current = Array.isArray(next[navIdx].megaMenuColumns)
                                                        ? [...(next[navIdx].megaMenuColumns as any[])]
                                                        : [];
                                                      const links = Array.isArray(current[colIdx]?.links)
                                                        ? (current[colIdx].links as any[]).filter(
                                                            (_: unknown, i: number) => i !== linkIdx,
                                                          )
                                                        : [];
                                                      current[colIdx] = {
                                                        ...current[colIdx],
                                                        links,
                                                      };
                                                      next[navIdx] = {
                                                        ...next[navIdx],
                                                        megaMenuColumns: current,
                                                      };
                                                      updateHeroLayout({
                                                        homeNavLinks: next,
                                                        homeMegaMenuColumns: undefined,
                                                      });
                                                    }}
                                                  >
                                                    x
                                                  </button>
                                                </div>
                                              ),
                                            )}
                                            <button
                                              type="button"
                                              className="!rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                                              onClick={() => {
                                                const next = [...homeNavLinks];
                                                const current = Array.isArray(next[navIdx].megaMenuColumns)
                                                  ? [...(next[navIdx].megaMenuColumns as any[])]
                                                  : [];
                                                const links = Array.isArray(current[colIdx]?.links)
                                                  ? [...(current[colIdx].links as any[])]
                                                  : [];
                                                links.push({ label: "", href: "" });
                                                current[colIdx] = { ...current[colIdx], links };
                                                next[navIdx] = {
                                                  ...next[navIdx],
                                                  megaMenuColumns: current,
                                                };
                                                updateHeroLayout({
                                                  homeNavLinks: next,
                                                  homeMegaMenuColumns: undefined,
                                                });
                                              }}
                                            >
                                              + Add item
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                      {megaColumns.length === 0 && (
                                        <p className="text-xs text-zinc-500">
                                          No mega menu columns linked to this navigation item.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {homeNavLinks.length === 0 && (
                                <p className="text-xs text-zinc-500">
                                  Add navigation links first, then assign mega menu columns.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-3 !rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                        Hero text & form intro
                      </p>
                      <p className="text-xs text-zinc-500">
                        Control the main hero copy on the left and the short intro above the form on the right.
                      </p>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-8">
                        {/* LEFT SECTION */}
                        <div className="space-y-3 md:col-span-2 lg:col-span-6">
                          <RichTextEditor
                            label="Hero left: main card (rich text, overrides default text)"
                            value={heroLayout.leftMainHtml ?? ""}
                            onChange={(html) =>
                              updateHeroLayout({ leftMainHtml: html as any })
                            }
                            placeholder="Main hero copy block (domain label, headline, supporting text). Leave empty to use the defaults."
                            height={330}
                            fontOptions={editorFonts}
                          />

                          <div className="space-y-4 !rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                                  Blockquote style (frontend)
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  Controls the background and border for blockquotes on the public landing page only.
                                </p>
                              </div>
                              <button
                                type="button"
                                className="!rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                                onClick={() =>
                                  updateHeroLayout({ blockquoteStyle: undefined })
                                }
                              >
                                Reset
                              </button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-zinc-700">
                                  Background
                                </label>
                                <HexAlphaColorField
                                  value={blockquoteStyle.bg ?? ""}
                                  onChange={(hex) => updateBlockquoteStyle({ bg: hex })}
                                  fallback="#6b5c5638"
                                  placeholder="#6b5c5638"
                                  label="Background (with transparency)"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-zinc-700">
                                  Border color
                                </label>
                                <HexAlphaColorField
                                  value={blockquoteStyle.border ?? ""}
                                  onChange={(hex) =>
                                    updateBlockquoteStyle({ border: hex })
                                  }
                                  fallback="#62534dab"
                                  placeholder="#62534dab"
                                  label="Border (with transparency)"
                                />
                              </div>
                            </div>
                            <div className="!rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                              <div
                                className="custom space-y-2"
                                style={{
                                  // preview uses same CSS variables as frontend
                                  ["--blockquote-bg" as any]:
                                    blockquoteStyle.bg || undefined,
                                  ["--blockquote-border" as any]:
                                    blockquoteStyle.border || undefined,
                                }}
                              >
                                <blockquote>
                                  <p className="m-0">
                                    Example blockquote preview. This preview
                                    approximates the public style.
                                  </p>
                                </blockquote>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* RIGHT SECTION */}
                        <div className="space-y-3 !rounded-md border border-zinc-200 bg-white p-4 shadow-sm md:col-span-2 lg:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                            Hero image
                          </p>
                          <p className="text-xs text-zinc-500">
                            This image appears behind the hero content on the public landing page.
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            JPG, PNG, WEBP, or SVG only. Maximum size 25&nbsp;MB.
                          </p>
                          <ImageUploader
                            label="Hero image"
                            value={page.heroImageUrl ?? null}
                            onChange={(url) =>
                              update("heroImageUrl", url ?? undefined)
                            }
                          />
                          <div className="space-y-2 !rounded-md border border-zinc-200 bg-zinc-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <label className="block text-sm font-medium text-zinc-700">
                                Background image brightness
                              </label>
                              <div className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                                {(() => {
                                  const value = Number(
                                    (heroLayout as { heroImageBrightness?: number })
                                      .heroImageBrightness,
                                  );
                                  const normalized = Number.isFinite(value)
                                    ? Math.min(1, Math.max(0.2, value))
                                    : 0.58;
                                  return normalized.toFixed(2);
                                })()}
                        </div>
                      </div>
                            <input
                              type="range"
                              min="0.2"
                              max="1"
                              step="0.01"
                              value={(() => {
                                const value = Number(
                                  (heroLayout as { heroImageBrightness?: number })
                                    .heroImageBrightness,
                                );
                                if (Number.isFinite(value)) {
                                  return Math.min(1, Math.max(0.2, value));
                                }
                                return 0.58;
                              })()}
                              onChange={(e) =>
                                updateHeroLayout({
                                  heroImageBrightness: Number(e.target.value),
                                })
                              }
                              className="w-full accent-zinc-900"
                            />
                            <div className="flex items-center justify-between text-[11px] text-zinc-500">
                              <span>Low</span>
                              <span>Balanced</span>
                              <span>High</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-zinc-500">
                                Use lower values for a darker, richer hero backdrop.
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  updateHeroLayout({ heroImageBrightness: 0.58 })
                                }
                                className="ml-2 !rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!isFixedDefaultHomepage && (
                  <div className="space-y-4 !rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                      Form behavior
                    </p>
                    <p className="text-xs text-zinc-500">
                      Choose how the hero form is presented.
                    </p>
                    <div
                      className={`grid gap-4 ${
                        (heroLayout.formStyle as string) === "team-showcase"
                          ? "md:grid-cols-1"
                          : "md:grid-cols-2"
                      }`}
                    >
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-zinc-700">
                            Form layout
                          </label>
                          <select
                            className="w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            value={(heroLayout.formStyle as string) ?? "default"}
                            onChange={(e) =>
                              updateHeroLayout({
                                formStyle: e.target.value as
                                  | "default"
                                  | "questionnaire"
                                  | "detailed-perspective"
                                  | "next-steps"
                                  | "property-finding"
                                  | "team-showcase",
                              })
                            }
                          >
                            <option value="default">
                              Default (Market Brief – name, email, phone)
                            </option>
                            <option value="questionnaire">
                              Questionnaire (numbered questions, optional section)
                            </option>
                            <option value="detailed-perspective">
                              Detailed Perspective (two-column with profile)
                            </option>
                            <option value="next-steps">
                              Next steps (thank-you panel)
                            </option>
                              <option value="property-finding">
                                Property finding page (home-value search + map layout)
                              </option>
                            <option value="team-showcase">
                              Team showcase (image-led hero with integrated form)
                              </option>
                          </select>
                        </div>
                        <div className="space-y-3">
                          <RichTextEditor
                            label="Form heading (rich text)"
                            value={heroLayout.formHeading ?? ""}
                            onChange={(html) =>
                              updateHeroLayout({ formHeading: html as any })
                            }
                            placeholder="Request the Market Brief"
                            height={286}
                            fontOptions={editorFonts}
                          />
                        </div>
                      </div>
                      <div className="space-y-3 ">
                      <div>
                            <label className="mb-1 block text-sm font-medium text-zinc-700">
                              Form background color
                            </label>
                            <HexAlphaColorField
                              value={heroLayout.formBgColor ?? ""}
                              onChange={(hex) =>
                                updateHeroLayout({ formBgColor: hex })
                              }
                              fallback="#ffffffff"
                              placeholder="#ffffffff"
                              label="Form background"
                            />
                          </div>
                        {(heroLayout.formStyle as string) !== "team-showcase" && (
                        <RichTextEditor
                          label="Form intro text (right column, rich text)"
                          value={heroLayout.formIntro ?? ""}
                          onChange={(html) =>
                            updateHeroLayout({ formIntro: html as any })
                          }
                          placeholder="Explain what the visitor receives after submitting the form."
                          height={286}
                          fontOptions={editorFonts}
                        />
                        )}
                      </div>
                    </div>

                    {(heroLayout.formStyle as string) === "property-finding" && (
                      <div className="mt-4 space-y-4 border-t border-dashed border-zinc-200 pt-3">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-zinc-600">
                            Lower strip text (between hero and map)
                          </p>
                          <RichTextEditor
                            label="Hero lower strip (rich text)"
                            value={(heroLayout.heroLowerStripHtml as string) ?? ""}
                            onChange={(html) =>
                              updateHeroLayout({
                                heroLowerStripHtml: html as string,
                              })
                            }
                            placeholder="Short line of text shown in the colored strip between the hero and the map."
                            fontOptions={editorFonts}
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-zinc-600">
                            Text below form / map (rich text)
                          </p>
                          <RichTextEditor
                            label="Form & map footer text"
                            value={(heroLayout.formFooterText as string) ?? ""}
                            onChange={(html) =>
                              updateHeroLayout({ formFooterText: html as string })
                            }
                            placeholder="Optional footer text shown below the form or map (e.g. disclaimer, attribution, confidentiality)."
                            fontOptions={editorFonts}
                          />
                        </div>
                      </div>
                    )}

                    {(heroLayout.formStyle as string) === "team-showcase" && (
                      <div className="mt-4 space-y-4 border-t border-dashed border-zinc-200 pt-3">
                        <p className="text-xs font-medium text-zinc-600">
                          Team showcase assets
                        </p>
                        <div className="grid gap-4 md:grid-cols-[40%_40%_17%] md:items-start">
                          <RichTextEditor
                            label="Trust line below CTA/form (rich text)"
                            value={(heroLayout.teamTrustHtml as string) ?? ""}
                            onChange={(html) =>
                              updateHeroLayout({ teamTrustHtml: html as string })
                            }
                            placeholder="Private. Accurate. No obligation."
                            fontOptions={editorFonts}
                          />
                          <RichTextEditor
                            label="Team info overlay (rich text)"
                            value={(heroLayout.teamInfoHtml as string) ?? ""}
                            onChange={(html) =>
                              updateHeroLayout({ teamInfoHtml: html as string })
                            }
                            placeholder="TEAM ENGEL & VOLKERS<br/>Tom Graup, REALTOR | Marcel Dolak, REALTOR"
                            fontOptions={editorFonts}
                          />
                          <ImageUploader
                            label="Team image (right side)"
                            value={(heroLayout.teamImageUrl as string) ?? null}
                            onChange={(url) =>
                              updateHeroLayout({ teamImageUrl: url ?? undefined })
                            }
                          />
                  </div>
                      </div>
                    )}
                  </div>
                  )}

                  {!isFixedDefaultHomepage && (
                  <div className="space-y-4 !rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                      Call to action & confirmation
                    </p>
                    <p className="text-xs text-zinc-500">
                      Define the primary button label, success message, and CTA styling shown after the form is submitted.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <RichTextEditor
                          label="CTA text (button label, rich text)"
                          value={page.ctaText ?? ""}
                          onChange={(html) => update("ctaText", html as any)}
                          placeholder="Button label, e.g. Request the Market Brief"
                          height={286}
                          fontOptions={editorFonts}
                        />
                        <div>
                          <label className="mb-1 block text-sm font-medium text-zinc-700">
                            CTA background color
                          </label>
                          <HexAlphaColorField
                            value={heroLayout.ctaBgColor ?? ""}
                            onChange={(hex) => updateHeroLayout({ ctaBgColor: hex })}
                            fallback="#18181bff"
                            placeholder="#18181bff"
                            label="CTA background"
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <RichTextEditor
                          label="Toast Success message (rich text)"
                          value={page.successMessage ?? ""}
                          onChange={(html) =>
                            update("successMessage", html as any)
                          }
                          placeholder="Message shown after successful submit."
                          height={286}
                          fontOptions={editorFonts}
                        />
                      </div>
                    </div>
                  </div>
                  )}

                  <div className="space-y-4 !rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                      Page footer
                    </p>
                    <p className="text-xs text-zinc-500">
                      Full-width footer content shown at the very bottom of the page. Leave empty to hide the footer.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700">
                          Footer background color
                        </label>
                        <HexAlphaColorField
                          value={(heroLayout.footerBgColor as string) ?? ""}
                          onChange={(hex) =>
                            updateHeroLayout({ footerBgColor: hex as string })
                          }
                          fallback="#f5f0e9ff"
                          placeholder="#f5f0e9ff"
                          label="Footer background"
                        />
                      </div>
                    </div>
                    <RichTextEditor
                      label="Footer (rich text)"
                      value={(page as any).footerHtml ?? ""}
                      onChange={(html) => update("footerHtml", html as any)}
                      placeholder="Optional footer text (e.g. brokerage disclaimers, licensing, copyright)."
                      fontOptions={editorFonts}
                    />
                  </div>

                  {(heroLayout.formStyle as string) === "detailed-perspective" && (
                    <div className="space-y-2.5 !rounded-md border border-zinc-200 bg-white p-3 shadow-sm">
                      <div className="space-y-0.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                        Detailed Perspective – profile column
                      </p>
                        <p className="text-[11px] leading-snug text-zinc-500">
                          Profile image only as wide as its content; Image layout uses the remaining width on that row.
                        </p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 md:items-start md:gap-3">
                        <div className="min-w-0 !rounded-md border border-zinc-200 bg-zinc-50/80 p-2">
                        <RichTextEditor
                          label="Profile content (rich text)"
                          value={(heroLayout.profileSectionHtml as string) ?? ""}
                          onChange={(html) =>
                            updateHeroLayout({ profileSectionHtml: html as string })
                          }
                          placeholder="Optional: rich text for the profile block (name, title, role, phone, email, etc.). When set, this is shown instead of the fields below."
                          fontOptions={editorFonts}
                            height={220}
                        />
                        </div>
                        <div className="min-w-0 !rounded-md border border-zinc-200 bg-zinc-50/80 p-2">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                            <div className="w-full shrink-0 !rounded-md border border-zinc-200 bg-white p-2 sm:w-fit sm:max-w-full">
                        <ImageUploader
                                compact
                          label="Profile image"
                          value={(heroLayout.profileImageUrl as string) ?? null}
                          onChange={(url) =>
                            updateHeroLayout({ profileImageUrl: url ?? undefined })
                          }
                        />
                        </div>
                            <div className="min-w-0 flex-1 space-y-1.5 !rounded-md border border-zinc-200 bg-white p-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                                Image layout
                              </p>
                              <label className="block text-[11px] font-medium text-zinc-600">
                                Position
                              </label>
                              <select
                                value={((heroLayout as any).profileImagePosition as string) ?? "right"}
                                onChange={(e) =>
                                  updateHeroLayout({
                                    profileImagePosition: e.target.value as any,
                                  })
                                }
                                className="h-9 w-full !rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-800 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                              >
                                <option value="right">Right</option>
                                <option value="left">Left</option>
                                <option value="top">Top</option>
                                <option value="bottom">Bottom</option>
                              </select>

                              <p className="text-[10px] leading-tight text-zinc-500">
                                Top / Left nudge (px). Negative moves opposite.
                              </p>
                              {(
                                [
                                  ["Top", "profileImageOffsetTop"],
                                  ["Left", "profileImageOffsetLeft"],
                                ] as const
                              ).map(([label, key]) => {
                                const raw = Number((heroLayout as any)[key] ?? 0);
                                const parsed = Number.isFinite(raw) ? raw : 0;
                                const clamped = Math.min(200, Math.max(-200, parsed));
                                return (
                                  <label key={key} className="mt-1.5 block space-y-0.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="block text-[11px] font-medium text-zinc-600">
                                        {label} (px)
                                      </span>
                                      <span className="text-[11px] tabular-nums text-zinc-500">
                                        {clamped}
                                      </span>
                        </div>
                                    <input
                                      type="range"
                                      min={-200}
                                      max={200}
                                      step={1}
                                      value={clamped}
                                      onChange={(e) => {
                                        const n = Number.parseInt(e.target.value, 10);
                                        updateHeroLayout({
                                          [key]: Number.isFinite(n) ? n : 0,
                                          profileImageOffsetRight: undefined,
                                          profileImageOffsetBottom: undefined,
                                        } as any);
                                      }}
                                      className="h-2 w-full cursor-pointer accent-zinc-800"
                                    />
                                  </label>
                                );
                              })}
                              <div className="mt-2 space-y-0.5 border-t border-zinc-100 pt-2">
                                <label className="block text-[11px] font-medium text-zinc-600">
                                  Image width (px)
                                </label>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={80}
                                  max={640}
                                  value={Number(
                                    (heroLayout as any).profileImageWidthPx ?? 240,
                                  )}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const n = Number.parseInt(raw || "0", 10);
                                    const clamped = Number.isFinite(n)
                                      ? Math.min(Math.max(n, 80), 640)
                                      : 240;
                                    updateHeroLayout({
                                      profileImageWidthPx: clamped,
                                    } as any);
                                  }}
                                  className="h-9 w-full !rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-800 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                                />
                                <p className="text-[10px] leading-tight text-zinc-500">
                                  Public page width; default 240px.
                                </p>
                      </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 !rounded-md border border-dashed border-zinc-200 bg-zinc-50/90 p-2.5">
                        <p className="text-xs font-medium text-zinc-600">
                          Additional form text (Detailed Perspective)
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="min-w-0 md:col-span-1">
                        <RichTextEditor
                          label="Text after CTA button (rich text)"
                          value={(heroLayout.formPostCtaText as string) ?? ""}
                          onChange={(html) =>
                            updateHeroLayout({ formPostCtaText: html as string })
                          }
                          placeholder="Optional text shown directly below the Complete Request button."
                        />
                        </div>
                          <div className="min-w-0 md:col-span-1">
                        <RichTextEditor
                          label="Text below form area overall (rich text)"
                          value={(heroLayout.formFooterText as string) ?? ""}
                          onChange={(html) =>
                            updateHeroLayout({ formFooterText: html as string })
                          }
                          placeholder="Optional text shown below the entire form panel (e.g. disclaimer, attribution)."
                        />
                        </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(heroLayout.formStyle as string) === "next-steps" && (
                    <div className="space-y-4 !rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                        Next steps panel (thank-you layout)
                      </p>
                      <p className="text-xs text-zinc-500">
                        Configure the three-column thank-you panel: the left content block, middle profile block, and supporting image.
                      </p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <RichTextEditor
                          label="Next steps – first block (rich text)"
                          value={heroLayout.nextStepsFirstHtml ?? ""}
                          onChange={(html) =>
                            updateHeroLayout({
                              nextStepsFirstHtml: html as string,
                            })
                          }
                          placeholder="Left card content: bullets, text, etc."
                        />
                        <div className="space-y-3">
                          <RichTextEditor
                            label="Next steps – second block (rich text)"
                            value={heroLayout.nextStepsSecondHtml ?? ""}
                            onChange={(html) =>
                              updateHeroLayout({
                                nextStepsSecondHtml: html as string,
                              })
                            }
                            placeholder="Profile card text (name, lines, etc.)"
                          />
                          <ImageUploader
                            label="Next steps – second block image"
                            value={
                              (heroLayout.nextStepsSecondImageUrl as string) ??
                              null
                            }
                            onChange={(url) =>
                              updateHeroLayout({
                                nextStepsSecondImageUrl: url ?? undefined,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2 !rounded-md border border-dashed border-zinc-200 bg-zinc-50 p-3">
                        <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 border border-zinc-400 text-zinc-900 focus:ring-zinc-900"
                            checked={
                              ((heroLayout as any)?.nextStepsSecondOnly as boolean | undefined) ===
                              true
                            }
                            onChange={(e) =>
                              updateHeroLayout({
                                nextStepsSecondOnly: e.target.checked ? true : undefined,
                              })
                            }
                          />
                          <span className="font-medium">
                            Show only profile block + CTA (single-column variant)
                          </span>
                        </label>
                        <p className="text-[11px] text-zinc-500">
                          When enabled, the Next steps layout will render only the middle profile
                          block and CTA button in a single full-width column. This is useful for
                          pages like strategy calls and dedicated thank-you panels.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="!rounded-md border border-dashed border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    This page is configured as a multistep form entry. Only the list of
                    step slugs below is editable here. Content, form fields, SEO, and
                    layout are taken from the first step page.
                  </div>
                  <div className="space-y-3 !rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                      Multistep flow (step slugs)
                    </p>
                    <p className="text-xs text-zinc-500">
                      Choose pages for each step, in order. The first page controls the
                      SEO and layout for this multistep experience.
                    </p>
                    <MultistepPageSelector
                      domainId={(initialPage as { domainId?: string }).domainId ?? ""}
                      value={multistepStepSlugs}
                      onChange={setMultistepStepSlugs}
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      This page becomes the entry URL; step content is loaded from the
                      selected pages.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          {tab === "form" && (
            effectivePageMode === "multistep" ? (
              <div className="!rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
                This page is a multistep entry. Form fields are configured on the
                individual step pages instead of here.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="!rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                    Social media icons for this page
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Override or hide social icons for this landing page only. When left
                    blank, icons fall back to the domain-level settings.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {[
                      {
                        key: "linkedin" as const,
                        label: "LinkedIn URL",
                        visibleKey: "linkedinVisible" as const,
                        urlKey: "linkedinUrl" as const,
                      },
                      {
                        key: "google" as const,
                        label: "Google Business URL",
                        visibleKey: "googleVisible" as const,
                        urlKey: "googleUrl" as const,
                      },
                      {
                        key: "facebook" as const,
                        label: "Facebook URL",
                        visibleKey: "facebookVisible" as const,
                        urlKey: "facebookUrl" as const,
                      },
                      {
                        key: "instagram" as const,
                        label: "Instagram URL",
                        visibleKey: "instagramVisible" as const,
                        urlKey: "instagramUrl" as const,
                      },
                      {
                        key: "zillow" as const,
                        label: "Zillow URL",
                        visibleKey: "zillowVisible" as const,
                        urlKey: "zillowUrl" as const,
                      },
                      {
                        key: "youtube" as const,
                        label: "YouTube URL",
                        visibleKey: "youtubeVisible" as const,
                        urlKey: "youtubeUrl" as const,
                      },
                      {
                        key: "tiktok" as const,
                        label: "TikTok URL",
                        visibleKey: "tiktokVisible" as const,
                        urlKey: "tiktokUrl" as const,
                      },
                    ].map((item) => {
                      const current = socialOverrides ?? {};
                      const url = (current as any)[item.urlKey] ?? "";
                      const visible = (current as any)[item.visibleKey];
                      const effectiveVisible =
                        typeof visible === "boolean" ? visible : true;
                      return (
                        <div key={item.key} className="space-y-1">
                          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                            <span>{item.label}</span>
                            <input
                              type="text"
                              value={url}
                              onChange={(e) => {
                                const next = {
                                  ...(socialOverrides ?? {}),
                                  [item.urlKey]:
                                    e.target.value.trim().length > 0
                                      ? e.target.value
                                      : null,
                                } as any;
                                setSocialOverrides(next);
                                setPage((prev) => ({
                                  ...prev,
                                  socialOverrides: next,
                                }));
                              }}
                              className="mt-0.5 rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                              placeholder="https://..."
                            />
                          </label>
                          <label className="mt-1 flex items-center gap-1 text-xs text-zinc-600">
                            <input
                              type="checkbox"
                              checked={effectiveVisible}
                              onChange={(e) => {
                                const next = {
                                  ...(socialOverrides ?? {}),
                                  [item.visibleKey]: e.target.checked,
                                } as any;
                                setSocialOverrides(next);
                                setPage((prev) => ({
                                  ...prev,
                                  socialOverrides: next,
                                }));
                              }}
                            />
                            <span>Show this icon on this page</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              <FormEditor
                value={formSchema}
                onChange={(schema) => setFormSchema(schema)}
                editorFonts={editorFonts}
              />
              </div>
            )
          )}
          {tab === "layout" && (
            effectivePageMode === "multistep" ? (
              <div className="!rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
                This page is a multistep entry. Hero layout and grid positions are
                controlled by the first step page.
              </div>
            ) : (
              <DragDropPageLayoutEditor
                page={page}
                onReady={(getLayout) => {
                  layoutGetLayoutRef.current = getLayout;
                }}
                initialLayout={savedLayout}
              />
            )
          )}
          {tab === "seo" && (
            effectivePageMode === "multistep" ? (
              <div className="!rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
                This page is a multistep entry. SEO (title, description, canonical)
                should be edited on the first step page; it will be used for the full
                flow.
              </div>
            ) : (
              <SeoEditor
                title={page.headline}
                description={page.subheadline ?? ""}
                url={buildCustomerSiteUrl(
                  page.domain.hostname,
                  `/${encodeURIComponent(page.slug)}`,
                )}
                values={{
                  seoTitle: page.seo.title,
                  seoDescription: page.seo.description,
                  canonicalUrl: page.seo.canonicalUrl,
                  noIndex: page.seo.noIndex ?? false,
                }}
                onChange={(val) =>
                  setPage((prev) => {
                    const derivedSlug = deriveSlugFromCanonicalUrl(
                      val.canonicalUrl ?? "",
                    );
                    return {
                    ...prev,
                      ...(derivedSlug ? { slug: derivedSlug } : {}),
                    seo: {
                      ...prev.seo,
                      title: val.seoTitle,
                      description: val.seoDescription,
                      canonicalUrl: val.canonicalUrl,
                      noIndex: val.noIndex,
                    },
                    };
                  })
                }
              />
            )
          )}
          {tab === "cta" && (
            <div className="space-y-4">
              <CtaForwardingSettingsForm
                initialRules={ctaForwardingRules}
                multistepNotifyEachStep={multistepNotifyEachStep}
                onMultistepNotifyEachStepChange={setMultistepNotifyEachStep}
                saveButtonLabel="Save page CTA rules"
                onSaveRules={async (rules, options) => {
                  const nextMultistepNotifyEachStep =
                    options?.multistepNotifyEachStep ?? multistepNotifyEachStep;
                  const res = await fetch(`/api/admin/pages/${initialPage.dbId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      ctaForwardingRules: rules,
                      multistepNotifyEachStep: nextMultistepNotifyEachStep,
                    }),
                  });
                  const data = (await res.json().catch(() => null)) as
                    | { error?: string }
                    | null;
                  if (!res.ok) {
                    throw new Error(
                      (data && typeof data.error === "string" && data.error) ||
                        "Failed to save CTA forwarding rules.",
                    );
                  }
                  setCtaForwardingRules(rules);
                  setMultistepNotifyEachStep(nextMultistepNotifyEachStep);
                  setPage((prev) => {
                    const currentSections = Array.isArray(prev.sections)
                      ? [...prev.sections]
                      : [];
                    const heroIndex = currentSections.findIndex(
                      (section) => section?.kind === "hero",
                    );
                    if (heroIndex >= 0) {
                      const heroSection = currentSections[heroIndex] as any;
                      currentSections[heroIndex] = {
                        ...heroSection,
                        props: {
                          ...(heroSection?.props || {}),
                          ctaForwardingRules: rules,
                        },
                      } as any;
                    } else {
                      currentSections.push({
                        id: "hero",
                        kind: "hero",
                        props: { ctaForwardingRules: rules },
                      } as any);
                    }
                    return {
                      ...prev,
                      sections: currentSections,
                      multistepNotifyEachStep: nextMultistepNotifyEachStep,
                    };
                  });
                }}
              />
              <PageToastSettingsForm
                initialValue={pageToastThemeOverride}
                onSave={async (toastThemeOverride) => {
                  const res = await fetch(`/api/admin/pages/${initialPage.dbId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ toastThemeOverride }),
                  });
                  const data = (await res.json().catch(() => null)) as
                    | { error?: string }
                    | null;
                  if (!res.ok) {
                    throw new Error(
                      (data && typeof data.error === "string" && data.error) ||
                        "Failed to save local toast settings.",
                    );
                  }
                  setPageToastThemeOverride(
                    (toastThemeOverride as PageToastThemeOverride | null) ?? null,
                  );
                  setPage((prev) => {
                    const currentSections = Array.isArray(prev.sections)
                      ? [...prev.sections]
                      : [];
                    const heroIndex = currentSections.findIndex(
                      (section) => section?.kind === "hero",
                    );
                    if (heroIndex >= 0) {
                      const heroSection = currentSections[heroIndex] as any;
                      const nextProps = { ...(heroSection?.props || {}) } as Record<
                        string,
                        unknown
                      >;
                      if (toastThemeOverride) {
                        nextProps.toastThemeOverride = toastThemeOverride;
                      } else {
                        delete nextProps.toastThemeOverride;
                      }
                      currentSections[heroIndex] = {
                        ...heroSection,
                        props: nextProps,
                      } as any;
                    } else if (toastThemeOverride) {
                      currentSections.push({
                        id: "hero",
                        kind: "hero",
                        props: { toastThemeOverride },
                      } as any);
                    }
                    return { ...prev, sections: currentSections };
                  });
                }}
              />
        </div>
          )}
        </div>
        <div className="h-[588px] overflow-hidden !rounded-md border border-zinc-200 bg-white shadow-sm md:h-[784px] adj01 mb-[50px]">
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-600 ">
              Live preview
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-zinc-500">/{page.slug}</p>
              <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white text-[11px]">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`px-2 py-0.5 rounded-full ${
                    previewDevice === "desktop"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`px-2 py-0.5 rounded-full ${
                    previewDevice === "mobile"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  Mobile
                </button>
              </div>
            </div>
          </div>
          <div className="flex h-full w-full items-center justify-center bg-zinc-50">
            <iframe
              id="page-preview"
              title="Live preview"
              src={`/${encodeURIComponent(page.slug)}?preview=1&domain=${encodeURIComponent(page.domain.hostname)}`}
              className={
                previewDevice === "mobile"
                  ? "h-full w-[380px] max-w-full border-0 rounded-[1.25rem] shadow-md"
                  : "w-full border-0 h-[calc(100%_-_80px)]"
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

