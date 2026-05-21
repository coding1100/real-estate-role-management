import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  getRequestHostnameFromHeaders,
  isPlatformHostname,
  isPreviewHostname,
} from "@/lib/hostnames";

export const metadata: Metadata = {
  icons: {
    icon: [{ url: "/admin-favicon.png" }],
    shortcut: [{ url: "/admin-favicon.png" }],
    apple: [{ url: "/admin-favicon.png" }],
  },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const hostname = await getRequestHostnameFromHeaders();
  if (!isPlatformHostname(hostname) && !isPreviewHostname(hostname)) {
    redirect("/");
  }

  return children;
}
