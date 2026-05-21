"use client";
import Script from "next/script";

interface GoogleAnalyticsProps {
  measurementId?: string | null;
}

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  if (!measurementId) return null;
  return (
    <>
      <Script
        id={`ga4-lib-${measurementId}`}
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script
        id={`ga4-config-${measurementId}`}
        strategy="afterInteractive"
      >{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = window.gtag || gtag;
        gtag('js', new Date());
        gtag('config', '${measurementId}');
      `}</Script>
    </>
  );
}
