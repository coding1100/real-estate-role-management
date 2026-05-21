"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { wrapLegalSignsHtml } from "@/lib/richTextSigns";

/** Fields read from page hero layout JSON for Detailed Perspective profile column */
export type DetailedPerspectiveProfileLayout = {
  profileImageUrl?: string;
  profileImageWidthPx?: number;
  profileImageWidth?: number | string;
  profileImagePosition?: string;
  profileImageOffsetTop?: number;
  profileImageOffsetLeft?: number;
  profileSectionHtml?: string;
  profileName?: string;
  profileTitle?: string;
  profileRole?: string;
  profilePhone?: string;
  profileEmail?: string;
};

type Props = {
  layout: DetailedPerspectiveProfileLayout | null | undefined;
};

/**
 * Shared profile column for Detailed Perspective: image position, size (px), top/left nudge,
 * and rich text or structured fields. Used on single-page hero and multistep flows.
 */
export function DetailedPerspectiveProfileColumn({ layout }: Props) {
  const position = ((layout as any)?.profileImagePosition as string) || "right";
  const rawTop = Number((layout as any)?.profileImageOffsetTop ?? 0);
  const rawLeft = Number((layout as any)?.profileImageOffsetLeft ?? 0);
  const safeTop = Number.isFinite(rawTop) ? rawTop : 0;
  const safeLeft = Number.isFinite(rawLeft) ? rawLeft : 0;
  const offsetTop = Math.min(200, Math.max(-200, safeTop));
  const offsetLeft = Math.min(200, Math.max(-200, safeLeft));

  const rawWidth =
    (layout as any)?.profileImageWidthPx ?? (layout as any)?.profileImageWidth;
  const profileImageWidthPx =
    typeof rawWidth === "number"
      ? rawWidth
      : Number.parseInt(String(rawWidth ?? ""), 10);
  const safeWidthPx =
    Number.isFinite(profileImageWidthPx) && profileImageWidthPx > 0
      ? Math.min(Math.max(profileImageWidthPx, 80), 640)
      : 240;

  const isVertical = position === "top" || position === "bottom";
  const imageFirst = position === "left" || position === "top";

  const imageWrapStyle: CSSProperties = {
    position: "relative",
    top: offsetTop,
    left: offsetLeft,
    alignSelf: "flex-start",
    ...(isVertical
      ? imageFirst
        ? { marginBottom: offsetTop }
        : { marginTop: offsetTop }
      : imageFirst
        ? { marginRight: -offsetLeft, marginBottom: offsetTop }
        : { marginLeft: -offsetLeft, marginBottom: offsetTop }),
  };

  const imageBoxBaseClass =
    "max-w-full overflow-hidden rounded-[4px]";
  const imageBoxClass = isVertical
    ? `${imageBoxBaseClass} mx-auto`
    : `${imageBoxBaseClass} shrink-0`;

  return (
    <div className="w-full border border-[#cbb1a7ab] bg-white/0 px-[25px] pt-[30px] pb-[30px] max-[768px]:px-4">
      <div
        className={[
          "flex min-w-0 gap-4",
          isVertical ? "flex-col" : "flex-row",
          "max-[768px]:flex-col",
        ].join(" ")}
      >
        {layout?.profileImageUrl ? (
          <div
            className={[
              "min-w-0",
              imageFirst ? "order-1" : "order-2",
              "max-[768px]:order-1",
            ].join(" ")}
            style={imageWrapStyle}
          >
            <div
              className={imageBoxClass}
              style={{ width: `${safeWidthPx}px` }}
            >
              <Image
                src={layout.profileImageUrl as string}
                alt={(layout?.profileName as string) || "Profile"}
                width={1200}
                height={900}
                loading="lazy"
                className="h-auto w-full object-contain"
                style={{ borderRadius: "2px" }}
              />
            </div>
          </div>
        ) : null}

        <div
          className={[
            "min-w-0 break-words",
            imageFirst ? "order-2" : "order-1",
            "max-[768px]:order-2",
          ].join(" ")}
        >
          {layout?.profileSectionHtml?.trim() ? (
            <div
              className="text-sm text-zinc-800 font-serif leading-relaxed space-y-1.5"
              dangerouslySetInnerHTML={{
                __html: wrapLegalSignsHtml(layout.profileSectionHtml),
              }}
            />
          ) : (
            <>
              {layout?.profileName && (
                <h3 className="text-xl font-semibold text-zinc-800 font-serif leading-tight mb-[5px]">
                  {layout.profileName as string}
                </h3>
              )}
              {layout?.profileTitle && (
                <p className="text-sm text-zinc-700 font-serif leading-relaxed mb-[5px]">
                  {layout.profileTitle as string}
                </p>
              )}
              {layout?.profileRole && (
                <p className="text-sm text-zinc-600 font-serif leading-relaxed mb-[5px]">
                  {layout.profileRole as string}
                </p>
              )}
              <div className="space-y-1.5 pt-1">
                {layout?.profilePhone && (
                  <p className="text-sm text-zinc-700 font-serif flex items-center gap-2.5 leading-relaxed">
                    <span className="text-zinc-500 text-base">✆</span>
                    <span>{layout.profilePhone as string}</span>
                  </p>
                )}
                {layout?.profileEmail && (
                  <p className="text-sm text-zinc-700 font-serif flex items-center gap-2.5 leading-relaxed">
                    <span className="text-zinc-500 text-base">✉</span>
                    <span className="break-all">
                      {layout.profileEmail as string}
                    </span>
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
