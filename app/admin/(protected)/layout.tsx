import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminUiSettings } from "@/lib/uiSettings";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Admin - Real Estate",
  icons: {
    icon: [{ url: "/admin-favicon.png" }],
    shortcut: [{ url: "/admin-favicon.png" }],
    apple: [{ url: "/admin-favicon.png" }],
  },
};

export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerAuthSession();
  if (!session) {
    redirect("/admin/login");
  }

  const { theme } = await getAdminUiSettings();
  const adminToastTheme = {
    ...theme,
    position: theme.adminPosition ?? theme.position,
    durationMs: theme.adminDurationMs ?? theme.durationMs,
  };
  let archivedCount = 0;
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*) AS "count"
      FROM "LandingPage" lp
      WHERE lp."deletedAt" IS NOT NULL
    `;
    const raw = rows[0]?.count ?? 0;
    archivedCount = Number(raw);
  } catch {
    archivedCount = 0;
  }

  return (
    <AdminShell
      userEmail={session.user?.email}
      toastTheme={adminToastTheme}
      archivedWithLeadsCount={archivedCount}
    >
      {children}
    </AdminShell>
  );
}

