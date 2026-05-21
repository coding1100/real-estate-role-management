"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bell,
  ChevronDown,
  Eye,
  Filter,
  GripVertical,
  HelpCircle,
  NotebookPen,
  ImageIcon,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import { AddPageDialog } from "@/components/admin/AddPageDialog";
import { PageRowActions } from "@/components/admin/PageRowActions";
import { useAdminToast } from "@/components/admin/useAdminToast";
import type { PageListItem } from "@/components/admin/pageListTypes";
import { getPageCategoryLabel } from "@/lib/admin/pageCategoryLabel";

type Props = {
  pages: PageListItem[];
  viewMode?: "active" | "archived";
  domains: { id: string; hostname: string }[];
  templates: { id: string; type: string; name: string }[];
  pageOptions: {
    id: string;
    slug: string;
    type: string;
    domainHostname: string;
    domainId: string;
  }[];
};

function isMasterSlug(slug: string) {
  return slug === "master-seller" || slug === "master-buyer";
}

function formatLastModified(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Last modified: -";
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
  return `Last modified: ${formatted}`;
}

function resolveAdminDisplaySlug(page: PageListItem): string {
  const canonical = String(page.canonicalUrl ?? "").trim();
  if (!canonical) return `/${page.slug}`;
  try {
    const url = canonical.startsWith("http://") || canonical.startsWith("https://")
      ? new URL(canonical)
      : new URL(canonical, "https://placeholder.local");
    const canonicalPath = (url.pathname || "").trim();
    if (canonicalPath && canonicalPath !== "/") return canonicalPath;
  } catch {
    if (canonical.startsWith("/")) {
      const path = canonical.split("?")[0]?.split("#")[0] ?? "";
      if (path.trim()) return path.trim();
    }
  }
  return `/${page.slug}`;
}

type SortableLandingPageRowProps = {
  page: PageListItem;
  isMaster: boolean;
  isDeleted: boolean;
  archivedView: boolean;
  title: string;
  category: string;
  published: boolean;
  onToggleBookmark: (pageId: string, next: boolean) => void;
  onOpenPreview: (pageId: string) => void;
  onOpenNotes: (page: PageListItem) => void;
};

