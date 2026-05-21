"use client";

import Image from "next/image";
import { useLayoutEffect, useState } from "react";
import type { CSSProperties } from "react";

/** Aligns with Tailwind `md:` / `max-[768px]` usage in hero sections. */
const MOBILE_MQ = "(max-width: 768px)";
const DESKTOP_QUALITY = 50;
const MOBILE_QUALITY = 38;

type HeroBackgroundImageProps = {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
  sizes?: string;
};

/**
 * Full-bleed hero background: desktop keeps DESKTOP_QUALITY; narrower viewports
 * use a lower quality to improve transfer size (Lighthouse "image delivery") without changing desktop.
 */
export function HeroBackgroundImage({
  src,
  alt,
  className,
  style,
  priority = true,
  sizes = "100vw",
}: HeroBackgroundImageProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const apply = () => setIsMobileViewport(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const quality = isMobileViewport ? MOBILE_QUALITY : DESKTOP_QUALITY;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      quality={quality}
      sizes={sizes}
      className={className}
      style={style}
    />
  );
}
