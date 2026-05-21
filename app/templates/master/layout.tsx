import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/use-toast";
import { getAdminUiSettings } from "@/lib/uiSettings";

export default async function MasterTemplatesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { theme } = await getAdminUiSettings();
  const frontendToastTheme = {
    ...theme,
    position: theme.frontendPosition ?? theme.position,
    durationMs: theme.frontendDurationMs ?? theme.durationMs,
  };
  return <ToastProvider theme={frontendToastTheme}>{children}</ToastProvider>;
}

