import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prismaRetry";
import type { EditorFontOption } from "@/lib/editorFonts";
import { DEFAULT_EDITOR_FONTS } from "@/lib/editorFonts";
import {
  type CtaForwardingDocument,
  type CtaForwardingNotifyEmail,
  type CtaForwardingRule,
  sanitizeCtaTitle,
} from "@/lib/types/ctaForwarding";

const SINGLETON_ID = "singleton";

export interface ToastTheme {
  position:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center";
  adminPosition:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center";
  frontendPosition:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center";
  durationMs: number;
  adminDurationMs: number;
  frontendDurationMs: number;
  successBg: string;
  successText: string;
  errorBg: string;
  errorText: string;
  alertBg: string;
  alertText: string;
   infoBg: string;
   infoText: string;
  iconSize: number;
  successTitle: string;
  successBody: string;
  errorTitle: string;
  errorBody: string;
  alertTitle: string;
  alertBody: string;
}

export interface AdminUiSettings {
  id: string;
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
  toastPosition?: ToastTheme["position"];
  toastAdminPosition?: ToastTheme["position"];
  toastFrontendPosition?: ToastTheme["position"];
  toastDurationMs?: number;
  toastAdminDurationMs?: number;
  toastFrontendDurationMs?: number;
  editorFonts?: EditorFontOption[] | null;
  ctaForwardingRules?: CtaForwardingRule[] | null;
}

// Re-export from client-safe module so server code can still import from here
export type { EditorFontOption } from "@/lib/editorFonts";
export {
  DEFAULT_EDITOR_FONTS,
  BUILT_IN_EDITOR_FONT_LABELS,
  isBuiltInEditorFont,
  getEnabledEditorFonts,
} from "@/lib/editorFonts";

export const DEFAULT_THEME: ToastTheme = {
  position: "top-right",
  adminPosition: "top-right",
  frontendPosition: "top-right",
  durationMs: 5000,
  adminDurationMs: 5000,
  frontendDurationMs: 5000,
  successBg: "#ecfdf3",
  successText: "#166534",
  errorBg: "#fef2f2",
  errorText: "#b91c1c",
  alertBg: "#fffbeb",
  alertText: "#92400e",
  infoBg: "#eff6ff",
  infoText: "#1d4ed8",
  iconSize: 24,
  successTitle: "Success",
  successBody: "Action completed successfully.",
  errorTitle: "Something went wrong",
  errorBody: "Please try again.",
  alertTitle: "Attention",
  alertBody: "Please review this information.",
};

