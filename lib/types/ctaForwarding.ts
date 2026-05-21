export interface CtaForwardingDocument {
  name: string;
  url: string;
  autoSend?: boolean;
  mimeType?: string;
  /**
   * Cloudinary metadata for reliable delivery.
   * When Cloudinary delivery is restricted (ACL/auth), `url` may be blocked (401).
   * If `publicId` is present we can generate a signed delivery URL server-side.
   */
  publicId?: string;
  format?: string;
}

export interface CtaForwardingNotifyEmail {
  email: string;
  enabled?: boolean;
  kind?: "cc" | "bcc";
}

export interface CtaForwardingRule {
  ctaTitle: string;
  deliveryMode?: "documents_with_notify" | "notify_only_form_data";
  forwardUrl?: string;
  forwardEnabled?: boolean;
  /** Optional Resend template ID (tpl_...) used for CTA document emails. */
  resendTemplateId?: string;
  /** Optional display name for the selected template in settings UI. */
  resendTemplateName?: string;
  /**
   * Optional list of documents associated with this CTA.
   * Used by Settings UI to show per-CTA document rows (auto-send, icons, etc.).
   */
  documents?: CtaForwardingDocument[];
  /**
   * Optional list of notification recipients associated with this CTA.
   * When present, this can be used to override or extend domain-level notifyEmail.
   */
  notifyEmails?: CtaForwardingNotifyEmail[];
}

export function sanitizeCtaTitle(value: string): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCtaTitleKey(value: string): string {
  return sanitizeCtaTitle(value).toLowerCase();
}

