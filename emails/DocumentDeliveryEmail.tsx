import { Section, Text } from "@react-email/components";
import { EmailChrome } from "./EmailChrome";
import { emailTheme } from "./theme";

export type DocumentDeliveryEmailProps = {
  siteName: string;
  domainHostname: string;
  pageSlug: string;
  documentNames: string[];
  logoUrl?: string;
};

export default function DocumentDeliveryEmail({
  siteName,
  domainHostname,
  pageSlug,
  documentNames,
  logoUrl,
}: DocumentDeliveryEmailProps) {
  void logoUrl;
  const previewText = `Your documents from ${siteName}`;

  return (
    <EmailChrome
      previewText={previewText}
      title="Your requested documents"
      subtitle={`Thank you for connecting with ${siteName}`}
      brandName={siteName}
      footerNote="Documents are attached to this message. If you have questions, reply to this email or visit our website."
    >
      <Text
        style={{
          margin: "0 0 18px",
          fontSize: "15px",
          lineHeight: 1.65,
          color: emailTheme.ink,
        }}
      >
        We appreciate your interest. Below is a quick summary of your request on{" "}
        <strong>{domainHostname}</strong>.
      </Text>

      <Section
        style={{
          backgroundColor: emailTheme.accentSoft,
          borderRadius: "8px",
          padding: "16px 18px",
          marginBottom: "20px",
        }}
      >
        <Text style={{ margin: 0, fontSize: "13px", color: emailTheme.muted }}>
          Page
        </Text>
        <Text
          style={{
            margin: "4px 0 0",
            fontSize: "15px",
            fontWeight: 600,
            color: emailTheme.accentDark,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {pageSlug}
        </Text>
      </Section>

      <Text
        style={{
          margin: "0 0 10px",
          fontSize: "14px",
          fontWeight: 600,
          color: emailTheme.ink,
        }}
      >
        Included attachments
      </Text>

      {documentNames.map((name, i) => (
        <Section
          key={`${name}-${i}`}
          style={{
            padding: "10px 12px",
            marginBottom: "8px",
            backgroundColor: emailTheme.paper,
            borderRadius: "6px",
            borderLeft: `3px solid ${emailTheme.accent}`,
          }}
        >
          <Text style={{ margin: 0, fontSize: "14px", color: emailTheme.ink }}>
            {name}
          </Text>
        </Section>
      ))}
    </EmailChrome>
  );
}