function normalizeCtaForwardingRules(
  input: unknown,
): CtaForwardingRule[] {
  if (!Array.isArray(input)) return [];
  const normalized: CtaForwardingRule[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const ctaTitle = sanitizeCtaTitle(
      typeof (item as any).ctaTitle === "string"
        ? (item as any).ctaTitle
        : "",
    );
    const forwardUrl =
      typeof (item as any).forwardUrl === "string"
        ? (item as any).forwardUrl.trim()
        : "";
    const forwardEnabled =
      typeof (item as any).forwardEnabled === "boolean"
        ? (item as any).forwardEnabled
        : !!forwardUrl;
    const resendTemplateId =
      typeof (item as any).resendTemplateId === "string"
        ? (item as any).resendTemplateId.trim()
        : "";
    const resendTemplateName =
      typeof (item as any).resendTemplateName === "string"
        ? (item as any).resendTemplateName.trim()
        : "";
    const deliveryMode =
      (item as any).deliveryMode === "notify_only_form_data"
        ? "notify_only_form_data"
        : "documents_with_notify";
    if (!ctaTitle) continue;
    if (forwardUrl && !/^https?:\/\//i.test(forwardUrl)) continue;

    const rawDocuments = Array.isArray((item as any).documents)
      ? ((item as any).documents as unknown[])
      : [];
    const documents: CtaForwardingDocument[] =
      rawDocuments
        .map((doc) => {
          if (!doc || typeof doc !== "object") return null;
          const name =
            typeof (doc as any).name === "string"
              ? (doc as any).name.trim()
              : "";
          const url =
            typeof (doc as any).url === "string"
              ? (doc as any).url.trim()
              : "";
          if (!name || !url || !/^https?:\/\//i.test(url)) return null;
          const autoSend =
            typeof (doc as any).autoSend === "boolean"
              ? (doc as any).autoSend
              : undefined;
          const mimeType =
            typeof (doc as any).mimeType === "string"
              ? (doc as any).mimeType.trim()
              : undefined;
          const publicId =
            typeof (doc as any).publicId === "string"
              ? (doc as any).publicId.trim()
              : "";
          const format =
            typeof (doc as any).format === "string"
              ? (doc as any).format.trim().toLowerCase()
              : "";
          return {
            name,
            url,
            ...(autoSend !== undefined ? { autoSend } : {}),
            ...(mimeType ? { mimeType } : {}),
            ...(publicId ? { publicId } : {}),
            ...(format ? { format } : {}),
          };
        })
        .filter(Boolean) as CtaForwardingDocument[];

    const rawNotifyEmails = Array.isArray((item as any).notifyEmails)
      ? ((item as any).notifyEmails as unknown[])
      : [];
    const notifyEmails: CtaForwardingNotifyEmail[] =
      rawNotifyEmails
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const email =
            typeof (entry as any).email === "string"
              ? (entry as any).email.trim()
              : "";
          if (!email || !email.includes("@")) return null;
          const enabledRaw =
            typeof (entry as any).enabled === "boolean"
              ? (entry as any).enabled
              : undefined;
          const kindRaw =
            typeof (entry as any).kind === "string"
              ? (entry as any).kind.trim().toLowerCase()
              : undefined;
          const kind: "cc" | "bcc" | undefined =
            kindRaw === "cc" || kindRaw === "bcc" ? (kindRaw as any) : undefined;
          return {
            email,
            ...(enabledRaw === undefined ? {} : { enabled: enabledRaw }),
            ...(kind ? { kind } : {}),
          };
        })
        .filter(Boolean) as CtaForwardingNotifyEmail[];

    normalized.push({
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
  return normalized;
}

async function ensureCtaForwardingColumn() {
  await withPrismaRetry(() =>
    prisma.$executeRawUnsafe(
      'ALTER TABLE "AdminUiSettings" ADD COLUMN IF NOT EXISTS "ctaForwardingRules" JSONB',
    ),
  );
}

async function ensureToastPositionColumn() {
  await withPrismaRetry(() =>
    prisma.$executeRawUnsafe(
      'ALTER TABLE "AdminUiSettings" ADD COLUMN IF NOT EXISTS "toastPosition" TEXT',
    ),
  );
}

let ensureToastPositionColumnPromise: Promise<void> | null = null;
let ensureToastAdminPositionColumnPromise: Promise<void> | null = null;
let ensureToastFrontendPositionColumnPromise: Promise<void> | null = null;
let ensureCtaForwardingColumnPromise: Promise<void> | null = null;
let ensureToastDurationColumnPromise: Promise<void> | null = null;
let ensureToastAdminDurationColumnPromise: Promise<void> | null = null;
let ensureToastFrontendDurationColumnPromise: Promise<void> | null = null;

async function ensureToastPositionColumnOnce() {
  if (!ensureToastPositionColumnPromise) {
    ensureToastPositionColumnPromise = ensureToastPositionColumn().catch((err) => {
      ensureToastPositionColumnPromise = null;
      throw err;
    });
  }
  await ensureToastPositionColumnPromise;
}

async function ensureToastAdminPositionColumn() {
  await withPrismaRetry(() =>
    prisma.$executeRawUnsafe(
      'ALTER TABLE "AdminUiSettings" ADD COLUMN IF NOT EXISTS "toastAdminPosition" TEXT',
    ),
  );
}

async function ensureToastFrontendPositionColumn() {
  await withPrismaRetry(() =>
    prisma.$executeRawUnsafe(
      'ALTER TABLE "AdminUiSettings" ADD COLUMN IF NOT EXISTS "toastFrontendPosition" TEXT',
    ),
  );
}

async function ensureToastAdminPositionColumnOnce() {
  if (!ensureToastAdminPositionColumnPromise) {
    ensureToastAdminPositionColumnPromise = ensureToastAdminPositionColumn().catch(
      (err) => {
        ensureToastAdminPositionColumnPromise = null;
        throw err;
      },
    );
  }
  await ensureToastAdminPositionColumnPromise;
}

async function ensureToastFrontendPositionColumnOnce() {
  if (!ensureToastFrontendPositionColumnPromise) {
    ensureToastFrontendPositionColumnPromise =
      ensureToastFrontendPositionColumn().catch((err) => {
        ensureToastFrontendPositionColumnPromise = null;
        throw err;
      });
  }
  await ensureToastFrontendPositionColumnPromise;
}

async function ensureCtaForwardingColumnOnce() {
  if (!ensureCtaForwardingColumnPromise) {
    ensureCtaForwardingColumnPromise = ensureCtaForwardingColumn().catch((err) => {
      ensureCtaForwardingColumnPromise = null;
      throw err;
    });
  }
  await ensureCtaForwardingColumnPromise;
}

async function ensureToastDurationColumn() {
  await withPrismaRetry(() =>
    prisma.$executeRawUnsafe(
      'ALTER TABLE "AdminUiSettings" ADD COLUMN IF NOT EXISTS "toastDurationMs" INTEGER',
    ),
  );
}

async function ensureToastAdminDurationColumn() {
  await withPrismaRetry(() =>
    prisma.$executeRawUnsafe(
      'ALTER TABLE "AdminUiSettings" ADD COLUMN IF NOT EXISTS "toastAdminDurationMs" INTEGER',
    ),
  );
}

async function ensureToastFrontendDurationColumn() {
  await withPrismaRetry(() =>
    prisma.$executeRawUnsafe(
      'ALTER TABLE "AdminUiSettings" ADD COLUMN IF NOT EXISTS "toastFrontendDurationMs" INTEGER',
    ),
  );
}

async function ensureToastDurationColumnOnce() {
  if (!ensureToastDurationColumnPromise) {
    ensureToastDurationColumnPromise = ensureToastDurationColumn().catch(
      (err) => {
        ensureToastDurationColumnPromise = null;
        throw err;
      },
    );
  }
  await ensureToastDurationColumnPromise;
}

async function ensureToastAdminDurationColumnOnce() {
  if (!ensureToastAdminDurationColumnPromise) {
    ensureToastAdminDurationColumnPromise = ensureToastAdminDurationColumn().catch(
      (err) => {
        ensureToastAdminDurationColumnPromise = null;
        throw err;
      },
    );
  }
  await ensureToastAdminDurationColumnPromise;
}

async function ensureToastFrontendDurationColumnOnce() {
  if (!ensureToastFrontendDurationColumnPromise) {
    ensureToastFrontendDurationColumnPromise =
      ensureToastFrontendDurationColumn().catch((err) => {
        ensureToastFrontendDurationColumnPromise = null;
        throw err;
      });
  }
  await ensureToastFrontendDurationColumnPromise;
}

function normalizeToastPosition(value: unknown): ToastTheme["position"] {
  return value === "top-left" ||
    value === "bottom-right" ||
    value === "bottom-left" ||
    value === "top-center" ||
    value === "bottom-center"
    ? (value as ToastTheme["position"])
    : "top-right";
}

async function readToastPosition(): Promise<ToastTheme["position"]> {
  try {
    await ensureToastPositionColumnOnce();
    const rows = await withPrismaRetry(() =>
      prisma.$queryRawUnsafe<Array<{ toastPosition: unknown }>>(
      'SELECT "toastPosition" FROM "AdminUiSettings" WHERE "id" = $1 LIMIT 1',
      SINGLETON_ID,
      ),
    );
    return normalizeToastPosition(rows?.[0]?.toastPosition);
  } catch {
    return DEFAULT_THEME.position;
  }
}

async function readToastAdminPosition(
  fallback: ToastTheme["position"],
): Promise<ToastTheme["position"]> {
  try {
    await ensureToastAdminPositionColumnOnce();
    const rows = await withPrismaRetry(() =>
      prisma.$queryRawUnsafe<Array<{ toastAdminPosition: unknown }>>(
        'SELECT "toastAdminPosition" FROM "AdminUiSettings" WHERE "id" = $1 LIMIT 1',
        SINGLETON_ID,
      ),
    );
    const raw = rows?.[0]?.toastAdminPosition;
    if (raw == null) return fallback;
    return normalizeToastPosition(raw);
  } catch {
    return fallback;
  }
}

async function readToastFrontendPosition(
  fallback: ToastTheme["position"],
): Promise<ToastTheme["position"]> {
  try {
    await ensureToastFrontendPositionColumnOnce();
    const rows = await withPrismaRetry(() =>
      prisma.$queryRawUnsafe<Array<{ toastFrontendPosition: unknown }>>(
        'SELECT "toastFrontendPosition" FROM "AdminUiSettings" WHERE "id" = $1 LIMIT 1',
        SINGLETON_ID,
      ),
    );
    const raw = rows?.[0]?.toastFrontendPosition;
    if (raw == null) return fallback;
    return normalizeToastPosition(raw);
  } catch {
    return fallback;
  }
}

async function readToastDurationMs(): Promise<number> {
  try {
    await ensureToastDurationColumnOnce();
    const rows = await withPrismaRetry(() =>
      prisma.$queryRawUnsafe<Array<{ toastDurationMs: unknown }>>(
        'SELECT "toastDurationMs" FROM "AdminUiSettings" WHERE "id" = $1 LIMIT 1',
        SINGLETON_ID,
      ),
    );
    const raw = rows?.[0]?.toastDurationMs;
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw)
          : Number.NaN;
    if (!Number.isFinite(n)) return DEFAULT_THEME.durationMs;
    return Math.min(30000, Math.max(1000, Math.floor(n)));
  } catch {
    return DEFAULT_THEME.durationMs;
  }
}

async function readToastAdminDurationMs(
  fallback: number,
): Promise<number> {
  try {
    await ensureToastAdminDurationColumnOnce();
    const rows = await withPrismaRetry(() =>
      prisma.$queryRawUnsafe<Array<{ toastAdminDurationMs: unknown }>>(
        'SELECT "toastAdminDurationMs" FROM "AdminUiSettings" WHERE "id" = $1 LIMIT 1',
        SINGLETON_ID,
      ),
    );
    const raw = rows?.[0]?.toastAdminDurationMs;
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw)
          : Number.NaN;
    if (!Number.isFinite(n)) return fallback;
    return Math.min(30000, Math.max(1000, Math.floor(n)));
  } catch {
    return fallback;
  }
}

async function readToastFrontendDurationMs(
  fallback: number,
): Promise<number> {
  try {
    await ensureToastFrontendDurationColumnOnce();
    const rows = await withPrismaRetry(() =>
      prisma.$queryRawUnsafe<Array<{ toastFrontendDurationMs: unknown }>>(
        'SELECT "toastFrontendDurationMs" FROM "AdminUiSettings" WHERE "id" = $1 LIMIT 1',
        SINGLETON_ID,
      ),
    );
    const raw = rows?.[0]?.toastFrontendDurationMs;
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw)
          : Number.NaN;
    if (!Number.isFinite(n)) return fallback;
    return Math.min(30000, Math.max(1000, Math.floor(n)));
  } catch {
    return fallback;
  }
}

