"use client";

import { useState, useTransition } from "react";
import type { ToastTheme } from "@/lib/uiSettings";
import { useAdminToast } from "@/components/admin/useAdminToast";
import { HexAlphaColorField } from "@/components/admin/HexAlphaColorField";

interface ToastSettingsFormProps {
  initialTheme: ToastTheme;
}

export function ToastSettingsForm({ initialTheme }: ToastSettingsFormProps) {
  const [theme, setTheme] = useState<ToastTheme>(initialTheme);
  const [isPending, startTransition] = useTransition();
  const { success, error } = useAdminToast();

  function update<K extends keyof ToastTheme>(key: K, value: string | number) {
    setTheme((prev) => ({ ...prev, [key]: value } as ToastTheme));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/ui-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toastSuccessBg: theme.successBg,
            toastSuccessText: theme.successText,
            toastErrorBg: theme.errorBg,
            toastErrorText: theme.errorText,
            toastAlertBg: theme.alertBg,
            toastAlertText: theme.alertText,
            toastInfoBg: theme.infoBg,
            toastInfoText: theme.infoText,
            toastIconSize: theme.iconSize,
            toastSuccessTitle: theme.successTitle,
            toastSuccessBody: theme.successBody,
            toastErrorTitle: theme.errorTitle,
            toastErrorBody: theme.errorBody,
            toastAlertTitle: theme.alertTitle,
            toastAlertBody: theme.alertBody,
            toastAdminPosition: theme.adminPosition,
            toastFrontendPosition: theme.frontendPosition,
            toastDurationMs: theme.durationMs,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            (data && data.error) || "Failed to update toast settings",
          );
        }
        success("Toast design updated.");
        // Force a full reload so the new toast settings apply everywhere.
        window.location.reload();
      } catch (err) {
        console.error(err);
        error("Failed to update toast settings.");
      }
    });
  }

  function resetDefaults() {
    setTheme({
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
      position: "top-right",
      adminPosition: "top-right",
      frontendPosition: "top-right",
      durationMs: 5000,
      adminDurationMs: 5000,
      frontendDurationMs: 5000,
    });
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <form
        onSubmit={handleSubmit}
        className="space-y-5 !rounded-md border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            Toast design
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Control the colors used for success and error toasts across admin
            and landing pages.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <h3 className="text-sm font-medium text-zinc-800">Toast position</h3>
            <div className="!rounded-md bg-zinc-50 p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-600">
                    Screen placement
                  </label>
                  <select
                    value={theme.position}
                    onChange={(e) => update("position", e.target.value)}
                    className="mt-1 w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
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
                    value={Math.round((theme.durationMs ?? 5000) / 1000)}
                    onChange={(e) => {
                      const seconds = Number(e.target.value) || 0;
                      const clamped = Math.min(30, Math.max(1, seconds));
                      update("durationMs", clamped * 1000);
                    }}
                    className="mt-1 w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    How long toasts stay visible before auto-hide.
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* Success toast configuration */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-800">Success toast</h3>
            <div className="space-y-3 !rounded-md bg-zinc-50 p-3">
              <label className="block text-xs font-medium text-zinc-600">
                Background color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={theme.successBg}
                  onChange={(e) => update("successBg", e.target.value)}
                  className="w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  placeholder="#ecfdf3"
                />
              </div>
              <div className="mt-2">
                <HexAlphaColorField
                  value={theme.successBg}
                  onChange={(hex) => update("successBg", hex || theme.successBg)}
                  fallback="#ecfdf3ff"
                  placeholder="#ecfdf3ff"
                  label="Success background"
                />
              </div>
              <label className="mt-2 block text-xs font-medium text-zinc-600">
                Text color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={theme.successText}
                  onChange={(e) => update("successText", e.target.value)}
                  className="w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  placeholder="#166534"
                />
              </div>
              <div className="mt-2">
                <HexAlphaColorField
                  value={theme.successText}
                  onChange={(hex) =>
                    update("successText", hex || theme.successText)
                  }
                  fallback="#166534ff"
                  placeholder="#166534ff"
                  label="Success text"
                />
              </div>
            </div>
          </div>

          {/* Error toast configuration */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-800">Error toast</h3>
            <div className="space-y-3 !rounded-md bg-zinc-50 p-3">
              <label className="block text-xs font-medium text-zinc-600">
                Background color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={theme.errorBg}
                  onChange={(e) => update("errorBg", e.target.value)}
                  className="w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  placeholder="#fef2f2"
                />
              </div>
              <div className="mt-2">
                <HexAlphaColorField
                  value={theme.errorBg}
                  onChange={(hex) => update("errorBg", hex || theme.errorBg)}
                  fallback="#fef2f2ff"
                  placeholder="#fef2f2ff"
                  label="Error background"
                />
              </div>
              <label className="mt-2 block text-xs font-medium text-zinc-600">
                Text color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={theme.errorText}
                  onChange={(e) => update("errorText", e.target.value)}
                  className="w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  placeholder="#b91c1c"
                />
              </div>
              <div className="mt-2">
                <HexAlphaColorField
                  value={theme.errorText}
                  onChange={(hex) =>
                    update("errorText", hex || theme.errorText)
                  }
                  fallback="#b91c1cff"
                  placeholder="#b91c1cff"
                  label="Error text"
                />
              </div>
            </div>
          </div>

          {/* Alert toast configuration */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-800">Alert toast</h3>
            <div className="space-y-3 !rounded-md bg-zinc-50 p-3">
              <p className="text-xs text-zinc-600">
                Alert toasts are used for important warnings or non‑blocking
                alerts.
              </p>
              <label className="block text-xs font-medium text-zinc-600">
                Background color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={theme.alertBg}
                  onChange={(e) => update("alertBg", e.target.value)}
                  className="w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  placeholder="#fffbeb"
                />
              </div>
              <div className="mt-2">
                <HexAlphaColorField
                  value={theme.alertBg}
                  onChange={(hex) => update("alertBg", hex || theme.alertBg)}
                  fallback="#fffbebff"
                  placeholder="#fffbebff"
                  label="Alert background"
                />
              </div>
              <label className="mt-2 block text-xs font-medium text-zinc-600">
                Text color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={theme.alertText}
                  onChange={(e) => update("alertText", e.target.value)}
                  className="w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  placeholder="#92400e"
                />
              </div>
              <div className="mt-2">
                <HexAlphaColorField
                  value={theme.alertText}
                  onChange={(hex) =>
                    update("alertText", hex || theme.alertText)
                  }
                  fallback="#92400eff"
                  placeholder="#92400eff"
                  label="Alert text"
                />
              </div>
             
            </div>
          </div>

          {/* Info toast configuration */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-800">Info toast</h3>
            <div className="space-y-3 !rounded-md bg-zinc-50 p-3">
              <p className="text-xs text-zinc-600">
                Info toasts communicate neutral information.
              </p>
              <label className="block text-xs font-medium text-zinc-600">
                Background color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={theme.infoBg}
                  onChange={(e) => update("infoBg", e.target.value)}
                  className="w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  placeholder="#eff6ff"
                />
              </div>
              <div className="mt-2">
                <HexAlphaColorField
                  value={theme.infoBg}
                  onChange={(hex) => update("infoBg", hex || theme.infoBg)}
                  fallback="#eff6ffff"
                  placeholder="#eff6ffff"
                  label="Info background"
                />
              </div>
              <label className="mt-2 block text-xs font-medium text-zinc-600">
                Text color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={theme.infoText}
                  onChange={(e) => update("infoText", e.target.value)}
                  className="w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  placeholder="#1d4ed8"
                />
              </div>
              <div className="mt-2">
                <HexAlphaColorField
                  value={theme.infoText}
                  onChange={(hex) =>
                    update("infoText", hex || theme.infoText)
                  }
                  fallback="#1d4ed8ff"
                  placeholder="#1d4ed8ff"
                  label="Info text"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={resetDefaults}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Reset to defaults
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 !rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div className="space-y-4 !rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            Live preview
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            This is how your toasts will appear on admin pages and public
            landing pages.
          </p>
        </div>
        <div className="space-y-3">
          <div
            className="flex items-start gap-3 !rounded-md border px-3 py-2 text-sm shadow-sm"
            style={{
              backgroundColor: theme.successBg,
              color: theme.successText,
              borderColor: theme.successBg,
            }}
          >
            <span
              className="mt-0.5 rounded-full bg-white/60 text-center text-[11px] font-bold leading-6"
              style={{
                width: theme.iconSize,
                height: theme.iconSize,
                color: "#166534",
              }}
            >
              ✓
            </span>
            <div>
              <div className="font-semibold">{theme.successTitle}</div>
              <div className="mt-0.5 opacity-90">{theme.successBody}</div>
            </div>
          </div>

          {/* Info toast preview (uses success colors) */}
          <div
            className="flex items-start gap-3 !rounded-md border px-3 py-2 text-sm shadow-sm"
            style={{
              backgroundColor: theme.infoBg,
              color: theme.infoText,
              borderColor: theme.infoBg,
            }}
          >
            <span
              className="mt-0.5 rounded-full bg-white/60 text-center text-[11px] font-bold leading-6"
              style={{
                width: theme.iconSize,
                height: theme.iconSize,
                color: theme.infoText,
              }}
            >
              i
            </span>
            <div>
              <div className="font-semibold">Info toast</div>
              <div className="mt-0.5 opacity-90">
                This is an informational message. This is a preview only.
              </div>
            </div>
          </div>

          <div
            className="flex items-start gap-3 !rounded-md border px-3 py-2 text-sm shadow-sm"
            style={{
              backgroundColor: theme.errorBg,
              color: theme.errorText,
              borderColor: theme.errorBg,
            }}
          >
            <span
              className="mt-0.5 rounded-full bg-white/60 text-center text-[11px] font-bold leading-6"
              style={{
                width: theme.iconSize,
                height: theme.iconSize,
                color: "#b91c1c",
              }}
            >
              !
            </span>
            <div>
              <div className="font-semibold">{theme.errorTitle}</div>
              <div className="mt-0.5 opacity-90">{theme.errorBody}</div>
            </div>
          </div>
          <div
            className="flex items-start gap-3 !rounded-md border px-3 py-2 text-sm shadow-sm"
            style={{
              backgroundColor: theme.alertBg,
              color: theme.alertText,
              borderColor: theme.alertBg,
            }}
          >
            <span
              className="mt-0.5 rounded-full bg-white/60 text-center text-[11px] font-bold leading-6"
              style={{
                width: theme.iconSize,
                height: theme.iconSize,
                color: "#92400e",
              }}
            >
              !
            </span>
            <div>
              <div className="font-semibold">Alert toast</div>
              <div className="mt-0.5 opacity-90">
                Please review this information. This is a preview only.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