function SortableLandingPageRow({
  page,
  isMaster,
  isDeleted,
  archivedView,
  title,
  category,
  published,
  onToggleBookmark,
  onOpenPreview,
  onOpenNotes,
}: SortableLandingPageRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });
  const isMultistep =
    Array.isArray(page.multistepStepSlugs) && page.multistepStepSlugs.length > 0;
  const badgeRef = useRef<HTMLButtonElement | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!tooltipOpen || !badgeRef.current) return;

    const TOOLTIP_WIDTH = 320;
    function place() {
      const rect = badgeRef.current?.getBoundingClientRect();
      if (!rect) return;
      let left = rect.left - TOOLTIP_WIDTH - 10;
      if (left < 8) {
        left = Math.min(rect.right + 10, window.innerWidth - TOOLTIP_WIDTH - 8);
      }
      const top = Math.max(8, Math.min(rect.top - 8, window.innerHeight - 260));
      setTooltipPos({ top, left });
    }

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [tooltipOpen]);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { position: "relative" as const, zIndex: 2 } : {}),
  };
  const displaySlug = resolveAdminDisplaySlug(page);

  return (
    <li
      ref={setNodeRef}
      style={style}
      key={page.id}
      className={`border-0 ${isDragging ? "bg-zinc-50/80" : ""}`}
    >
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4">

        <div className="flex items-center gap-0.5 self-start sm:self-center">
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 cursor-grab touch-manipulation items-center justify-center !rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing"
            aria-label="Drag to reorder page under this domain"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>

        </div>

        <div className="flex-1 grid grid-cols-9 items-center">
          <div className="col-span-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="group relative aspect-video w-full max-w-[125px] shrink-0 overflow-hidden rounded-lg bg-[#E9ECEF] ring-1 ring-[#E9ECEF] sm:w-40">
                {page.thumbnailImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={page.thumbnailImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full min-h-[84px] w-full items-center justify-center text-[#CED4DA]">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onOpenPreview(page.id)}
                  className="absolute left-1/2 top-1/2 inline-flex h-[100%] w-[100%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 shadow-sm backdrop-blur-[1px] transition-opacity hover:bg-black/55 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Open preview for ${page.slug}`}
                  title="Preview"
                >
                  <Eye className="h-5 w-5" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="font-semibold leading-snug text-[#212529]">{title}
                    <button
                      type="button"
                      onClick={() => onToggleBookmark(page.id, !page.bookmarked)}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="inline-flex h-8 w-8 items-center relative top-[2px] justify-center !rounded-md hover:bg-zinc-100 ml-[10px]"
                      title={page.bookmarked ? "Unstar" : "Star"}
                      aria-label={page.bookmarked ? "Unstar page" : "Star page"}
                    >
                      <Star
                        className={`h-4 w-4 ${page.bookmarked ? "fill-amber-400 text-amber-500" : "text-zinc-400"
                          }`}
                      />
                    </button>
                  </p>
                  {isMaster && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                      Master template
                    </span>
                  )}
                  {page.isFixedDefaultHomepage && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 ring-1 ring-sky-200">
                      Default home
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-sm leading-none text-[#6C757D]">{displaySlug}</p>
                <p className="mt-1 text-xs font-medium text-[#868E96]">
                  {formatLastModified(page.updatedAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="col-span-3">
            <div className="sm:w-[260px] sm:border-x sm:border-[#E9ECEF] sm:px-5 sm:py-1 !w-full">
              <p className="text-[12px] font-medium text-[#ADB5BD]">Notes</p>
              <div className="mt-1 flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 max-h-24 overflow-y-auto whitespace-pre-wrap break-words !text-[13px] leading-5 text-[#343A40]">
                  {page.notes?.trim() ? page.notes : "No notes added yet."}
                </p>
                <button
                  type="button"
                  onClick={() => onOpenNotes(page)}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[#ADB5BD] hover:text-[#6C757D]"
                  aria-label="Open notes"
                  title="Open full notes"
                >
                  <NotebookPen className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="hidden">
            <div className="mt-1">
              <span
                className={`inline-flex items-center !rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${isMultistep
                    ? "border border-amber-200 bg-amber-50 text-amber-800"
                    : "bg-[#F1F3F5] text-[#495057]"
                  }`}
              >
                {isMultistep ? "MULTISTEP" : "SINGLE"}
              </span>
              {isMultistep &&
                Array.isArray(page.multistepStepSlugs) &&
                page.multistepStepSlugs.length > 0 && (
                  <ol className="mt-1.5 space-y-0.5 !text-[14px] text-[#6C757D]">
                    {page.multistepStepSlugs.map((slug, idx) => (
                      <li key={`${page.id}-${slug}-${idx}`} className="truncate">
                        <span className="text-[#ADB5BD]">{idx + 1}.</span>{" "}
                        <span className="font-mono">{slug}</span>
                      </li>
                    ))}
                  </ol>
                )}
            </div>
          </div>
          <div className="col-span-2 min-w-0 pl-[10px]">
            <div className="grid grid-cols-12">
              {!archivedView ? (
                <div className="col-span-10 flex-1 flex items-center justify-end">
                  <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-x-1.5 gap-y-1.5 border-t border-[#E9ECEF] pt-3 sm:border-t-0 sm:pt-0">
                    <span className="inline-flex shrink-0 items-center !rounded-md bg-[#F1F3F5] border border-[#dcdcdc] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#495057]">
                      {category}
                    </span>
                    {published ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 !rounded-md border border-[#C5DCF7] bg-[#E7F1FF] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1864AB]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#228BE6]" aria-hidden />
                        PUBLISHED
                      </span>
                    ) : isDeleted ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 !rounded-md border border-[#f5d0fe] bg-[#fdf4ff] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#a21caf]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#d946ef]" aria-hidden />
                        ARCHIVED
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1.5 !rounded-md border border-[#DEE2E6] bg-[#F8F9FA] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#495057]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#868E96]" aria-hidden />
                        DRAFT
                      </span>
                    )}
                    {isMultistep &&
                      Array.isArray(page.multistepStepSlugs) &&
                      page.multistepStepSlugs.length > 0 && (
                        <span className="inline-flex shrink-0">
                          <button
                            ref={badgeRef}
                            type="button"
                            onMouseEnter={() => setTooltipOpen(true)}
                            onMouseLeave={() => setTooltipOpen(false)}
                            onFocus={() => setTooltipOpen(true)}
                            onBlur={() => setTooltipOpen(false)}
                            className="inline-flex cursor-help items-center !rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800"
                          >
                            MULTISTEP
                          </button>
                          {tooltipOpen &&
                            tooltipPos &&
                            typeof document !== "undefined" &&
                            createPortal(
                              <div
                                className="pointer-events-none fixed z-[220] w-80 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-xl"
                                style={{ top: tooltipPos.top, left: tooltipPos.left }}
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                  Multistep flow
                                </p>
                                <p className="mt-1 text-xs font-medium text-zinc-700">
                                  {page.multistepStepSlugs.length} page
                                  {page.multistepStepSlugs.length === 1 ? "" : "s"}
                                </p>
                                <ol className="mt-2 max-h-44 list-decimal space-y-1 overflow-y-auto pl-4 text-[12px] text-zinc-700">
                                  {page.multistepStepSlugs.map((slug, idx) => (
                                    <li key={`${page.id}-tooltip-${slug}-${idx}`} className="break-words">
                                      <span className="font-mono">{slug}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>,
                              document.body,
                            )}
                        </span>
                      )}
                  </div>
                </div>
              ) : (
                <div className="col-span-10" />
              )}
              <div className="col-span-2 flex items-center justify-end">
                <PageRowActions
                  pageId={page.id}
                  slug={page.slug}
                  canonicalUrl={page.canonicalUrl}
                  status={page.status}
                  domainHostname={page.domainHostname}
                  isMaster={isMaster}
                  isDeleted={isDeleted}
                  archivedView={archivedView}
                  isFixedDefaultHomepage={page.isFixedDefaultHomepage}
                  inline
                  showMasterBadge={false}
                />
              </div>
            </div>

          </div>
        </div>

      </div>
    </li>
  );
}

export function LandingPagesV2Client({
  pages: initialPages,
  viewMode = "active",
  domains,
  templates,
  pageOptions,
}: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const initialQueryFromParams = searchParams.get("q") ?? "";
  const initialDomainFromParams = searchParams.get("domain") ?? "";
  const initialStatusFromParams = searchParams.get("status");
  const initialTypeFromParams = searchParams.get("type");
  const [rows, setRows] = useState<PageListItem[]>(initialPages);
  const [query, setQuery] = useState(initialQueryFromParams);
  const [domainId, setDomainId] = useState(initialDomainFromParams);
  const [status, setStatus] = useState<"all" | "published" | "draft" | "deleted">(
    initialStatusFromParams === "published" ||
      initialStatusFromParams === "draft" ||
      initialStatusFromParams === "deleted"
      ? initialStatusFromParams
      : "all",
  );
  const [pageType, setPageType] = useState<"all" | "buyer" | "seller">(
    initialTypeFromParams === "buyer" || initialTypeFromParams === "seller"
      ? initialTypeFromParams
      : "all",
  );
  const [notesOpenId, setNotesOpenId] = useState<string | null>(null);
  const [previewOpenId, setPreviewOpenId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowsRef = useRef<PageListItem[]>(initialPages);
  const { success, error } = useAdminToast();

  rowsRef.current = rows;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const filtered = useMemo(() => {
    let list = rows;
    list =
      viewMode === "archived"
        ? list.filter((p) => !!p.deletedAt)
        : list.filter((p) => !p.deletedAt);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const title = p.title || p.headline || "";
        return (
          p.slug.toLowerCase().includes(q) ||
          p.domainHostname.toLowerCase().includes(q) ||
          title.toLowerCase().includes(q) ||
          (p.notes ?? "").toLowerCase().includes(q)
        );
      });
    }
    if (domainId) {
      list = list.filter((p) => p.domainId === domainId);
    }
    if (status !== "all") {
      if (status === "deleted") {
        list = list.filter((p) => !!p.deletedAt);
      } else {
        list = list.filter((p) => p.status === status && !p.deletedAt);
      }
    }
    if (pageType !== "all") {
      list = list.filter((p) => p.type === pageType);
    }
    return list;
  }, [rows, query, domainId, status, pageType, viewMode]);

  const grouped = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, PageListItem[]>();
    for (const p of filtered) {
      const key = p.domainHostname;
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(p);
    }
    order.sort((a, b) => a.localeCompare(b));
    for (const k of order) {
      const arr = map.get(k);
      if (arr) {
        arr.sort((a, b) => a.adminListOrder - b.adminListOrder);
      }
    }
    return { order, map };
  }, [filtered]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isShortcut =
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        (e.key.toLowerCase() === "k" || e.code === "KeyK");
      if (!isShortcut) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  useEffect(() => {
    if (previewOpenId) setPreviewLoading(true);
  }, [previewOpenId]);

  useEffect(() => {
    setRows(initialPages);
  }, [initialPages]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("q");
    next.delete("domain");
    next.delete("status");
    next.delete("type");

    const trimmedQuery = query.trim();
    if (trimmedQuery) next.set("q", trimmedQuery);
    if (domainId) next.set("domain", domainId);
    if (status !== "all") next.set("status", status);
    if (pageType !== "all") next.set("type", pageType);

    const nextQuery = next.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [
    query,
    domainId,
    status,
    pageType,
    pathname,
    router,
    searchParams,
  ]);

  function clearFilters() {
    setQuery("");
    setDomainId("");
    setStatus("all");
    setPageType("all");
  }

  const selectedDomainLabel =
    domainId && domains.find((d) => d.id === domainId)?.hostname;

  const count = filtered.length;
  const openNotesPage = rows.find((p) => p.id === notesOpenId) ?? null;

  const selectClass =
    "min-w-[140px] appearance-none rounded-xl bg-white py-2 pl-3 pr-8 text-sm font-medium text-[#212529] focus:border-[#fff] focus:outline-none focus:ring-2 focus:ring-[#fff]";

  function openNotesDialog(page: PageListItem) {
    setNotesOpenId(page.id);
    setNotesDraft(page.notes ?? "");
    setNotesError(null);
  }

  function closeNotesDialog() {
    if (notesSaving) return;
    setNotesOpenId(null);
    setNotesDraft("");
    setNotesError(null);
  }

  async function saveNotes() {
    if (!notesOpenId) return;
    setNotesSaving(true);
    setNotesError(null);
    const notesToSave = notesDraft.trim();

    try {
      const res = await fetch(`/api/admin/pages/${notesOpenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notesToSave.length > 0 ? notesToSave : null,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        const msg =
          (data && typeof data.error === "string" && data.error) ||
          "Failed to save notes.";
        setNotesError(msg);
        error(msg);
        setNotesSaving(false);
        return;
      }
      setRows((prev) =>
        prev.map((p) =>
          p.id === notesOpenId
            ? { ...p, notes: notesToSave.length > 0 ? notesToSave : null }
            : p,
        ),
      );
      setNotesSaving(false);
      setNotesOpenId(null);
      setNotesDraft("");
      setNotesError(null);
      success("Notes saved.");
    } catch {
      const msg = "Failed to save notes.";
      setNotesError(msg);
      error(msg);
      setNotesSaving(false);
    }
  }

  async function toggleBookmark(pageId: string, next: boolean) {
    setRows((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, bookmarked: next } : p)),
    );
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarked: next }),
      });
      if (!res.ok) throw new Error("bookmark failed");
    } catch {
      setRows((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, bookmarked: !next } : p)),
      );
      error("Failed to update bookmark.");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const snapshot = rowsRef.current;
    const pageA = snapshot.find((p) => p.id === activeId);
    const pageB = snapshot.find((p) => p.id === overId);
    if (!pageA || !pageB || pageA.domainId !== pageB.domainId) return;

    const groupPages = snapshot
      .filter((p) => p.domainId === pageA.domainId)
      .sort((a, b) => a.adminListOrder - b.adminListOrder);
    const oldIndex = groupPages.findIndex((p) => p.id === activeId);
    const newIndex = groupPages.findIndex((p) => p.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(groupPages, oldIndex, newIndex);
    const pageIds = reordered.map((p) => p.id);
    const orderMap = new Map(pageIds.map((id, i) => [id, i]));

    setRows((prev) =>
      prev.map((p) =>
        orderMap.has(p.id) ? { ...p, adminListOrder: orderMap.get(p.id)! } : p,
      ),
    );

    try {
      const res = await fetch("/api/admin/pages/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: pageA.domainId, pageIds }),
      });
      if (!res.ok) throw new Error("reorder failed");
      success("Page order updated.");
    } catch {
      setRows(snapshot);
      error("Failed to reorder pages.");
    }
  }

  return (
    <div className="space-y-6 font-sans text-[#212529] antialiased">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#212529]">
              {viewMode === "archived" ? "Archived Pages" : "Landing Pages"}
            </h1>
            {/* <span className="!rounded-md bg-[#E7F1FF] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#1c7ed6] ring-1 ring-[#C5DCF7]">
              V2
            </span> */}
          </div>
          <p className="mt-1 text-sm text-[#6C757D]">
            {viewMode === "archived"
              ? "Restore or permanently delete archived pages"
              : "Manage and optimize your conversion funnels"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            className="inline-flex h-12 w-12 items-center justify-center text-[#6C757D]"
            aria-label="Notifications"
          >
            <Bell className="h-6 w-6" />
          </button>
          <button
            type="button"
            className="inline-flex h-12 w-12 items-center justify-center text-[#6C757D]"
            aria-label="Help"
          >
            <HelpCircle className="h-6 w-6" />
          </button>
          {viewMode !== "archived" ? (
            <AddPageDialog
              domains={domains}
              templates={templates}
              defaultTemplate="buyer"
              pages={pageOptions}
              trigger={(open) => (
                <button
                  type="button"
                  onClick={() => open()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#18181b] px-[15px] py-[10px] text-[18px] !rounded-md font-semibold text-white shadow-sm hover:bg-[#000000] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#228BE6]"
                >
                  <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                  New Page
                </button>
              )}
            />
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-[#E9ECEF] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#ADB5BD]" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages, slugs, or keywords…"
              className="w-full rounded-xl border border-[#fff] bg-[#fff] py-2.5 !border-0 pl-10 pr-24 text-sm text-[#212529] placeholder:text-[#ADB5BD] focus:border-[#fff] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#fff]"
            />
            <kbd className="pointer-events-none !hidden absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[#E9ECEF] bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#868E96] sm:inline-block">
              ⌘K
            </kbd>
          </div>
          <div className="flex h-px w-full shrink-0 bg-[#E9ECEF] lg:h-8 lg:w-px" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                aria-label="Domain filter"
                value={domainId}
                onChange={(e) => setDomainId(e.target.value)}
                className={selectClass}
              >
                <option value="">All domains</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.hostname}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#ADB5BD]" />
            </div>
            <div className="relative">
              <select
                aria-label="Status filter"
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value as "all" | "published" | "draft" | "deleted",
                  )
                }
                className={selectClass}
              >
                <option value="all">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                {viewMode !== "archived" ? (
                  <option value="deleted">Archived</option>
                ) : null}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#ADB5BD]" />
            </div>
            <div className="relative">
              <select
                aria-label="Type filter"
                value={pageType}
                onChange={(e) =>
                  setPageType(e.target.value as "all" | "buyer" | "seller")
                }
                className={selectClass}
              >
                <option value="all">All types</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#ADB5BD]" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-2 inline-flex items-center gap-1 !rounded-full border border-[#C5DCF7] bg-[#E7F1FF] px-2.5 py-1 text-xs font-semibold text-[#1864AB] hover:bg-[#d8eaff]"
            >
              Search: {query.trim()}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {selectedDomainLabel && (
            <button
              type="button"
              onClick={() => setDomainId("")}
              className="mt-2 inline-flex items-center gap-1 !rounded-full border border-[#DEE2E6] bg-[#F8F9FA] px-2.5 py-1 text-xs font-semibold text-[#495057] hover:bg-[#edf0f2]"
            >
              Domain: {selectedDomainLabel}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {status !== "all" && (
            <button
              type="button"
              onClick={() => setStatus("all")}
              className="mt-2 inline-flex items-center gap-1 !rounded-full border border-[#DEE2E6] bg-[#F8F9FA] px-2.5 py-1 text-xs font-semibold uppercase text-[#495057] hover:bg-[#edf0f2]"
            >
              Status: {status}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {pageType !== "all" && (
            <button
              type="button"
              onClick={() => setPageType("all")}
              className="mt-2 inline-flex items-center gap-1 !rounded-full border border-[#DEE2E6] bg-[#F8F9FA] px-2.5 py-1 text-xs font-semibold uppercase text-[#495057] hover:bg-[#edf0f2]"
            >
              Type: {pageType}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#212529]">
          Showing {count} result{count === 1 ? "" : "s"}{" "}
          <span className="font-medium normal-case tracking-normal text-[#868E96]">
            · updating in real-time
          </span>
        </p>
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#228BE6] hover:text-[#1c7ed6]"
        >
          <Filter className="h-3.5 w-3.5" />
          Clear filters
        </button>
      </div>


      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-10">
          {grouped.order.map((domain) => {
            const pagesForDomain = grouped.map.get(domain) ?? [];
            if (pagesForDomain.length === 0) return null;
            const activeCount = pagesForDomain.filter(
              (p) =>
                viewMode === "archived"
                  ? !!p.deletedAt
                  : p.status === "published" && !p.deletedAt,
            ).length;

            return (
              <section key={domain} className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E7F1FF] text-[#228BE6]">
                    <LayoutGrid className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div>
                    <Link
                      href={`https://${domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-bold text-[#212529] hover:underline"
                    >
                      {domain}
                    </Link>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#868E96]">
                      {activeCount} {viewMode === "archived" ? "archived" : "active"} page
                      {activeCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#E9ECEF] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <SortableContext
                    items={pagesForDomain.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="divide-y divide-[#E9ECEF] !list-none !ml-0">
                      {pagesForDomain.map((page) => {
                        const title =
                          (page.title || page.headline || page.slug).trim() ||
                          page.slug;
                        const category = getPageCategoryLabel(page);
                        const isDeleted = !!page.deletedAt;
                        const published = page.status === "published" && !isDeleted;
                        const isMaster = isMasterSlug(page.slug);
                        return (
                          <SortableLandingPageRow
                            key={page.id}
                            page={page}
                            isMaster={isMaster}
                            isDeleted={isDeleted}
                            archivedView={viewMode === "archived"}
                            title={title}
                            category={category}
                            published={published}
                            onToggleBookmark={toggleBookmark}
                            onOpenPreview={(pageId) => {
                              setPreviewLoading(true);
                              setPreviewOpenId(pageId);
                            }}
                            onOpenNotes={openNotesDialog}
                          />
                        );
                      })}
                    </ul>
                  </SortableContext>
                </div>
              </section>
            );
          })}

          {count === 0 && (
            <p className="rounded-2xl border border-dashed border-[#E9ECEF] bg-white py-12 text-center text-sm text-[#6C757D]">
              {viewMode === "archived"
                ? "No archived pages found."
                : "No pages match your filters."}
            </p>
          )}
          {previewOpenId && (() => {
            const previewPage = rows.find((p) => p.id === previewOpenId);
            if (!previewPage) return null;
            const previewSrc = `/${encodeURIComponent(previewPage.slug)}?preview=1&domain=${encodeURIComponent(previewPage.domainHostname)}`;
            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4"
                onMouseDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  setPreviewLoading(false);
                  setPreviewOpenId(null);
                }}
              >
                <div className="relative !rounded-md border border-zinc-200 bg-white p-2 shadow-lg">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="text-xs font-medium text-zinc-600">
                      {previewPage.domainHostname}/{previewPage.slug}
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center !rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                      aria-label="Close preview"
                      onClick={() => {
                        setPreviewLoading(false);
                        setPreviewOpenId(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="relative h-[338px] w-[600px] overflow-hidden rounded-sm bg-zinc-50">
                    {previewLoading && (
                      <div
                        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-zinc-50"
                        role="status"
                        aria-live="polite"
                      >
                        <Loader2 className="h-7 w-7 animate-spin text-zinc-400" />
                        <span className="text-xs text-zinc-500">Loading preview...</span>
                      </div>
                    )}
                    <iframe
                      title={`Preview ${previewPage.slug}`}
                      src={previewSrc}
                      onLoad={() => setPreviewLoading(false)}
                      style={{
                        width: 1280,
                        height: 720,
                        border: 0,
                        transform: "scale(0.46875)",
                        transformOrigin: "top left",
                      }}
                      className="block"
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </DndContext>
      {notesOpenId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            closeNotesDialog();
          }}
        >
          <div className="w-full max-w-2xl !rounded-md border border-zinc-200 bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  Page notes
                </h3>
                <p className="text-xs text-zinc-500">
                  Add or edit notes for this page.
                </p>
                {openNotesPage && (
                  <p className="mt-1 font-mono text-[11px] text-zinc-500">
                    /{openNotesPage.slug}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeNotesDialog}
                className="inline-flex h-7 w-7 items-center justify-center !rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                aria-label="Close notes dialog"
                disabled={notesSaving}
              >
                ✕
              </button>
            </div>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={10}
              className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="Write page notes..."
            />
            {notesError && <p className="mt-2 text-xs text-red-600">{notesError}</p>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeNotesDialog}
                disabled={notesSaving}
                className="!rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNotes}
                disabled={notesSaving}
                className="!rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {notesSaving ? "Saving..." : "Save notes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
