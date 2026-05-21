"use client";

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Eye, Pencil, Copy, Link as LinkIcon } from "lucide-react";
import { DeletePageButton } from "@/components/admin/DeletePageButton";
import { useAdminToast } from "@/components/admin/useAdminToast";
import { buildCustomerSiteUrl } from "@/lib/customerSiteUrl";

interface PageRowActionsProps {
  pageId: string;
  slug: string;
  canonicalUrl?: string | null;
  status?: string;
  domainHostname?: string;
  isMaster: boolean;
  isDeleted?: boolean;
  archivedView?: boolean;
  isFixedDefaultHomepage?: boolean;
  /** Row layout: master chip + ⋮ menu align horizontally and center with adjacent badges (e.g. Landing Pages V2). */
  inline?: boolean;
  /** When false, the master chip is not rendered here (show it elsewhere, e.g. next to the title). */
  showMasterBadge?: boolean;
}

export function PageRowActions({
  pageId,
  slug,
  canonicalUrl,
  status,
  domainHostname,
  isMaster,
  isDeleted = false,
  archivedView = false,
  isFixedDefaultHomepage = false,
  inline = false,
  showMasterBadge = true,
}: PageRowActionsProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    bottom: number;
    left: number;
    width: number;
    openUp: boolean;
  } | null>(null);
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<
    null | "duplicate" | "toggle-status" | "copy-link"
  >(null);
  const { success, error } = useAdminToast();
  const draftPreviewHref = `/${encodeURIComponent(slug)}?preview=1${
    domainHostname ? `&domain=${encodeURIComponent(domainHostname)}` : ""
  }`;
  const isPublished = (status ?? "").toLowerCase() === "published";
  const canonicalPath = (() => {
    const value = String(canonicalUrl ?? "").trim();
    if (!value) return null;
    try {
      const parsed =
        value.startsWith("http://") || value.startsWith("https://")
          ? new URL(value)
          : new URL(value, "https://placeholder.local");
      const path = (parsed.pathname || "").trim();
      return path && path !== "/" ? path : null;
    } catch {
      if (!value.startsWith("/")) return null;
      const path = value.split("?")[0]?.split("#")[0]?.trim() ?? "";
      return path && path !== "/" ? path : null;
    }
  })();
  const livePath = canonicalPath ?? `/${encodeURIComponent(slug)}`;
  const liveHref = domainHostname
    ? buildCustomerSiteUrl(domainHostname, livePath)
    : livePath;
  const viewHref =
    archivedView || !isPublished ? draftPreviewHref : liveHref;
  const viewLabel =
    archivedView || !isPublished ? "View draft page" : "View live page";

  const MENU_WIDTH = 176;

  function syncMenuPosition() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const estimatedMenuHeight = archivedView || isDeleted ? 220 : 260;
    const viewportPadding = 8;

    let left = rect.right - MENU_WIDTH;
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp =
      spaceBelow < estimatedMenuHeight + viewportPadding &&
      spaceAbove > spaceBelow;
    setPanelPos({
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      bottom: window.innerHeight - rect.top + 4,
      left,
      width: MENU_WIDTH,
      openUp,
    });
  }

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    syncMenuPosition();
    window.addEventListener("scroll", syncMenuPosition, true);
    window.addEventListener("resize", syncMenuPosition);
    return () => {
      window.removeEventListener("scroll", syncMenuPosition, true);
      window.removeEventListener("resize", syncMenuPosition);
    };
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        (target as Element).closest?.("[role=\"dialog\"]")
      ) {
        return;
      }
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div
      className={`relative inline-flex items-center justify-end gap-2 ${
        inline ? "flex-row" : "flex-col"
      }`}
    >
      {isMaster && showMasterBadge && (
        <span
          className={`rounded-full bg-amber-50 px-2 py-0.5 text-center text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 ${
            inline ? "shrink-0" : "mr-2"
          }`}
        >
          Master template
        </span>
      )}
      <div className="relative shrink-0">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            setOpen((prev) => {
              if (prev) {
                setPanelPos(null);
                return false;
              }
              syncMenuPosition();
              return true;
            });
          }}
          className="inline-flex h-10 w-10 items-center justify-center !rounded-full  bg-white text-zinc-600 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Open page actions"
        >
          <MoreVertical className="h-6 w-6" />
        </button>
        {open &&
          panelPos &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={panelRef}
              role="menu"
              className="fixed z-[50] overflow-hidden !rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg"
              style={{
                top: panelPos.openUp ? undefined : panelPos.top,
                bottom: panelPos.openUp ? panelPos.bottom : undefined,
                left: panelPos.left,
                width: panelPos.width,
              }}
            >
            {archivedView ? (
              <a
                href={viewHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-50"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{viewLabel}</span>
              </a>
            ) : (
              <>
                <a
                  href={viewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{viewLabel}</span>
                </a>
                <Link
                  href={`/admin/pages/${pageId}/edit`}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </Link>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => {
                    const nextStatus = isPublished ? "draft" : "published";
                    void (async () => {
                      try {
                        setBusyAction("toggle-status");
                        setOpen(false);
                        const res = await fetch(`/api/admin/pages/${pageId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: nextStatus }),
                        });
                        const data = await res.json().catch(() => null);
                        if (!res.ok) {
                          const msg =
                            (data && typeof data.error === "string" && data.error) ||
                            `Failed to ${isPublished ? "unpublish" : "publish"} page.`;
                          error(msg);
                          return;
                        }
                        router.refresh();
                        success(
                          isPublished
                            ? "Page unpublished successfully."
                            : "Page published successfully.",
                        );
                      } catch (err) {
                        console.error(err);
                        error(
                          isPublished
                            ? "Failed to unpublish page."
                            : "Failed to publish page.",
                        );
                      } finally {
                        setBusyAction(null);
                      }
                    })();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      isPublished ? "bg-amber-500" : "bg-emerald-600"
                    }`}
                  />
                  <span>{isPublished ? "Unpublish" : "Publish"}</span>
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => {
                    void (async () => {
                      try {
                        setBusyAction("duplicate");
                        setOpen(false);
                        const res = await fetch("/api/admin/pages/duplicate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ pageId }),
                        });
                        const data = await res.json().catch(() => null);
                        if (!res.ok) {
                          const msg =
                            (data && typeof data.error === "string" && data.error) ||
                            "Failed to duplicate page.";
                          error(msg);
                          return;
                        }
                        router.refresh();
                        success("Page duplicated successfully.");
                      } catch (err) {
                        console.error(err);
                        error("Failed to duplicate page.");
                      } finally {
                        setBusyAction(null);
                      }
                    })();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Duplicate</span>
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={async () => {
                    try {
                      setBusyAction("copy-link");
                      setOpen(false);
                      const origin =
                        typeof window !== "undefined" ? window.location.origin : "";
                      const url = domainHostname
                        ? buildCustomerSiteUrl(domainHostname, livePath)
                        : `${origin}${livePath}`.replace(/([^:]\/)\/+/g, "$1");

                      if (
                        typeof navigator !== "undefined" &&
                        navigator.clipboard?.writeText
                      ) {
                        await navigator.clipboard.writeText(url);
                      } else {
                        const temp = document.createElement("textarea");
                        temp.value = url;
                        temp.style.position = "fixed";
                        temp.style.left = "-9999px";
                        temp.style.top = "-9999px";
                        document.body.appendChild(temp);
                        temp.focus();
                        temp.select();
                        document.execCommand("copy");
                        document.body.removeChild(temp);
                      }

                      success("Link copied to clipboard.");
                    } catch {
                      error("Failed to copy link.");
                    } finally {
                      setBusyAction(null);
                    }
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span>Copy link</span>
                </button>
              </>
            )}
            <div className="mt-1 border-t border-zinc-100 pt-1">
              {isDeleted && archivedView ? (
                <DeletePageButton
                  pageId={pageId}
                  slug={slug}
                  mode="permanent-delete"
                  variant="menu"
                />
              ) : null}
              <DeletePageButton
                pageId={pageId}
                slug={slug}
                mode={isDeleted ? "restore" : "archive"}
                variant="menu"
                disabled={!isDeleted && isFixedDefaultHomepage}
                disabledReason="This domain default homepage is fixed and cannot be archived."
              />
            </div>
          </div>,
            document.body,
          )}
      </div>
    </div>
  );
}

