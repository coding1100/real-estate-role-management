"use client";

import { useMemo } from "react";

interface SeoEditorProps {
  title: string;
  description: string;
  url: string;
  onChange: (value: {
    seoTitle: string;
    seoDescription: string;
    canonicalUrl: string;
    noIndex: boolean;
  }) => void;
  values: {
    seoTitle?: string | null;
    seoDescription?: string | null;
    canonicalUrl?: string | null;
    noIndex?: boolean | null;
  };
}

export function SeoEditor({
  title,
  description,
  url,
  onChange,
  values,
}: SeoEditorProps) {
  const seoTitle = values.seoTitle ?? "";
  const seoDescription = values.seoDescription ?? description;
  const canonical = values.canonicalUrl ?? url;
  const noIndex = values.noIndex ?? false;

  const titleCount = seoTitle.length;
  const descCount = seoDescription.length;

  const titleColor = useMemo(() => {
    if (titleCount < 30 || titleCount > 60) return "text-amber-600";
    return "text-emerald-600";
  }, [titleCount]);

  const descColor = useMemo(() => {
    if (descCount < 70 || descCount > 170) return "text-amber-600";
    return "text-emerald-600";
  }, [descCount]);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-md font-medium text-zinc-700">
          SEO Page Title
        </label>
        <input
          className="block w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          value={seoTitle}
          placeholder={title || "SEO page title"}
          onChange={(e) =>
            onChange({
              seoTitle: e.target.value,
              seoDescription,
              canonicalUrl: canonical,
              noIndex,
            })
          }
        />
        <p className={`mt-1 text-[14px] ${titleColor}`}>
          {titleCount} characters (recommended 30–60)
        </p>
      </div>
      <div>
        <label className="mb-1 block text-md font-medium text-zinc-700">
          Meta Description
        </label>
        <textarea
          className="block w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          rows={3}
          value={seoDescription}
          onChange={(e) =>
            onChange({
              seoTitle,
              seoDescription: e.target.value,
              canonicalUrl: canonical,
              noIndex,
            })
          }
        />
        <p className={`mt-1 text-[14px] ${descColor}`}>
          {descCount} characters (recommended 70–170)
        </p>
      </div>
      <div>
        <label className="mb-1 block text-md font-medium text-zinc-700">
          Canonical URL
        </label>
        <input
          className="block w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          value={canonical}
          onChange={(e) =>
            onChange({
              seoTitle,
              seoDescription,
              canonicalUrl: e.target.value,
              noIndex,
            })
          }
        />
      </div>
      <label className="flex items-center gap-2 text-md text-zinc-700">
        <input
          type="checkbox"
          checked={noIndex}
          onChange={(e) =>
            onChange({
              seoTitle,
              seoDescription,
              canonicalUrl: canonical,
              noIndex: e.target.checked,
            })
          }
        />
        <span>Hide this page from search engines (noindex)</span>
      </label>
      <div className="!rounded-md border border-zinc-200 bg-white p-4">
        <p className="text-[13px] text-[#1a0dab]">
          {seoTitle || "Example title"}
        </p>
        <p className="text-[14px] text-[#006621]">{canonical}</p>
        <p className="mt-1 text-[13px] text-[#545454]">
          {seoDescription || "Example description snippet shown in search."}
        </p>
      </div>
    </div>
  );
}

