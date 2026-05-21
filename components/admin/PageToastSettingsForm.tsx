"use client";

import { useState, useTransition } from "react";
import { HexAlphaColorField } from "@/components/admin/HexAlphaColorField";

export type PageToastThemeOverride = {
  position: "top-right" | "top-left" | "top-center" | "bottom-right" | "bottom-left" | "bottom-center";
  durationMs: number;
  successBg: string;
  successText: string;
  errorBg: string;
  errorText: string;
  alertBg: string;
  alertText: string;
  infoBg: string;
  infoText: string;
  iconSize: number;
  successTitle: string;
  successBody: string;
  errorTitle: string;
  errorBody: string;
  alertTitle: string;
  alertBody: string;
};

interface PageToastSettingsFormProps {
  initialValue: PageToastThemeOverride | null;
  onSave: (value: PageToastThemeOverride | null) => Promise<void>;
}

const DEFAULT_LOCAL_TOAST: PageToastThemeOverride = {
  position: "top-right",
  durationMs: 5000,
  successBg: "#ecfdf3",
  successText: "#166534",
  errorBg: "#fef2f2",
  errorText: "#b91c1c",
  alertBg: "#fffbeb",
  alertText: "#92400e",
  infoBg: "#eff6ff",
  infoText: "#1d4ed8",
  iconSize: 24,
  successTitle: "Success",
  successBody: "Action completed successfully.",
  errorTitle: "Something went wrong",
  errorBody: "Please try again.",
  alertTitle: "Attention",
  alertBody: "Please review this information.",
};

export function PageToastSettingsForm({
  initialValue,
  onSave,
}: PageToastSettingsFormProps) {
  const [enabled, setEnabled] = useState<boolean>(!!initialValue);
  const [value, setValue] = useState<PageToastThemeOverride>(
    initialValue ?? DEFAULT_LOCAL_TOAST,
  );
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof PageToastThemeOverride>(
    key: K,
    nextValue: PageToastThemeOverride[K],
  ) {
    setValue((prev) => ({ ...prev, [key]: nextValue }));
  }

  function handleSave() {
    startTransition(async () => {
      await onSave(enabled ? value : null);
    });
  }

  return (
    <div className="space-y-4 !rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Toast design (Local)</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Applies only to this page. If disabled, global toast design is used.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Enable local override
        </label>
      </div>

      {enabled ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-600">
              Screen placement
            </label>
            <select
              value={value.position}
              onChange={(e) =>
                update(
                  "position",
                  e.target.value as PageToastThemeOverride["position"],
                )
              }
              className="mt-1 w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="top-right">Top right</option>
              <option value="top-left">Top left</option>
              <option value="top-center">Top center</option>
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-center">Bottom center</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600">
              Visibility time (seconds)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={Math.round((value.durationMs ?? 5000) / 1000)}
              onChange={(e) => {
                const seconds = Number(e.target.value) || 0;
                const clamped = Math.min(30, Math.max(1, seconds));
                update("durationMs", clamped * 1000);
              }}
              className="mt-1 w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-600">Success background</label>
            <HexAlphaColorField
              value={value.successBg}
              onChange={(hex) => update("successBg", hex || value.successBg)}
              fallback="#ecfdf3ff"
              placeholder="#ecfdf3ff"
              label="Success background"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-600">Success text</label>
            <HexAlphaColorField
              value={value.successText}
              onChange={(hex) => update("successText", hex || value.successText)}
              fallback="#166534ff"
              placeholder="#166534ff"
              label="Success text"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-600">Error background</label>
            <HexAlphaColorField
              value={value.errorBg}
              onChange={(hex) => update("errorBg", hex || value.errorBg)}
              fallback="#fef2f2ff"
              placeholder="#fef2f2ff"
              label="Error background"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-600">Error text</label>
            <HexAlphaColorField
              value={value.errorText}
              onChange={(hex) => update("errorText", hex || value.errorText)}
              fallback="#b91c1cff"
              placeholder="#b91c1cff"
              label="Error text"
            />
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setEnabled(false);
            setValue(DEFAULT_LOCAL_TOAST);
          }}
          className="!rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Reset to global
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="!rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save local toast"}
        </button>
      </div>
    </div>
  );
}
