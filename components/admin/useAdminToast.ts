"use client";

import { useToast } from "@/components/ui/use-toast";
import {
  apiErrorTitle,
  getApiErrorMessage,
  parseApiErrorBody,
  type ApiErrorBody,
} from "@/lib/apiMessages";

type ToastKind = "success" | "error" | "info" | "alert";

export function useAdminToast() {
  const { toast, theme } = useToast();

  function show(kind: ToastKind, title?: string, description?: string) {
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

  function apiError(
    res: Response,
    body?: ApiErrorBody | null,
    fallbackDescription?: string,
  ) {
    const title = apiErrorTitle(res.status);
    const description = getApiErrorMessage(
      res.status,
      body ?? undefined,
      fallbackDescription,
    );
    show("error", title, description);
  }

  async function apiErrorFromResponse(
    res: Response,
    parsed?: unknown,
    fallbackDescription?: string,
  ) {
    const body = await parseApiErrorBody(res, parsed);
    apiError(res, body, fallbackDescription);
  }

  return {
    success: (title: string, description?: string) =>
      show("success", title, description),
    error: (title: string, description?: string) =>
      show("error", title, description),
    alert: (title: string, description?: string) =>
      show("alert", title, description),
    info: (title: string, description?: string) =>
      show("info", title, description),
    apiError,
    apiErrorFromResponse,
  };
}

