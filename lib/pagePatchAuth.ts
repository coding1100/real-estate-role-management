import {
  AuthError,
  can,
  requireCapability,
  type AuthContext,
} from "@/lib/authorization";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

const METADATA_KEYS = new Set([
  "slug",
  "title",
  "type",
  "headline",
  "subheadline",
  "bookmarked",
  "adminListOrder",
  "canonicalUrl",
]);

const CONTENT_KEYS = new Set([
  "headline",
  "subheadline",
  "heroImageUrl",
  "sections",
  "ctaText",
  "successMessage",
  "deliverableUrl",
  "footerHtml",
  "notes",
  "primaryColor",
  "accentColor",
]);

const LAYOUT_KEYS = new Set(["layoutData", "pageLayout"]);
const FORM_KEYS = new Set(["formSchema", "useCustomForm", "multistepStepSlugs"]);
const SEO_KEYS = new Set([
  "seoTitle",
  "seoDescription",
  "seoKeywords",
  "ogImageUrl",
  "ogType",
  "twitterCard",
  "noIndex",
  "schemaMarkup",
  "customHeadTags",
]);
const BRANDING_KEYS = new Set(["primaryColor", "accentColor"]);
const CTA_KEYS = new Set(["ctaForwardingRules"]);
const TOAST_KEYS = new Set(["toastThemeOverride"]);
const MULTISTEP_KEYS = new Set(["multistepNotifyEachStep"]);

function builtInKeyForDomain(
  ctx: AuthContext,
  domainId: string,
): string | null {
  if (ctx.allDomainsBuiltInKey) return ctx.allDomainsBuiltInKey;
  return (
    ctx.assignments.find((a) => a.domainId === domainId)?.builtInKey ?? null
  );
}

function permissionsForBodyKey(key: string): Permission[] {
  if (key === "status") return [PERMISSIONS.PAGES_PUBLISH];
  if (key === "action") return [PERMISSIONS.PAGES_RESTORE];
  if (METADATA_KEYS.has(key)) return [PERMISSIONS.PAGES_EDIT_METADATA];
  if (CONTENT_KEYS.has(key)) return [PERMISSIONS.PAGES_EDIT_CONTENT];
  if (LAYOUT_KEYS.has(key)) return [PERMISSIONS.PAGES_EDIT_LAYOUT];
  if (FORM_KEYS.has(key)) return [PERMISSIONS.PAGES_EDIT_FORM];
  if (SEO_KEYS.has(key)) return [PERMISSIONS.PAGES_EDIT_SEO];
  if (BRANDING_KEYS.has(key)) return [PERMISSIONS.PAGES_EDIT_BRANDING];
  if (CTA_KEYS.has(key)) return [PERMISSIONS.PAGES_EDIT_CTA];
  if (TOAST_KEYS.has(key)) return [PERMISSIONS.PAGES_EDIT_TOAST];
  if (MULTISTEP_KEYS.has(key)) return [PERMISSIONS.PAGES_EDIT_MULTISTEP];
  return [PERMISSIONS.PAGES_EDIT_CONTENT];
}

export function assertPagePatchAllowed(
  ctx: AuthContext,
  body: Record<string, unknown>,
  opts: {
    domainId: string;
    pageStatus: "draft" | "published";
    isRestore?: boolean;
  },
): void {
  const pageStatus = opts.pageStatus;
  const domainId = opts.domainId;
  const builtInKey = builtInKeyForDomain(ctx, domainId);

  if (opts.isRestore || body.action === "restore") {
    requireCapability(ctx, PERMISSIONS.PAGES_RESTORE, { domainId, pageStatus });
    return;
  }

  if (builtInKey === "member" || builtInKey === "explorer") {
    if (pageStatus !== "published") {
      throw new AuthError(403, "Forbidden");
    }
    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      throw new AuthError(403, "Forbidden");
    }
    if (Object.prototype.hasOwnProperty.call(body, "slug")) {
      throw new AuthError(403, "Forbidden");
    }
  }

  if (builtInKey === "explorer") {
    throw new AuthError(403, "Forbidden");
  }

  const keys = Object.keys(body).filter((k) => k !== "action");
  for (const key of keys) {
    for (const perm of permissionsForBodyKey(key)) {
      if (!can(ctx, perm, { domainId, pageStatus })) {
        throw new AuthError(403, "Forbidden");
      }
    }
  }
}
