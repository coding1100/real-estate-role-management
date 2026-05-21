import { NextRequest, NextResponse } from "next/server";
import {
  getAdminUiSettings,
  updateAdminUiSettings,
  EditorFontOption,
} from "@/lib/uiSettings";
import {
  type CtaForwardingDocument,
  type CtaForwardingNotifyEmail,
  type CtaForwardingRule,
  sanitizeCtaTitle,
} from "@/lib/types/ctaForwarding";

export async function GET() {
  const { settings, theme } = await getAdminUiSettings();
  return NextResponse.json({ settings, theme });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Partial<{
    toastSuccessBg: string;
    toastSuccessText: string;
    toastErrorBg: string;
    toastErrorText: string;
    toastAlertBg: string;
    toastAlertText: string;
    toastInfoBg: string;
    toastInfoText: string;
    toastIconSize: number;
    toastSuccessTitle: string;
    toastSuccessBody: string;
    toastErrorTitle: string;
    toastErrorBody: string;
    toastAlertTitle: string;
    toastAlertBody: string;
    toastPosition:
      | "top-right"
      | "top-left"
      | "bottom-right"
      | "bottom-left"
      | "top-center"
      | "bottom-center";
    toastAdminPosition:
      | "top-right"
      | "top-left"
      | "bottom-right"
      | "bottom-left"
      | "top-center"
      | "bottom-center";
    toastFrontendPosition:
      | "top-right"
      | "top-left"
      | "bottom-right"
      | "bottom-left"
      | "top-center"
      | "bottom-center";
    toastDurationMs: number;
    toastAdminDurationMs: number;
    toastFrontendDurationMs: number;
    editorFonts: EditorFontOption[];
    ctaForwardingRules: CtaForwardingRule[];
  }>;

  const allowed: Record<
    string,
    | string
    | number
    | EditorFontOption[]
    | CtaForwardingRule[]
    | undefined
  > = {};
  if (typeof body.toastSuccessBg === "string") {
    allowed.toastSuccessBg = body.toastSuccessBg;
  }
  if (typeof body.toastSuccessText === "string") {
    allowed.toastSuccessText = body.toastSuccessText;
  }
  if (typeof body.toastErrorBg === "string") {
    allowed.toastErrorBg = body.toastErrorBg;
  }
  if (typeof body.toastErrorText === "string") {
    allowed.toastErrorText = body.toastErrorText;
  }
  if (typeof body.toastAlertBg === "string") {
    allowed.toastAlertBg = body.toastAlertBg;
  }
  if (typeof body.toastAlertText === "string") {
    allowed.toastAlertText = body.toastAlertText;
  }
  if (typeof body.toastInfoBg === "string") {
    allowed.toastInfoBg = body.toastInfoBg;
  }
  if (typeof body.toastInfoText === "string") {
    allowed.toastInfoText = body.toastInfoText;
  }
  if (
    typeof body.toastIconSize === "number" &&
    body.toastIconSize >= 14 &&
    body.toastIconSize <= 40
  ) {
    allowed.toastIconSize = body.toastIconSize;
  }
  if (typeof body.toastSuccessTitle === "string") {
    allowed.toastSuccessTitle = body.toastSuccessTitle;
  }
  if (typeof body.toastSuccessBody === "string") {
    allowed.toastSuccessBody = body.toastSuccessBody;
  }
  if (typeof body.toastErrorTitle === "string") {
    allowed.toastErrorTitle = body.toastErrorTitle;
  }
  if (typeof body.toastErrorBody === "string") {
    allowed.toastErrorBody = body.toastErrorBody;
  }
  if (typeof body.toastAlertTitle === "string") {
    allowed.toastAlertTitle = body.toastAlertTitle;
  }
  if (typeof body.toastAlertBody === "string") {
    allowed.toastAlertBody = body.toastAlertBody;
  }
  if (
    body.toastPosition === "top-right" ||
    body.toastPosition === "top-left" ||
    body.toastPosition === "bottom-right" ||
    body.toastPosition === "bottom-left" ||
    body.toastPosition === "top-center" ||
    body.toastPosition === "bottom-center"
  ) {
    allowed.toastPosition = body.toastPosition;
  }
  if (
    body.toastAdminPosition === "top-right" ||
    body.toastAdminPosition === "top-left" ||
    body.toastAdminPosition === "bottom-right" ||
    body.toastAdminPosition === "bottom-left" ||
    body.toastAdminPosition === "top-center" ||
    body.toastAdminPosition === "bottom-center"
  ) {
    allowed.toastAdminPosition = body.toastAdminPosition;
  }
  if (
    body.toastFrontendPosition === "top-right" ||
    body.toastFrontendPosition === "top-left" ||
    body.toastFrontendPosition === "bottom-right" ||
    body.toastFrontendPosition === "bottom-left" ||
    body.toastFrontendPosition === "top-center" ||
    body.toastFrontendPosition === "bottom-center"
  ) {
    allowed.toastFrontendPosition = body.toastFrontendPosition;
  }

  if (
    typeof body.toastDurationMs === "number" &&
    body.toastDurationMs >= 1000 &&
    body.toastDurationMs <= 30000
  ) {
    allowed.toastDurationMs = Math.floor(body.toastDurationMs);
  }
  if (
    typeof body.toastAdminDurationMs === "number" &&
    body.toastAdminDurationMs >= 1000 &&
    body.toastAdminDurationMs <= 30000
  ) {
    allowed.toastAdminDurationMs = Math.floor(body.toastAdminDurationMs);
  }
  if (
    typeof body.toastFrontendDurationMs === "number" &&
    body.toastFrontendDurationMs >= 1000 &&
    body.toastFrontendDurationMs <= 30000
  ) {
    allowed.toastFrontendDurationMs = Math.floor(body.toastFrontendDurationMs);
  }

  if (Array.isArray(body.editorFonts)) {
    const fromBody = body.editorFonts as Array<{
      label?: string;
      cssFamily?: string;
      enabled?: boolean;
      importUrl?: string;
    }>;
    const sanitized: EditorFontOption[] = [];
    for (const item of fromBody) {
      if (
        item &&
        typeof item.label === "string" &&
        item.label.trim().length > 0
      ) {
        const label = item.label.trim();
        const cssFamilyRaw =
          typeof item.cssFamily === "string" ? item.cssFamily.trim() : "";
        const cssFamily =
          cssFamilyRaw.length > 0
            ? cssFamilyRaw
            : `"${label}", system-ui, sans-serif`;

        sanitized.push({
          label,
          cssFamily,
          enabled: item.enabled !== false,
          importUrl:
            typeof item.importUrl === "string" &&
            item.importUrl.trim().length > 0
              ? item.importUrl.trim()
              : undefined,
        });
      }
    }
    // Store exactly what the client sends (after trimming/validation).
    // Built-in fonts are guaranteed/merged when reading settings.
    allowed.editorFonts = sanitized;
  }

  if (Array.isArray(body.ctaForwardingRules)) {
    const sanitized: CtaForwardingRule[] = [];
    for (const item of body.ctaForwardingRules) {
      const ctaTitle = sanitizeCtaTitle(
        typeof item?.ctaTitle === "string" ? item.ctaTitle : "",
      );
      const forwardUrl =
        typeof item?.forwardUrl === "string" ? item.forwardUrl.trim() : "";
      const forwardEnabled =
        typeof item?.forwardEnabled === "boolean"
          ? item.forwardEnabled
          : !!forwardUrl;
      const resendTemplateId =
        typeof item?.resendTemplateId === "string"
          ? item.resendTemplateId.trim()
          : "";
      const resendTemplateName =
        typeof item?.resendTemplateName === "string"
          ? item.resendTemplateName.trim()
          : "";
      const deliveryMode =
        item?.deliveryMode === "notify_only_form_data"
          ? "notify_only_form_data"
          : "documents_with_notify";
      if (!ctaTitle) {
        continue;
      }
      if (forwardUrl && !/^https?:\/\//i.test(forwardUrl)) {
        continue;
      }
      const rawDocuments = Array.isArray(item.documents)
        ? item.documents
        : [];
      const documents: CtaForwardingDocument[] = rawDocuments
        .map((doc) => {
          if (!doc) return null;
          const name =
            typeof doc.name === "string" ? doc.name.trim() : "";
          const url =
            typeof doc.url === "string" ? doc.url.trim() : "";
          if (!name || !url || !/^https?:\/\//i.test(url)) return null;
          const result: CtaForwardingDocument = {
            name,
            url,
          };
          if (typeof doc.autoSend === "boolean") {
            result.autoSend = doc.autoSend;
          }
          if (typeof doc.mimeType === "string" && doc.mimeType.trim()) {
            result.mimeType = doc.mimeType.trim();
          }
          return result;
        })
        .filter(Boolean) as CtaForwardingDocument[];

      const rawNotifyEmails = Array.isArray(item.notifyEmails)
        ? item.notifyEmails
        : [];
      const notifyEmails: CtaForwardingNotifyEmail[] = rawNotifyEmails
        .map((entry) => {
          if (!entry) return null;
          const email =
            typeof entry.email === "string" ? entry.email.trim() : "";
          if (!email || !email.includes("@")) return null;
          const result: CtaForwardingNotifyEmail = { email };
          if (typeof entry.enabled === "boolean") {
            result.enabled = entry.enabled;
          }
          const kindRaw =
            typeof entry.kind === "string"
              ? entry.kind.trim().toLowerCase()
              : undefined;
          if (kindRaw === "cc" || kindRaw === "bcc") {
            result.kind = kindRaw;
          }
          return result;
        })
        .filter(Boolean) as CtaForwardingNotifyEmail[];

      sanitized.push({
        ctaTitle,
        deliveryMode,
        forwardEnabled,
        ...(forwardUrl ? { forwardUrl } : {}),
        ...(resendTemplateId ? { resendTemplateId } : {}),
        ...(resendTemplateName ? { resendTemplateName } : {}),
        ...(deliveryMode === "documents_with_notify" && documents.length
          ? { documents }
          : {}),
        ...(notifyEmails.length ? { notifyEmails } : {}),
      });
    }
    allowed.ctaForwardingRules = sanitized;
  }

  const { settings, theme } = await updateAdminUiSettings(allowed);
  return NextResponse.json({ settings, theme });
}