async function readCtaForwardingRules(): Promise<CtaForwardingRule[]> {
  try {
    await ensureCtaForwardingColumnOnce();
    const rows = await withPrismaRetry(() =>
      prisma.$queryRawUnsafe<Array<{ ctaForwardingRules: unknown }>>(
      'SELECT "ctaForwardingRules" FROM "AdminUiSettings" WHERE "id" = $1 LIMIT 1',
      SINGLETON_ID,
      ),
    );
    return normalizeCtaForwardingRules(rows?.[0]?.ctaForwardingRules);
  } catch {
    return [];
  }
}

export async function getAdminUiSettings(): Promise<{
  settings: AdminUiSettings;
  theme: ToastTheme;
  editorFonts: EditorFontOption[];
}> {
  try {
    const settings = await withPrismaRetry(() => prisma.adminUiSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: {
        id: SINGLETON_ID,
        toastSuccessBg: DEFAULT_THEME.successBg,
        toastSuccessText: DEFAULT_THEME.successText,
        toastErrorBg: DEFAULT_THEME.errorBg,
        toastErrorText: DEFAULT_THEME.errorText,
        toastAlertBg: DEFAULT_THEME.alertBg,
        toastAlertText: DEFAULT_THEME.alertText,
        toastInfoBg: DEFAULT_THEME.infoBg,
        toastInfoText: DEFAULT_THEME.infoText,
        toastIconSize: DEFAULT_THEME.iconSize,
        toastSuccessTitle: DEFAULT_THEME.successTitle,
        toastSuccessBody: DEFAULT_THEME.successBody,
        toastErrorTitle: DEFAULT_THEME.errorTitle,
        toastErrorBody: DEFAULT_THEME.errorBody,
        toastAlertTitle: DEFAULT_THEME.alertTitle,
        toastAlertBody: DEFAULT_THEME.alertBody,
        editorFonts: DEFAULT_EDITOR_FONTS as any,
      },
    }));

    const toastPosition = await readToastPosition();
    const toastAdminPosition = await readToastAdminPosition(
      DEFAULT_THEME.adminPosition,
    );
    const toastFrontendPosition = await readToastFrontendPosition(
      DEFAULT_THEME.frontendPosition,
    );
    const toastDurationMs = await readToastDurationMs();
    const toastAdminDurationMs = await readToastAdminDurationMs(toastDurationMs);
    const toastFrontendDurationMs =
      await readToastFrontendDurationMs(toastDurationMs);
    const theme: ToastTheme = {
      position: toastPosition,
      adminPosition: toastAdminPosition,
      frontendPosition: toastFrontendPosition,
      durationMs: toastDurationMs,
      adminDurationMs: toastAdminDurationMs,
      frontendDurationMs: toastFrontendDurationMs,
      successBg: settings.toastSuccessBg || DEFAULT_THEME.successBg,
      successText: settings.toastSuccessText || DEFAULT_THEME.successText,
      errorBg: settings.toastErrorBg || DEFAULT_THEME.errorBg,
      errorText: settings.toastErrorText || DEFAULT_THEME.errorText,
      alertBg: settings.toastAlertBg || DEFAULT_THEME.alertBg,
      alertText: settings.toastAlertText || DEFAULT_THEME.alertText,
      infoBg: settings.toastInfoBg || DEFAULT_THEME.infoBg,
      infoText: settings.toastInfoText || DEFAULT_THEME.infoText,
      iconSize: settings.toastIconSize || DEFAULT_THEME.iconSize,
      successTitle:
        settings.toastSuccessTitle || DEFAULT_THEME.successTitle,
      successBody: settings.toastSuccessBody || DEFAULT_THEME.successBody,
      errorTitle: settings.toastErrorTitle || DEFAULT_THEME.errorTitle,
      errorBody: settings.toastErrorBody || DEFAULT_THEME.errorBody,
      alertTitle: settings.toastAlertTitle || DEFAULT_THEME.alertTitle,
      alertBody: settings.toastAlertBody || DEFAULT_THEME.alertBody,
    };

    const savedFonts = (settings.editorFonts as EditorFontOption[] | null) ?? [];
    const savedByLabel = new Map(
      savedFonts.map((f) => [
        f.label,
        { ...f, enabled: f.enabled !== false },
      ]),
    );
    const merged: EditorFontOption[] = DEFAULT_EDITOR_FONTS.map((d) => {
      const s = savedByLabel.get(d.label);
      if (s) {
        // Use any saved properties (like cssFamily and enabled),
        // but keep the default label as the key.
        savedByLabel.delete(d.label);
        return {
          ...d,
          ...s,
          enabled: s.enabled !== false,
        };
      }
      // Default fonts that were never customized are enabled by default.
      return { ...d, enabled: true };
    });
    // Any remaining saved fonts are purely custom (non-built-in) fonts.
    savedByLabel.forEach((f) => merged.push(f));
    const editorFonts = merged;

    const ctaForwardingRules = await readCtaForwardingRules();

    return {
      settings: { ...(settings as AdminUiSettings), ctaForwardingRules },
      theme,
      editorFonts,
    };
  } catch (err: any) {
    const code = typeof err?.code === "string" ? err.code : "";
    const message = String(err?.message ?? "");
    const name = typeof err?.name === "string" ? err.name : "";
    const shouldUseDefaults =
      code === "P2021" ||
      code === "ETIMEDOUT" ||
      code === "EDBHANDLEREXITED" ||
      /AdminUiSettings|DbHandler exited|timeout|DriverAdapterError/i.test(
        `${name} ${message}`,
      );
    if (shouldUseDefaults) {
      const settings: AdminUiSettings = {
        id: SINGLETON_ID,
        toastSuccessBg: DEFAULT_THEME.successBg,
        toastSuccessText: DEFAULT_THEME.successText,
        toastErrorBg: DEFAULT_THEME.errorBg,
        toastErrorText: DEFAULT_THEME.errorText,
        toastAlertBg: DEFAULT_THEME.alertBg,
        toastAlertText: DEFAULT_THEME.alertText,
        toastInfoBg: DEFAULT_THEME.infoBg,
        toastInfoText: DEFAULT_THEME.infoText,
        toastIconSize: DEFAULT_THEME.iconSize,
        toastSuccessTitle: DEFAULT_THEME.successTitle,
        toastSuccessBody: DEFAULT_THEME.successBody,
        toastErrorTitle: DEFAULT_THEME.errorTitle,
        toastErrorBody: DEFAULT_THEME.errorBody,
        toastAlertTitle: DEFAULT_THEME.alertTitle,
        toastAlertBody: DEFAULT_THEME.alertBody,
        toastPosition: DEFAULT_THEME.position,
        editorFonts: DEFAULT_EDITOR_FONTS as any,
        ctaForwardingRules: [],
      };
      return {
        settings,
        theme: DEFAULT_THEME,
        editorFonts: DEFAULT_EDITOR_FONTS.map((f) => ({ ...f, enabled: true })) as any,
      };
    }
    throw err;
  }
}

