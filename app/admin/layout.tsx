import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  icons: {
    icon: [{ url: "/admin-favicon.png" }],
    shortcut: [{ url: "/admin-favicon.png" }],
    apple: [{ url: "/admin-favicon.png" }],
  },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}

