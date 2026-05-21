import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { emailTheme } from "./theme";

type EmailChromeProps = {
  previewText: string;
  title: string;
  subtitle?: ReactNode;
  logoUrl?: string;
  brandName?: string;
  children: ReactNode;
  footerNote?: string;
};

export function EmailChrome({
  previewText,
  title,
  subtitle,
  logoUrl,
  brandName,
  children,
  footerNote,
}: EmailChromeProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          margin: 0,
          padding: "32px 16px",
          backgroundColor: emailTheme.paper,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <Container
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            backgroundColor: emailTheme.card,
            borderRadius: "12px",
            overflow: "hidden",
            border: `1px solid ${emailTheme.line}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <Section
            style={{
              background: `linear-gradient(135deg, ${emailTheme.accent} 0%, ${emailTheme.accentDark} 100%)`,
              padding: "24px 28px",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              Real estate leads
            </Text>
            {logoUrl ? (
              <Img
                src={logoUrl}
                alt={brandName ? `${brandName} logo` : "Brand logo"}
                width={160}
                style={{
                  display: "block",
                  margin: "12px 0 0",
                  maxWidth: "220px",
                  height: "auto",
                }}
              />
            ) : null}
            <Heading
              as="h1"
              style={{
                margin: logoUrl ? "12px 0 0" : "10px 0 0",
                fontSize: "22px",
                fontWeight: 700,
                lineHeight: 1.25,
                color: "#ffffff",
              }}
            >
              {title}
            </Heading>
            {subtitle ? (
              <Text
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  lineHeight: 1.5,
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {subtitle}
              </Text>
            ) : null}
          </Section>

          <Section style={{ padding: "28px 28px 8px" }}>{children}</Section>

          <Section
            style={{
              padding: "20px 28px 28px",
              borderTop: `1px solid ${emailTheme.line}`,
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: "12px",
                lineHeight: 1.55,
                color: emailTheme.muted,
              }}
            >
              {footerNote ??
                "You received this because this address is set to receive lead notifications for your site."}
            </Text>
            <Text style={{ margin: "12px 0 0", fontSize: "12px", color: emailTheme.muted }}>
              Sent by your landing notifications system.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