export async function updateAdminUiSettings(
  patch: Partial<Pick<
    AdminUiSettings,
    | "toastSuccessBg"
    | "toastSuccessText"
    | "toastErrorBg"
    | "toastErrorText"
    | "toastAlertBg"
    | "toastAlertText"
    | "toastInfoBg"
    | "toastInfoText"
    | "toastIconSize"
    | "toastSuccessTitle"
    | "toastSuccessBody"
    | "toastErrorTitle"
    | "toastErrorBody"
    | "toastAlertTitle"
    | "toastAlertBody"
    | "toastPosition"
    | "toastAdminPosition"
    | "toastFrontendPosition"
    | "toastDurationMs"
    | "toastAdminDurationMs"
    | "toastFrontendDurationMs"
    | "editorFonts"
    | "ctaForwardingRules"
  >>,
): Promise<{ settings: AdminUiSettings; theme: ToastTheme }> {
  try {
    const settings = await withPrismaRetry(() => prisma.adminUiSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {
        ...(patch.toastSuccessBg != null && {
          toastSuccessBg: patch.toastSuccessBg,
        }),
        ...(patch.toastSuccessText != null && {
          toastSuccessText: patch.toastSuccessText,
        }),
        ...(patch.toastErrorBg != null && {
          toastErrorBg: patch.toastErrorBg,
        }),
        ...(patch.toastErrorText != null && {
          toastErrorText: patch.toastErrorText,
        }),
        ...(patch.toastAlertBg != null && {
          toastAlertBg: patch.toastAlertBg,
        }),
        ...(patch.toastAlertText != null && {
          toastAlertText: patch.toastAlertText,
        }),
        ...(patch.toastInfoBg != null && {
          toastInfoBg: patch.toastInfoBg,
        }),
        ...(patch.toastInfoText != null && {
          toastInfoText: patch.toastInfoText,
        }),
        ...(patch.toastIconSize != null && {
          toastIconSize: patch.toastIconSize,
        }),
        ...(patch.toastSuccessTitle != null && {
          toastSuccessTitle: patch.toastSuccessTitle,
        }),
        ...(patch.toastSuccessBody != null && {
          toastSuccessBody: patch.toastSuccessBody,
        }),
        ...(patch.toastErrorTitle != null && {
          toastErrorTitle: patch.toastErrorTitle,
        }),
        ...(patch.toastErrorBody != null && {
          toastErrorBody: patch.toastErrorBody,
        }),
        ...(patch.toastAlertTitle != null && {
          toastAlertTitle: patch.toastAlertTitle,
        }),
        ...(patch.toastAlertBody != null && {
          toastAlertBody: patch.toastAlertBody,
        }),
        ...(patch.editorFonts != null && {
          editorFonts: patch.editorFonts as any,
        }),
      },
      create: {
        id: SINGLETON_ID,
        toastSuccessBg: patch.toastSuccessBg ?? DEFAULT_THEME.successBg,
        toastSuccessText: patch.toastSuccessText ?? DEFAULT_THEME.successText,
        toastErrorBg: patch.toastErrorBg ?? DEFAULT_THEME.errorBg,
        toastErrorText: patch.toastErrorText ?? DEFAULT_THEME.errorText,
        toastAlertBg: patch.toastAlertBg ?? DEFAULT_THEME.alertBg,
        toastAlertText: patch.toastAlertText ?? DEFAULT_THEME.alertText,
        toastInfoBg: patch.toastInfoBg ?? DEFAULT_THEME.infoBg,
        toastInfoText: patch.toastInfoText ?? DEFAULT_THEME.infoText,
        toastIconSize: patch.toastIconSize ?? DEFAULT_THEME.iconSize,
        toastSuccessTitle:
          patch.toastSuccessTitle ?? DEFAULT_THEME.successTitle,
        toastSuccessBody:
          patch.toastSuccessBody ?? DEFAULT_THEME.successBody,
        toastErrorTitle:
          patch.toastErrorTitle ?? DEFAULT_THEME.errorTitle,
        toastErrorBody: patch.toastErrorBody ?? DEFAULT_THEME.errorBody,
        toastAlertTitle:
          patch.toastAlertTitle ?? DEFAULT_THEME.alertTitle,
        toastAlertBody: patch.toastAlertBody ?? DEFAULT_THEME.alertBody,
        editorFonts: (patch.editorFonts as any) ?? (DEFAULT_EDITOR_FONTS as any),
      },
    }));

    if (patch.toastPosition != null) {
      await ensureToastPositionColumnOnce();
      await withPrismaRetry(() => prisma.$executeRawUnsafe(
        'UPDATE "AdminUiSettings" SET "toastPosition" = $1 WHERE "id" = $2',
        normalizeToastPosition(patch.toastPosition),
        SINGLETON_ID,
      ));
    }

    if (patch.toastAdminPosition != null) {
      await ensureToastAdminPositionColumnOnce();
      await withPrismaRetry(() =>
        prisma.$executeRawUnsafe(
          'UPDATE "AdminUiSettings" SET "toastAdminPosition" = $1 WHERE "id" = $2',
          normalizeToastPosition(patch.toastAdminPosition),
          SINGLETON_ID,
        ),
      );
    }

    if (patch.toastFrontendPosition != null) {
      await ensureToastFrontendPositionColumnOnce();
      await withPrismaRetry(() =>
        prisma.$executeRawUnsafe(
          'UPDATE "AdminUiSettings" SET "toastFrontendPosition" = $1 WHERE "id" = $2',
          normalizeToastPosition(patch.toastFrontendPosition),
          SINGLETON_ID,
        ),
      );
    }

    if (patch.toastDurationMs != null) {
      const clamped = Math.min(
        30000,
        Math.max(1000, Math.floor(patch.toastDurationMs)),
      );
      await ensureToastDurationColumnOnce();
      await withPrismaRetry(() =>
        prisma.$executeRawUnsafe(
          'UPDATE "AdminUiSettings" SET "toastDurationMs" = $1 WHERE "id" = $2',
          clamped,
          SINGLETON_ID,
        ),
      );
    }

    if (patch.toastAdminDurationMs != null) {
      const clamped = Math.min(
        30000,
        Math.max(1000, Math.floor(patch.toastAdminDurationMs)),
      );
      await ensureToastAdminDurationColumnOnce();
      await withPrismaRetry(() =>
        prisma.$executeRawUnsafe(
          'UPDATE "AdminUiSettings" SET "toastAdminDurationMs" = $1 WHERE "id" = $2',
          clamped,
          SINGLETON_ID,
        ),
      );
    }

    if (patch.toastFrontendDurationMs != null) {
      const clamped = Math.min(
        30000,
        Math.max(1000, Math.floor(patch.toastFrontendDurationMs)),
      );
      await ensureToastFrontendDurationColumnOnce();
      await withPrismaRetry(() =>
        prisma.$executeRawUnsafe(
          'UPDATE "AdminUiSettings" SET "toastFrontendDurationMs" = $1 WHERE "id" = $2',
          clamped,
          SINGLETON_ID,
        ),
      );
    }

    if (patch.ctaForwardingRules != null) {
      await ensureCtaForwardingColumnOnce();
      await withPrismaRetry(() => prisma.$executeRawUnsafe(
        'UPDATE "AdminUiSettings" SET "ctaForwardingRules" = $1 WHERE "id" = $2',
        JSON.stringify(normalizeCtaForwardingRules(patch.ctaForwardingRules)),
        SINGLETON_ID,
      ));
    }

    const toastPosition = await readToastPosition();
    const toastAdminPosition = await readToastAdminPosition(
      DEFAULT_THEME.adminPosition,
    );
    const toastFrontendPosition = await readToastFrontendPosition(
      DEFAULT_THEME.frontendPosition,
    );
    const toastDurationMs = await readToastDurationMs();
    const toastAdminDurationMs = await readToastAdminDurationMs(toastDurationMs);
    const toastFrontendDurationMs =
      await readToastFrontendDurationMs(toastDurationMs);
    const theme: ToastTheme = {
      position: toastPosition,
      adminPosition: toastAdminPosition,
      frontendPosition: toastFrontendPosition,
      durationMs: toastDurationMs,
      adminDurationMs: toastAdminDurationMs,
      frontendDurationMs: toastFrontendDurationMs,
      successBg: settings.toastSuccessBg || DEFAULT_THEME.successBg,
      successText: settings.toastSuccessText || DEFAULT_THEME.successText,
      errorBg: settings.toastErrorBg || DEFAULT_THEME.errorBg,
      errorText: settings.toastErrorText || DEFAULT_THEME.errorText,
      alertBg: settings.toastAlertBg || DEFAULT_THEME.alertBg,
      alertText: settings.toastAlertText || DEFAULT_THEME.alertText,
      infoBg: settings.toastInfoBg || DEFAULT_THEME.infoBg,
      infoText: settings.toastInfoText || DEFAULT_THEME.infoText,
      iconSize: settings.toastIconSize || DEFAULT_THEME.iconSize,
      successTitle:
        settings.toastSuccessTitle || DEFAULT_THEME.successTitle,
      successBody: settings.toastSuccessBody || DEFAULT_THEME.successBody,
      errorTitle: settings.toastErrorTitle || DEFAULT_THEME.errorTitle,
      errorBody: settings.toastErrorBody || DEFAULT_THEME.errorBody,
      alertTitle: settings.toastAlertTitle || DEFAULT_THEME.alertTitle,
      alertBody: settings.toastAlertBody || DEFAULT_THEME.alertBody,
    };

    const ctaForwardingRules = await readCtaForwardingRules();
    return {
      settings: { ...(settings as AdminUiSettings), ctaForwardingRules },
      theme,
    };
  } catch (err: any) {
    if (err?.code === "P2021" || /AdminUiSettings/.test(String(err?.message))) {
      const settings: AdminUiSettings = {
        id: SINGLETON_ID,
        toastSuccessBg: patch.toastSuccessBg ?? DEFAULT_THEME.successBg,
        toastSuccessText: patch.toastSuccessText ?? DEFAULT_THEME.successText,
        toastErrorBg: patch.toastErrorBg ?? DEFAULT_THEME.errorBg,
        toastErrorText: patch.toastErrorText ?? DEFAULT_THEME.errorText,
        toastAlertBg: patch.toastAlertBg ?? DEFAULT_THEME.alertBg,
        toastAlertText: patch.toastAlertText ?? DEFAULT_THEME.alertText,
        toastInfoBg: patch.toastInfoBg ?? DEFAULT_THEME.infoBg,
        toastInfoText: patch.toastInfoText ?? DEFAULT_THEME.infoText,
        toastIconSize: patch.toastIconSize ?? DEFAULT_THEME.iconSize,
        toastSuccessTitle:
          patch.toastSuccessTitle ?? DEFAULT_THEME.successTitle,
        toastSuccessBody:
          patch.toastSuccessBody ?? DEFAULT_THEME.successBody,
        toastErrorTitle:
          patch.toastErrorTitle ?? DEFAULT_THEME.errorTitle,
        toastErrorBody: patch.toastErrorBody ?? DEFAULT_THEME.errorBody,
        toastAlertTitle:
          patch.toastAlertTitle ?? DEFAULT_THEME.alertTitle,
        toastAlertBody: patch.toastAlertBody ?? DEFAULT_THEME.alertBody,
        toastPosition:
          patch.toastPosition != null
            ? normalizeToastPosition(patch.toastPosition)
            : DEFAULT_THEME.position,
        toastAdminPosition:
          patch.toastAdminPosition != null
            ? normalizeToastPosition(patch.toastAdminPosition)
            : DEFAULT_THEME.adminPosition,
        toastFrontendPosition:
          patch.toastFrontendPosition != null
            ? normalizeToastPosition(patch.toastFrontendPosition)
            : DEFAULT_THEME.frontendPosition,
        toastDurationMs:
          patch.toastDurationMs != null
            ? Math.min(
                30000,
                Math.max(1000, Math.floor(patch.toastDurationMs)),
              )
            : DEFAULT_THEME.durationMs,
        toastAdminDurationMs:
          patch.toastAdminDurationMs != null
            ? Math.min(
                30000,
                Math.max(1000, Math.floor(patch.toastAdminDurationMs)),
              )
            : DEFAULT_THEME.adminDurationMs,
        toastFrontendDurationMs:
          patch.toastFrontendDurationMs != null
            ? Math.min(
                30000,
                Math.max(1000, Math.floor(patch.toastFrontendDurationMs)),
              )
            : DEFAULT_THEME.frontendDurationMs,
        ctaForwardingRules: normalizeCtaForwardingRules(
          patch.ctaForwardingRules,
        ),
      };
      return { settings, theme: DEFAULT_THEME };
    }
    throw err;
  }
}

