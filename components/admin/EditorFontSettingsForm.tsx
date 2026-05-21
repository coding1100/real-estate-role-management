"use client";

import { useState, useTransition } from "react";
import type { EditorFontOption } from "@/lib/editorFonts";
import { isBuiltInEditorFont } from "@/lib/editorFonts";
import { useAdminToast } from "@/components/admin/useAdminToast";

interface EditorFontSettingsFormProps {
  initialFonts: EditorFontOption[];
}

export function EditorFontSettingsForm({
  initialFonts,
}: EditorFontSettingsFormProps) {
  const [fonts, setFonts] = useState<EditorFontOption[]>(initialFonts);
  const [isPending, startTransition] = useTransition();
  const { success, error } = useAdminToast();

  const builtIn = fonts.filter((f) => isBuiltInEditorFont(f));
  const custom = fonts.filter((f) => !isBuiltInEditorFont(f));

  const updateFont = (index: number, patch: Partial<EditorFontOption>) => {
    setFonts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeFont = (index: number) => {
    const font = fonts[index];
    if (isBuiltInEditorFont(font)) return;
    setFonts((prev) => prev.filter((_, i) => i !== index));
  };

  const addFont = () => {
    setFonts((prev) => [
      ...prev,
      {
        label: "New font",
        cssFamily: '"New Font", system-ui, sans-serif',
        enabled: true,
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/ui-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            editorFonts: fonts.map((f) => ({
              label: f.label,
              cssFamily: f.cssFamily,
              enabled: f.enabled !== false,
              importUrl:
                typeof (f as any).importUrl === "string" &&
                (f as any).importUrl.trim().length > 0
                  ? (f as any).importUrl.trim()
                  : undefined,
            })),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            (data && data.error) || "Failed to update editor font settings",
          );
        }
        success("Editor fonts updated.");
        // Reload to ensure RootLayout re-runs and new font imports are applied globally.
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      } catch (err) {
        console.error(err);
        error("Failed to update editor font settings.");
      }
    });
  };

  const extractFamilyFromUrl = (url: string): string | null => {
    try {
      const u = new URL(url);
      const familyParam = u.searchParams.get("family");
      if (!familyParam) return null;
      // family=Limelight or family=Playfair+Display:ital,wght@0,400;1,700
      const base = familyParam.split(":")[0]; // before axis part
      const name = base.replace(/\+/g, " ");
      return name || null;
    } catch {
      return null;
    }
  };

  const renderRow = (font: EditorFontOption, index: number) => {
    const builtInFont = isBuiltInEditorFont(font);
    return (
      <div
        className={`flex flex-col gap-3 rounded-lg border p-4 transition-colors md:flex-row md:items-center md:gap-4 ${
          font.enabled === false
            ? "border-zinc-200 bg-zinc-50/80"
            : "border-zinc-200 bg-white"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <label className="flex shrink-0 items-center gap-2">
            <span className="text-sm font-medium text-zinc-700">
              Include in editors
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={font.enabled !== false}
              onClick={() =>
                updateFont(index, { enabled: font.enabled === false })
              }
              className={`relative inline-flex h-6 w-10 shrink-0 !rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 ${
                font.enabled !== false
                  ? "border-zinc-900 bg-zinc-900"
                  : "border-zinc-300 bg-zinc-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  font.enabled !== false ? "translate-x-4" : "translate-x-0.5"
                }`}
                style={{ marginTop: 1 }}
              />
            </button>
          </label>
          <div className="min-w-0 flex-1 space-y-1">
            <input
              type="text"
              value={font.label}
              onChange={(e) => updateFont(index, { label: e.target.value })}
              readOnly={builtInFont}
              className={`w-full !rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-0 ${
                builtInFont
                  ? "border-zinc-200 bg-zinc-50 text-zinc-600"
                  : "border-zinc-300 text-zinc-900"
              }`}
              placeholder="Display name"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <input
              type="text"
              value={font.cssFamily}
              onChange={(e) => updateFont(index, { cssFamily: e.target.value })}
              className={`w-full !rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-0 ${
                builtInFont
                  ? "border-zinc-300 bg-white text-zinc-900"
                  : "border-zinc-300 text-zinc-900"
              }`}
              placeholder="CSS font-family"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1 md:basis-[30%]">
            <input
              type="text"
              value={font.importUrl ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                const patch: Partial<EditorFontOption> = {
                  importUrl: raw,
                };
                const family = extractFamilyFromUrl(raw);
                if (family) {
                  const currentCss = font.cssFamily?.trim() ?? "";
                  const autoDefault = `"${font.label}", system-ui, sans-serif`;
                  if (!currentCss || currentCss === autoDefault) {
                    patch.cssFamily = `"${family}", system-ui, sans-serif`;
                  }
                  if (!font.label || font.label === "New font") {
                    patch.label = family;
                  }
                }
                updateFont(index, patch);
              }}
              className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-0"
              placeholder="Google Fonts CSS URL (e.g. https://fonts.googleapis.com/css2?family=Limelight&display=swap)"
            />
          </div>
        </div>
        {!builtInFont && (
          <div className="flex shrink-0">
            <button
              type="button"
              onClick={() => removeFont(index)}
              className="!rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              title="Remove font"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/50 shadow-sm"
    >
      <div className="border-b border-zinc-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Editor fonts
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Choose which fonts appear in rich text editors. Built-in fonts
              cannot be removed; you can include or exclude them. Custom fonts
              can be added or removed.
            </p>
          </div>
          <div className="mt-2 flex shrink-0 gap-2 sm:mt-0">
            <button
              type="button"
              onClick={addFont}
              className="inline-flex items-center !rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              + Add custom font
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center !rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5">
        {builtIn.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-500">
              Built-in fonts (always in list, cannot be deleted)
            </h3>
            <div className="space-y-2">
              {fonts.map(
                (font, i) =>
                  isBuiltInEditorFont(font) && (
                    <div key={`builtin-${i}`}>{renderRow(font, i)}</div>
                  ),
              )}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-500">
            Custom fonts
          </h3>
          {custom.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500">
              No custom fonts. Click &quot;Add custom font&quot; to add one.
            </p>
          ) : (
            <div className="space-y-2">
              {fonts.map(
                (font, i) =>
                  !isBuiltInEditorFont(font) && (
                    <div key={`custom-${i}`}>{renderRow(font, i)}</div>
                  ),
              )}
            </div>
          )}
        </section>
      </div>
    </form>
  );
}
