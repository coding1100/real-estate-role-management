 "use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Toast, ToastClose, ToastViewport } from "@/components/ui/toast";
import type { ToastTheme } from "@/lib/uiSettings";

type ToastVariant = "default" | "destructive" | "alert" | "info";

export interface ToastOptions {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  duration?: number;
  variant?: ToastVariant;
}

type InternalToast = ToastOptions & {
  id: string;
};

interface ToastContextValue {
  toasts: InternalToast[];
  toast: (props: ToastOptions) => void;
  dismiss: (id: string) => void;
  theme: ToastTheme;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(
  undefined,
);

export function ToastProvider({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme?: ToastTheme;
}): React.ReactElement {
  const [toasts, setToasts] = React.useState<InternalToast[]>([]);

  const FALLBACK_THEME: ToastTheme = {
    position: "top-right",
    adminPosition: "top-right",
    frontendPosition: "top-right",
    durationMs: 5000,
    adminDurationMs: 5000,
    frontendDurationMs: 5000,
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

  const mergedTheme: ToastTheme = {
    position: theme?.position ?? FALLBACK_THEME.position,
    adminPosition: theme?.adminPosition ?? FALLBACK_THEME.adminPosition,
    frontendPosition:
      theme?.frontendPosition ?? FALLBACK_THEME.frontendPosition,
    durationMs: theme?.durationMs ?? FALLBACK_THEME.durationMs,
    adminDurationMs: theme?.adminDurationMs ?? FALLBACK_THEME.adminDurationMs,
    frontendDurationMs:
      theme?.frontendDurationMs ?? FALLBACK_THEME.frontendDurationMs,
    successBg: theme?.successBg ?? FALLBACK_THEME.successBg,
    successText: theme?.successText ?? FALLBACK_THEME.successText,
    errorBg: theme?.errorBg ?? FALLBACK_THEME.errorBg,
    errorText: theme?.errorText ?? FALLBACK_THEME.errorText,
    alertBg: theme?.alertBg ?? FALLBACK_THEME.alertBg,
    alertText: theme?.alertText ?? FALLBACK_THEME.alertText,
    infoBg: theme?.infoBg ?? FALLBACK_THEME.infoBg,
    infoText: theme?.infoText ?? FALLBACK_THEME.infoText,
    iconSize: theme?.iconSize ?? FALLBACK_THEME.iconSize,
    successTitle: theme?.successTitle ?? FALLBACK_THEME.successTitle,
    successBody: theme?.successBody ?? FALLBACK_THEME.successBody,
    errorTitle: theme?.errorTitle ?? FALLBACK_THEME.errorTitle,
    errorBody: theme?.errorBody ?? FALLBACK_THEME.errorBody,
    alertTitle: theme?.alertTitle ?? FALLBACK_THEME.alertTitle,
    alertBody: theme?.alertBody ?? FALLBACK_THEME.alertBody,
  };

  const toast = React.useCallback((props: ToastOptions) => {
    const id = props.id ?? Math.random().toString(36).slice(2);
    setToasts((current) => [...current, { ...props, id }]);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss, theme: mergedTheme }}>
      <ToastPrimitives.Provider
        swipeDirection="right"
        duration={mergedTheme.durationMs}
      >
        {children}
        {toasts.map((t) => {
          const isError = t.variant === "destructive";
          const isAlert = t.variant === "alert";
          const isInfo = t.variant === "info";
          const Icon = isError
            ? AlertTriangle
            : isAlert
            ? AlertTriangle
            : isInfo
            ? Info
            : CheckCircle2;

          const style: React.CSSProperties = isError
            ? {
                backgroundColor: mergedTheme.errorBg,
                color: mergedTheme.errorText,
              }
            : isAlert
            ? {
                backgroundColor: mergedTheme.alertBg,
                color: mergedTheme.alertText,
              }
            : isInfo
            ? {
                backgroundColor: mergedTheme.infoBg,
                color: mergedTheme.infoText,
              }
            : {
                backgroundColor: mergedTheme.successBg,
                color: mergedTheme.successText,
              };

          return (
            <Toast
              key={t.id}
              variant={t.variant ?? "default"}
              durationMs={t.duration ?? mergedTheme.durationMs}
              duration={t.duration ?? mergedTheme.durationMs}
              style={style}
              onOpenChange={(open: boolean) => {
                if (!open) dismiss(t.id);
              }}
            >
              <ToastClose aria-label="Close toast" />
              <div className="flex items-start gap-3">
                <Icon
                  className="mt-0.5"
                  style={{
                    width: mergedTheme.iconSize,
                    height: mergedTheme.iconSize,
                    color: isError
                      ? mergedTheme.errorText
                      : isAlert
                      ? mergedTheme.alertText
                      : isInfo
                      ? mergedTheme.infoText
                      : mergedTheme.successText,
                  }}
                />
                <div>
                  {t.title && (
                    <div className="font-semibold leading-snug">
                      {t.title}
                    </div>
                  )}
                  {t.description && (
                    <div className="mt-0.5 text-sm opacity-90">
                      {t.description}
                    </div>
                  )}
                </div>
              </div>
            </Toast>
          );
        })}
        <ToastViewport
          className={
            mergedTheme.position === "top-left"
              ? "left-4 right-auto top-4 sm:left-6 sm:top-6"
              : mergedTheme.position === "top-center"
                ? "left-1/2 right-auto top-4 -translate-x-1/2 sm:top-6"
                : mergedTheme.position === "bottom-right"
                  ? "bottom-4 left-auto right-4 top-auto sm:bottom-6 sm:right-6 sm:top-auto"
                  : mergedTheme.position === "bottom-left"
                    ? "bottom-4 left-4 right-auto top-auto sm:bottom-6 sm:left-6 sm:top-auto"
                    : mergedTheme.position === "bottom-center"
                      ? "bottom-4 left-1/2 right-auto top-auto -translate-x-1/2 sm:bottom-6"
                      : "right-4 top-4 sm:right-6 sm:top-6"
          }
        />
      </ToastPrimitives.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

