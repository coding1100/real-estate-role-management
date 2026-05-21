"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Globe2,
  FileText,
  Recycle,
  Layers,
  Menu,
  LogOut,
  Settings,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { ToastProvider } from "@/components/ui/use-toast";
import type { ToastTheme } from "@/lib/uiSettings";

interface AdminShellProps {
  children: ReactNode;
  userEmail?: string | null;
  toastTheme?: ToastTheme;
  archivedWithLeadsCount?: number;
}

/** Keep /admin/pages and /admin/pages-2 active states isolated. */
function navLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/admin/pages") {
    if (pathname.startsWith("/admin/pages-2")) return false;
    return (
      pathname === "/admin/pages" || pathname.startsWith("/admin/pages/")
    );
  }
  if (href === "/admin/pages-2") {
    return (
      pathname === "/admin/pages-2" ||
      pathname.startsWith("/admin/pages-2/") &&
        !pathname.startsWith("/admin/pages-2/archived") ||
      pathname.startsWith("/admin/pages/")
    );
  }
  if (href === "/admin/pages-2/archived") {
    return (
      pathname === "/admin/pages-2/archived" ||
      pathname.startsWith("/admin/pages-2/archived/")
    );
  }
  if (href !== "/admin" && pathname.startsWith(`${href}/`)) return true;
  return false;
}

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/domains", label: "Domains", icon: Globe2 },
  // { href: "/admin/pages", label: "Landing Pages", icon: FileText },
  { href: "/admin/pages-2", label: "Landing Pages", icon: FileText },
  { href: "/admin/pages-2/archived", label: "Archived Pages", icon: Recycle },
  { href: "/admin/templates", label: "Templates", icon: Layers },
  // { href: "/admin/webhooks", label: "Webhooks", icon: RadioTower },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({
  children,
  userEmail,
  toastTheme,
  archivedWithLeadsCount = 0,
}: AdminShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <ToastProvider theme={toastTheme}>
    <div className="admin-root h-screen bg-zinc-50 flex flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 md:h-9 md:w-9"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold tracking-tight text-zinc-900">
              Admin
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-md text-zinc-500 max-[768px]:truncate max-[768px]:max-w-[140px] max-[768px]:text-xs">
              {userEmail}
            </div>
            <button
              type="button"
              onClick={() =>
                signOut({
                  callbackUrl: "/admin/login",
                })
              }
              className="inline-flex items-center justify-center gap-1.5 !rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full flex-1 gap-6 px-4 py-6 overflow-auto min-w-0 max-[768px]:min-w-0">
        <aside
          className={`hidden h-full overflow-y-auto !rounded-md bg-white/80 p-2 shadow-sm ring-1 ring-zinc-100 backdrop-blur md:block transition-all duration-200 ${
            collapsed ? "w-[52px]" : "w-56"
          }`}
        >
          <nav className="space-y-1 text-sm">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = navLinkActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  className={`flex items-center gap-2 !rounded-md px-2 py-2 text-md font-medium transition-colors min-h-[40px] ${
                    isActive
                      ? "bg-zinc-900 text-zinc-50 shadow-sm"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0 " />
                  {!collapsed && (
                    <span className="truncate inline-flex items-center gap-2">
                      {item.label}
                      {item.href === "/admin/pages-2/archived" &&
                      archivedWithLeadsCount > 0 ? (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-red-500"
                          title={`${archivedWithLeadsCount} archived page(s) contain leads`}
                          aria-label={`${archivedWithLeadsCount} archived page(s) contain leads`}
                        />
                      ) : null}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile sidebar */}
        <aside className="md:hidden">
          <div className="fixed inset-x-0 top-[56px] z-30">
            <div
              className={`mx-4 origin-top !rounded-md bg-white/95 p-2 shadow-md ring-1 ring-zinc-200 transition-all duration-200 ${
                collapsed ? "scale-y-0 opacity-0 pointer-events-none" : "scale-y-100 opacity-100"
              }`}
            >
              <nav className="space-y-1 text-sm">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = navLinkActive(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      aria-label={item.label}
                      className={`flex items-center gap-2 !rounded-md px-2 py-2 text-md font-medium transition-colors ${
                        isActive
                          ? "bg-zinc-900 text-zinc-50 shadow-sm"
                          : "text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate inline-flex items-center gap-2">
                        {item.label}
                        {item.href === "/admin/pages-2/archived" &&
                        archivedWithLeadsCount > 0 ? (
                          <span
                            className="inline-block h-2 w-2 rounded-full bg-red-500"
                            title={`${archivedWithLeadsCount} archived page(s) contain leads`}
                            aria-label={`${archivedWithLeadsCount} archived page(s) contain leads`}
                          />
                        ) : null}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 max-[768px]:min-w-0">{children}</main>
      </div>
    </div>
    </ToastProvider>
  );
}

