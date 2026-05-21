import { Hr, Link, Section, Text } from "@react-email/components";
import { EmailChrome } from "./EmailChrome";
import { emailTheme } from "./theme";

export type LeadFieldRow = { label: string; value: string };

export type LeadEmailCtaContext = {
  entryPageSlug: string;
  stepPageSlug: string;
  formCtaLabel: string;
  ctaManagementTitle: string | null;
  phase: "multistep_step" | "completed_lead";
};

export type NewLeadEmailProps = {
  leadType: string;
  domainHostname: string;
  pageSlug: string;
  brandName: string;
  logoUrl?: string;
  fieldRows: LeadFieldRow[];
  /** When set, shows which multistep step / CTA rule produced this email. */
  ctaNotificationContext?: LeadEmailCtaContext | null;
  audience?: "internal" | "requester";
};

export default function NewLeadEmail({
  leadType,
  domainHostname,
  pageSlug,
  brandName,
  logoUrl,
  fieldRows,
  ctaNotificationContext,
  audience = "internal",
}: NewLeadEmailProps) {
  void logoUrl;
  const previewText =
    audience === "requester"
      ? `We received your ${leadType} request`
      : `New ${leadType} lead — ${domainHostname} / ${pageSlug}`;
  const normalizedBrand = (brandName ?? "").trim().toLowerCase();
  const normalizedDomain = (domainHostname ?? "").trim().toLowerCase();
  const subtitleDomain =
    normalizedBrand && normalizedBrand !== normalizedDomain
      ? `${brandName} - ${domainHostname}`
      : domainHostname;
  const websiteUrl = `https://${domainHostname}`;

  return (
    <EmailChrome
      previewText={previewText}
      title={audience === "requester" ? "Request received" : `New ${leadType} lead`}
      subtitle={
        <>
          {audience === "requester" ? "Website: " : "Website: "}
          <Link
            href={websiteUrl}
            style={{
              color: "#ffffff",
              textDecoration: "underline",
            }}
          >
            {subtitleDomain}
          </Link>
        </>
      }
      brandName={brandName}
    >
      {audience === "internal" && ctaNotificationContext ? (
        <Section
          style={{
            backgroundColor: "#1e3a5f",
            borderRadius: "8px",
            padding: "14px 16px",
            marginBottom: "16px",
          }}
        >
          <Text
            style={{
              margin: 0,
              fontSize: "12px",
              fontWeight: 700,
              color: "#e2e8f0",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {ctaNotificationContext.phase === "multistep_step"
              ? "Multistep — intermediate step"
              : "Lead submission — CTA source"}
          </Text>
          <Text style={{ margin: "8px 0 0", fontSize: "14px", color: "#f8fafc", lineHeight: 1.5 }}>
            <strong style={{ color: "#94a3b8" }}>Entry URL page</strong>{" "}
            <span style={{ fontFamily: "ui-monospace, monospace" }}>
              {ctaNotificationContext.entryPageSlug}
            </span>
          </Text>
          <Text style={{ margin: "4px 0 0", fontSize: "14px", color: "#f8fafc", lineHeight: 1.5 }}>
            <strong style={{ color: "#94a3b8" }}>This step page</strong>{" "}
            <span style={{ fontFamily: "ui-monospace, monospace" }}>
              {ctaNotificationContext.stepPageSlug}
            </span>
          </Text>
          <Text style={{ margin: "4px 0 0", fontSize: "14px", color: "#f8fafc", lineHeight: 1.5 }}>
            <strong style={{ color: "#94a3b8" }}>CTA Management rule</strong>{" "}
            {ctaNotificationContext.ctaManagementTitle?.trim() || "—"}
          </Text>
        </Section>
      ) : null}

      <Section
        style={{
          backgroundColor: emailTheme.accentSoft,
          borderRadius: "8px",
          padding: "14px 16px",
          marginBottom: "20px",
        }}
      >
        <Text
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 600,
            color: emailTheme.accentDark,
            letterSpacing: "0.02em",
          }}
        >
          Submission details
        </Text>
        <Text style={{ margin: "6px 0 0", fontSize: "14px", color: emailTheme.ink }}>
          <strong style={{ color: emailTheme.muted }}>
            {audience === "requester" ? "Request page" : "Page"}
          </strong>{" "}
          <span style={{ fontFamily: "ui-monospace, monospace" }}>{pageSlug}</span>
        </Text>
      </Section>

      <Text
        style={{
          margin: "0 0 16px",
          fontSize: "15px",
          lineHeight: 1.6,
          color: emailTheme.ink,
        }}
      >
        {audience === "requester"
          ? "Thanks for reaching out. We received your request and our team will contact you shortly. A copy of your submitted details is below."
          : "Here is everything the visitor submitted. Reply directly to this email thread if your client supports it, or reach out using the contact details below."}
      </Text>

      <Hr style={{ borderColor: emailTheme.line, margin: "0 0 16px" }} />

      {fieldRows.length === 0 ? (
        <Text style={{ margin: 0, fontSize: "14px", color: emailTheme.muted, fontStyle: "italic" }}>
          No additional fields were submitted.
        </Text>
      ) : (
        fieldRows.map((row, i) => (
          <Section
            key={`${row.label}-${i}`}
            style={{
              marginBottom: "10px",
              paddingBottom: "10px",
              borderBottom:
                i < fieldRows.length - 1 ? `1px solid ${emailTheme.line}` : "none",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: emailTheme.muted,
              }}
            >
              {row.label}
            </Text>
            <Text
              style={{
                margin: "4px 0 0",
                fontSize: "15px",
                lineHeight: 1.5,
                color: emailTheme.ink,
                wordBreak: "break-word",
              }}
            >
              {row.value || "—"}
            </Text>
          </Section>
        ))
      )}
    </EmailChrome>
  );
}
