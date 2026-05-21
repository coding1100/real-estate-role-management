import { render } from "@react-email/render";
import DocumentDeliveryEmail from "@/emails/DocumentDeliveryEmail";
import NewLeadEmail, {
  type LeadEmailCtaContext,
  type LeadFieldRow,
} from "@/emails/NewLeadEmail";

function resolveAbsoluteEmailAssetUrl(url?: string | null): string | undefined {
  const raw = (url ?? "").trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;

  const base =
    (process.env.NEXT_PUBLIC_APP_URL ?? "").trim() ||
    (process.env.NEXTAUTH_URL ?? "").trim();
  if (!base) return undefined;

  try {
    return new URL(raw.startsWith("/") ? raw : `/${raw}`, base).toString();
  } catch {
    return undefined;
  }
}

export function formLinesToFieldRows(lines: string[]): LeadFieldRow[] {
  return lines.map((line) => {
    const idx = line.indexOf(": ");
    if (idx === -1) return { label: "Field", value: line };
    return {
      label: line.slice(0, idx).trim() || "Field",
      value: line.slice(idx + 2).trim(),
    };
  });
}

export type { LeadEmailCtaContext };

export async function renderNewLeadEmailHtml(props: {
  leadType: string;
  domainHostname: string;
  pageSlug: string;
  brandName: string;
  logoUrl?: string | null;
  fieldRows: LeadFieldRow[];
  ctaNotificationContext?: LeadEmailCtaContext | null;
  audience?: "internal" | "requester";
}): Promise<{ html: string; text: string }> {
  const absoluteLogoUrl = resolveAbsoluteEmailAssetUrl(props.logoUrl);
  const el = (
    <NewLeadEmail
      leadType={props.leadType}
      domainHostname={props.domainHostname}
      pageSlug={props.pageSlug}
      brandName={props.brandName}
      logoUrl={absoluteLogoUrl}
      fieldRows={props.fieldRows}
      ctaNotificationContext={props.ctaNotificationContext ?? null}
      audience={props.audience ?? "internal"}
    />
  );
  const [html, text] = await Promise.all([
    render(el),
    render(el, { plainText: true }),
  ]);
  return { html, text };
}

export async function renderDocumentDeliveryEmailHtml(props: {
  siteName: string;
  domainHostname: string;
  pageSlug: string;
  documentNames: string[];
  logoUrl?: string | null;
}): Promise<{ html: string; text: string }> {
  const absoluteLogoUrl = resolveAbsoluteEmailAssetUrl(props.logoUrl);
  const el = (
    <DocumentDeliveryEmail
      siteName={props.siteName}
      domainHostname={props.domainHostname}
      pageSlug={props.pageSlug}
      documentNames={props.documentNames}
      logoUrl={absoluteLogoUrl}
    />
  );
  const [html, text] = await Promise.all([
    render(el),
    render(el, { plainText: true }),
  ]);
  return { html, text };
}
