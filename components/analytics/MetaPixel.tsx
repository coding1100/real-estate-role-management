"use client";

import { useEffect } from "react";
import { deferUntilInteractionOrTimeout } from "@/lib/deferNonCriticalScript";

interface MetaPixelProps {
  pixelId?: string | null;
}

declare global {
  interface Window {
    fbq?: MetaPixelStub;
    _fbq?: MetaPixelStub;
  }
}

type MetaPixelStub = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: MetaPixelStub;
  loaded: boolean;
  version: string;
};

function bootstrapMetaPixel(pixelId: string) {
  const w = window;
  if (w.fbq) return;

  const n = function (this: unknown, ...args: unknown[]) {
    if (n.callMethod) {
      n.callMethod.apply(n, args);
    } else {
      n.queue.push(args);
    }
  } as MetaPixelStub;

  if (!w._fbq) w._fbq = n;
  w.fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];

  const t = document.createElement("script");
  t.async = true;
  t.src = "https://connect.facebook.net/en_US/fbevents.js";
  t.setAttribute("data-meta-pixel-deferred", pixelId);
  const s = document.getElementsByTagName("script")[0];
  s?.parentNode?.insertBefore(t, s);

  n("init", pixelId);
  n("track", "PageView");
}

export function MetaPixel({ pixelId }: MetaPixelProps) {
  useEffect(() => {
    if (!pixelId) return;

    return deferUntilInteractionOrTimeout(() => {
      bootstrapMetaPixel(pixelId);
    });
  }, [pixelId]);

  if (!pixelId) return null;

  return (
    <noscript>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        height="1"
        width="1"
        style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
      />
    </noscript>
  );
}
