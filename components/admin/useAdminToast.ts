"use client";

import { useToast } from "@/components/ui/use-toast";

type ToastKind = "success" | "error" | "info" | "alert";

export function useAdminToast() {
  const { toast, theme } = useToast();

  function show(kind: ToastKind, description?: string, title?: string) {
    if (kind === "success") {
      toast({
        title: title ?? theme.successTitle,
        description: description ?? theme.successBody,
        variant: "default",
      });
      return;
    }
    if (kind === "error") {
      toast({
        title: title ?? theme.errorTitle,
        description: description ?? theme.errorBody,
        variant: "destructive",
      });
      return;
    }
    if (kind === "alert") {
      toast({
        title: title ?? theme.alertTitle,
        description: description ?? theme.alertBody,
        variant: "alert",
      });
      return;
    }
    toast({
      title: title ?? "Info",
      description:
        description ?? "This is an informational message.",
      variant: "info",
    });
  }

  return {
    success: (description?: string, title?: string) =>
      show("success", description, title),
    error: (description?: string, title?: string) =>
      show("error", description, title),
    alert: (description?: string, title?: string) =>
      show("alert", description, title),
    info: (description?: string, title?: string) =>
      show("info", description, title),
  };
}

