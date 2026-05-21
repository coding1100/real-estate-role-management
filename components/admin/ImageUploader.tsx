"use client";

import { useRef, useState } from "react";

interface ImageUploaderProps {
  label?: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  /**
   * Optional list of allowed MIME types. When omitted, defaults to
   * standard image formats (JPG, PNG, WEBP, SVG).
   */
  allowedTypes?: string[];
  /**
   * Optional override for the input accept attribute. When omitted,
   * defaults to "image/*".
   */
  accept?: string;
  /**
   * Optional custom error message when the file type is invalid.
   */
  typeErrorMessage?: string;
  /**
   * Optional Tailwind classes for the preview container.
   */
  previewClassName?: string;
  /** Tighter vertical spacing (e.g. admin sidebars). */
  compact?: boolean;
}

export function ImageUploader({
  label,
  value,
  onChange,
  allowedTypes,
  accept,
  typeErrorMessage,
  previewClassName,
  compact,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic client-side validation for image uploads
    const MAX_BYTES = 25 * 1024 * 1024; // 25MB
    const defaultAllowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/svg+xml",
    ];
    const typesToUse = allowedTypes && allowedTypes.length > 0 ? allowedTypes : defaultAllowedTypes;

    if (!typesToUse.includes(file.type)) {
      setError(
        typeErrorMessage ||
          "Please upload a JPG, PNG, WEBP, or SVG image.",
      );
      e.target.value = "";
      return;
    }

    if (file.size > MAX_BYTES) {
      setError("Image must be smaller than 25MB.");
      e.target.value = "";
      return;
    }

    setError(null);
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        throw new Error("Upload failed");
      }
      const data = (await res.json()) as { url: string };
      onChange(data.url);
    } catch (err) {
      console.error(err);
      setError("Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {label && (
        <p
          className={
            compact
              ? "text-xs font-medium text-zinc-700"
              : "text-md font-medium text-zinc-700"
          }
        >
          {label}
        </p>
      )}
      {value && (
        <div
          className={
            previewClassName ||
            "relative w-[200px] max-[768px]:w-full max-[768px]:max-w-[200px] overflow-hidden !rounded-md flex p-[10px] border border-[#eee] rounded-[2px]"
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Preview"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex items-center gap-2 text-md">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center !rounded-md border border-zinc-300 px-2 py-1 text-md font-medium text-zinc-800 hover:bg-zinc-100"
          disabled={loading}
        >
          {loading ? "Uploading..." : value ? "Change image" : "Upload image"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-md text-zinc-500 hover:text-zinc-800"
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept || "image/*"}
        className="hidden"
        onChange={handleFileChange}
      />
      {error && <p className="text-md text-red-500">{error}</p>}
    </div>
  );
}

