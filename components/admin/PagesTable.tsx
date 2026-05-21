"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, GripVertical, Loader2, Search, Star } from "lucide-react";
import { TitleEditor } from "@/components/admin/TitleEditor";
import { PageRowActions } from "@/components/admin/PageRowActions";
import type { PageListItem } from "@/components/admin/pageListTypes";

export type { PageListItem } from "@/components/admin/pageListTypes";

interface PagesTableProps {
  pages: PageListItem[];
}

const THUMB_IFRAME_BASE_W = 1280;
const THUMB_IFRAME_BASE_H = 720;
const THUMB_BOX_W = 150;
const THUMB_BOX_H = 100;
const THUMB_SCALE = Math.min(THUMB_BOX_W / THUMB_IFRAME_BASE_W, THUMB_BOX_H / THUMB_IFRAME_BASE_H);
// How many thumbnail iframes get full opacity / pointer-events at once.
// Loaded iframes stay mounted (opacity 0 when off-screen) so they never reload on scroll.
const MAX_ACTIVE_THUMB_IFRAMES = 10;
const PACIFIC_TIMEZONE = "America/Los_Angeles";

function formatPacificDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: PACIFIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  return `${formatted} PST`;
}

function truncateNotes(value: string, max = 25): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function ThumbLoaderOverlay({ label }: { label: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-zinc-50/95"
      aria-hidden
    >
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function PreviewThumbnail({
  pageId,
  previewSrc,
  fallbackImageUrl,
  isActive,
  onVisibleChange,
  onOpenPreview,
}: {
  pageId: string;
  previewSrc: string;
  fallbackImageUrl?: string | null;
  isActive: boolean;
  onVisibleChange: (pageId: string, inView: boolean) => void;
  onOpenPreview: () => void;
}) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const iframeLoadFallbackRef = useRef<number | null>(null);
  /** Once the iframe has loaded, keep it mounted so it never reloads on scroll. */
  const [persistIframe, setPersistIframe] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const showIframe = isActive || persistIframe;

  useEffect(() => {
    setPersistIframe(false);
    setIframeLoaded(false);
  }, [previewSrc]);

  useEffect(() => {
    setImageLoaded(false);
  }, [fallbackImageUrl]);

  const markIframeLoaded = useCallback(() => {
    if (iframeLoadFallbackRef.current !== null) {
      window.clearTimeout(iframeLoadFallbackRef.current);
      iframeLoadFallbackRef.current = null;
    }
    setIframeLoaded(true);
    setPersistIframe(true);
  }, []);

  useEffect(() => {
    if (!showIframe) {
      if (iframeLoadFallbackRef.current !== null) {
        window.clearTimeout(iframeLoadFallbackRef.current);
        iframeLoadFallbackRef.current = null;
      }
      return;
    }
    if (iframeLoadFallbackRef.current !== null) {
      window.clearTimeout(iframeLoadFallbackRef.current);
    }
    iframeLoadFallbackRef.current = window.setTimeout(() => {
      markIframeLoaded();
    }, 12000);
    return () => {
      if (iframeLoadFallbackRef.current !== null) {
        window.clearTimeout(iframeLoadFallbackRef.current);
        iframeLoadFallbackRef.current = null;
      }
    };
  }, [showIframe, previewSrc, markIframeLoaded]);

  const showThumbLoader =
    (showIframe && !iframeLoaded) ||
    (!showIframe && !!fallbackImageUrl && !imageLoaded);

  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        onVisibleChange(pageId, entry.isIntersecting);
      },
      // For tiny 150x100 boxes, 0.6 can be too strict; lower it so any meaningful
      // visibility counts and becomes eligible after scroll idle.
      { root: null, threshold: 0.15 },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [pageId, onVisibleChange]);

  return (
    <div
      ref={holderRef}
      className="relative mx-auto h-[86px] w-[150px] overflow-hidden rounded border border-zinc-200 bg-zinc-50 cursor-pointer"
      aria-label={`Preview thumbnail for ${pageId}`}
      onClick={onOpenPreview}
    >
      {showThumbLoader && (
        <ThumbLoaderOverlay label="Loading preview thumbnail" />
      )}
      {showIframe && (
        <iframe
          title={`Preview thumbnail ${pageId}`}
          src={previewSrc}
          onLoad={markIframeLoaded}
          style={{
            width: THUMB_IFRAME_BASE_W,
            height: THUMB_IFRAME_BASE_H,
            border: 0,
            transform: `scale(${THUMB_SCALE})`,
            transformOrigin: "top left",
            // When not active, keep it mounted but visually hidden.
            opacity: isActive ? 1 : 0,
            pointerEvents: isActive ? "auto" : "none",
          }}
          className="block"
        />
      )}
      {!showIframe &&
        (fallbackImageUrl ? (
          <img
            src={fallbackImageUrl}
            alt={`Preview thumbnail ${pageId}`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            className="h-full w-full object-contain bg-zinc-50"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="text-xs">Loading…</span>
          </div>
        ))}
    </div>
  );
}

function PreviewDialogIframe({
  previewSrc,
  title,
  baseW,
  baseH,
  scale,
}: {
  previewSrc: string;
  title: string;
  baseW: number;
  baseH: number;
  scale: number;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [previewSrc]);

  return (
    <div className="relative h-[338px] w-[600px] overflow-hidden rounded-sm bg-zinc-50">
      {!loaded && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-50"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-9 w-9 animate-spin text-zinc-400" aria-hidden />
          <span className="text-xs text-zinc-500">Loading preview…</span>
        </div>
      )}
      <iframe
        title={title}
        src={previewSrc}
        onLoad={() => setLoaded(true)}
        style={{
          width: baseW,
          height: baseH,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        className="block"
      />
    </div>
  );
}

function PagesTableRowBody({
  page,
  domain,
  leadingCell,
  previewSlot,
  onOpenNotes,
}: {
  page: PageListItem;
  domain: string;
  leadingCell: React.ReactNode;
  previewSlot: React.ReactNode;
  onOpenNotes: (page: PageListItem) => void;
}) {
  const isMaster =
    page.slug === "master-seller" || page.slug === "master-buyer";
  const isMultistep =
    Array.isArray(page.multistepStepSlugs) &&
    page.multistepStepSlugs.length > 0;

  return [
    <td key="lead" className="px-2 py-3">
      {leadingCell}
    </td>,
    <td key="dom" className="px-2 py-2 text-zinc-700">
      <span className="block max-w-[165px] truncate text-zinc-500">{domain}</span>
    </td>,
    <td key="title" className="px-2 py-2 text-zinc-700">
      <div className="max-w-[220px]">
        {isMaster ? (
          <span className="block overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] leading-tight break-words">
            {page.title || page.headline || ""}
          </span>
        ) : (
          <TitleEditor
            pageId={page.id}
            initialTitle={page.title || page.headline || ""}
          />
        )}
        {(isMaster || page.isFixedDefaultHomepage) && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {isMaster && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200">
                Master template
              </span>
            )}
            {page.isFixedDefaultHomepage && (
              <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-800 ring-1 ring-sky-200">
                Default home
              </span>
            )}
          </div>
        )}
        </div>
    </td>,
    <td key="type" className="px-2 py-2 text-zinc-700">
      <span className="capitalize">{page.type}</span>
    </td>,
    <td key="mode" className="hidden px-2 py-2 text-zinc-700 2xl:table-cell">
      <div className="flex flex-col gap-1">
        <span
          className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
            isMultistep
              ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
              : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
          }`}
        >
          {isMultistep ? "Multistep" : "Single"}
        </span>
        {isMultistep &&
          Array.isArray(page.multistepStepSlugs) &&
          page.multistepStepSlugs.length > 0 && (
            <ol className="mt-1 space-y-0.5 text-[11px] text-zinc-500 ml-0">
              {page.multistepStepSlugs.map((slug, idx) => (
                <li
                  key={slug + idx}
                  className="truncate max-w-[220px] text-[14px]"
                >
                  <span className="text-zinc-400">{idx + 1}.</span>{" "}
                  <span className="font-mono">{slug}</span>
                </li>
              ))}
            </ol>
          )}
      </div>
    </td>,
    <td key="status" className="px-2 py-2 text-zinc-700">
      {page.status}
    </td>,
    <td key="notes" className="px-2 py-2 text-zinc-700">
      <div className="max-w-[240px]">
        {page.notes && page.notes.trim().length > 0 ? (
          <>
            <p className="text-sm text-zinc-700 break-words">
              {truncateNotes(page.notes)}
            </p>
            <button
              type="button"
              onClick={() => onOpenNotes(page)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
            >
              <Eye className="h-3 w-3" />
              Read more
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onOpenNotes(page)}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-800"
          >
            <Eye className="h-3 w-3" />
            Add note
          </button>
        )}
      </div>
    </td>,
    <td key="upd" className="hidden px-3 py-2 text-zinc-500 xl:table-cell">
      {formatPacificDateTime(page.updatedAt)}
    </td>,
    <td key="prev" className="px-3 py-2 text-center">
      {previewSlot}
    </td>,
    <td key="act" className="px-3 py-2 text-right">
      <PageRowActions
        pageId={page.id}
        slug={page.slug}
        canonicalUrl={page.canonicalUrl}
        status={page.status}
        domainHostname={page.domainHostname}
        isMaster={isMaster}
        isFixedDefaultHomepage={page.isFixedDefaultHomepage}
      />
    </td>,
  ];
}

function SortablePagesTableRow({
  page,
  domain,
  previewSlot,
  onToggleBookmark,
  onOpenNotes,
}: {
  page: PageListItem;
  domain: string;
  previewSlot: React.ReactNode;
  onToggleBookmark: (pageId: string, next: boolean) => void;
  onOpenNotes: (page: PageListItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { position: "relative" as const, zIndex: 2 } : {}),
  };

  const leadingCell = (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        className="inline-flex h-8 w-8 shrink-0 cursor-grab touch-manipulation items-center justify-center !rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing"
        aria-label="Drag to reorder page under this domain"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onToggleBookmark(page.id, !page.bookmarked)}
        onPointerDown={(e) => e.stopPropagation()}
        className="inline-flex relative right-[5px] h-8 w-8 items-center justify-center !rounded-md hover:bg-zinc-100"
        title={page.bookmarked ? "Unstar" : "Star"}
      >
        <Star
          className={`h-4 w-4 ${
            page.bookmarked
              ? "fill-amber-400 text-amber-500"
              : "text-zinc-400"
          }`}
        />
      </button>
    </div>
  );

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-t border-zinc-100 transition-colors hover:bg-zinc-50/80 ${
        isDragging ? "bg-zinc-50 opacity-95 shadow-sm" : ""
      }`}
    >
      {PagesTableRowBody({
        page,
        domain,
        leadingCell,
        previewSlot,
        onOpenNotes,
      })}
    </tr>
  );
}

export function PagesTable({ pages }: PagesTableProps) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PageListItem[]>(pages);
  const [starredFirst, setStarredFirst] = useState(false);
  const [previewOpenId, setPreviewOpenId] = useState<string | null>(null);
  const [notesOpenId, setNotesOpenId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const visibleThumbsRef = useRef<Record<string, boolean>>({});
  const [activeThumbIds, setActiveThumbIds] = useState<Set<string>>(() => new Set());
  const rowsRef = useRef<PageListItem[]>(pages);
  const isUserScrollingRef = useRef(false);
  const scrollIdleTimerRef = useRef<number | null>(null);

  rowsRef.current = rows;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    setRows(pages);
  }, [pages]);

  useEffect(() => {
    function onScroll() {
      isUserScrollingRef.current = true;
      if (scrollIdleTimerRef.current) {
        window.clearTimeout(scrollIdleTimerRef.current);
      }
      scrollIdleTimerRef.current = window.setTimeout(() => {
        isUserScrollingRef.current = false;
        reconcileActiveThumbs();
      }, 150);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollIdleTimerRef.current) {
        window.clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? rows
      : rows.filter((p) => {
          const title = p.title || p.headline || "";
          return (
            p.slug.toLowerCase().includes(q) ||
            p.domainHostname.toLowerCase().includes(q) ||
            title.toLowerCase().includes(q) ||
            (p.notes ?? "").toLowerCase().includes(q)
          );
        });

    if (!starredFirst) return base;

    // Optional pinning: keep stable order within groups to avoid "wrong row" confusion.
    const starred: PageListItem[] = [];
    const normal: PageListItem[] = [];
    for (const p of base) {
      if (p.bookmarked) starred.push(p);
      else normal.push(p);
    }
    return [...starred, ...normal];
  }, [rows, query, starredFirst]);

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
    // keep groups ordered alphabetically by domain for predictability
    order.sort((a, b) => a.localeCompare(b));
    for (const k of order) {
      const arr = map.get(k);
      if (arr) {
        arr.sort((a, b) => a.adminListOrder - b.adminListOrder);
      }
    }
    return { order, map };
  }, [filtered]);

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
        setNotesError(
          (data && typeof data.error === "string" && data.error) ||
            "Failed to save notes.",
        );
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
    } catch {
      setNotesError("Failed to save notes.");
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
      if (!res.ok) {
        setRows((prev) =>
          prev.map((p) =>
            p.id === pageId ? { ...p, bookmarked: !next } : p,
          ),
        );
      }
    } catch {
      setRows((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, bookmarked: !next } : p)),
      );
    }
  }

  const reconcileActiveThumbs = useCallback(() => {
    setActiveThumbIds((prev) => {
      const nextActive = new Set<string>(prev);

      // Deactivate any that are not visible.
      for (const id of Array.from(nextActive)) {
        if (!visibleThumbsRef.current[id]) nextActive.delete(id);
      }

      // Activate up to the limit.
      if (!isUserScrollingRef.current) {
        const visibleIds = Object.keys(visibleThumbsRef.current).filter(
          (id) => visibleThumbsRef.current[id],
        );
        for (const id of visibleIds) {
          if (nextActive.size >= MAX_ACTIVE_THUMB_IFRAMES) break;
          if (!nextActive.has(id)) nextActive.add(id);
        }
      }

      return nextActive;
    });
  }, []);

  const handleThumbVisibleChange = useCallback(
    (thumbId: string, inView: boolean) => {
      visibleThumbsRef.current[thumbId] = inView;
      reconcileActiveThumbs();
    },
    [reconcileActiveThumbs],
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const snapshot = rowsRef.current;
    const pageA = snapshot.find((p) => p.id === activeId);
    const pageB = snapshot.find((p) => p.id === overId);
    if (!pageA || !pageB || pageA.domainId !== pageB.domainId) return;

    const domainHostname = pageA.domainHostname;
    const groupPages = snapshot
      .filter((p) => p.domainHostname === domainHostname)
      .sort((a, b) => a.adminListOrder - b.adminListOrder);
    const oldIndex = groupPages.findIndex((p) => p.id === activeId);
    const newIndex = groupPages.findIndex((p) => p.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(groupPages, oldIndex, newIndex);
    const pageIds = reordered.map((p) => p.id);
    const orderMap = new Map(pageIds.map((id, i) => [id, i]));

    setRows((prev) =>
      prev.map((p) =>
        orderMap.has(p.id)
          ? { ...p, adminListOrder: orderMap.get(p.id)! }
          : p,
      ),
    );

    try {
      const res = await fetch("/api/admin/pages/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: pageA.domainId, pageIds }),
      });
      if (!res.ok) throw new Error("reorder failed");
    } catch {
      setRows(snapshot);
    }
  }, []);

  const renderPreviewSlot = useCallback(
    (page: PageListItem) => {
      const previewSrc = `/${encodeURIComponent(page.slug)}?preview=1&domain=${encodeURIComponent(page.domainHostname)}`;
      const POPUP_BOX = 600;
      const BASE_W = THUMB_IFRAME_BASE_W;
      const BASE_H = THUMB_IFRAME_BASE_H;
      const popupScale = Math.min(POPUP_BOX / BASE_W, POPUP_BOX / BASE_H);

      return (
        <div className="group relative inline-block">
          <PreviewThumbnail
            pageId={page.id}
            previewSrc={previewSrc}
            fallbackImageUrl={page.thumbnailImageUrl}
            isActive={activeThumbIds.has(page.id)}
            onVisibleChange={handleThumbVisibleChange}
            onOpenPreview={() => setPreviewOpenId(page.id)}
          />
          <button
            type="button"
            onClick={() => setPreviewOpenId(page.id)}
            className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center !rounded-md border border-zinc-200 bg-white/95 text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
            aria-label={`Open preview for ${page.slug}`}
            title="Preview"
          >
            <Eye className="h-4 w-4" />
          </button>

          {previewOpenId === page.id && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4"
              onMouseDown={(e) => {
                if (e.target !== e.currentTarget) return;
                setPreviewOpenId(null);
              }}
            >
              <div className="relative !rounded-md border border-zinc-200 bg-white p-2 shadow-lg">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="text-xs font-medium text-zinc-600">
                    {page.domainHostname}/{page.slug}
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center !rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                    aria-label="Close preview"
                    onClick={() => {
                      setPreviewOpenId(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
                <PreviewDialogIframe
                  previewSrc={previewSrc}
                  title={`Preview ${page.slug}`}
                  baseW={BASE_W}
                  baseH={BASE_H}
                  scale={popupScale}
                />
              </div>
            </div>
          )}
        </div>
      );
    },
    [
      previewOpenId,
      activeThumbIds,
      handleThumbVisibleChange,
    ],
  );

  const showReorder = !query.trim();

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500">
          {rows.length} page{rows.length === 1 ? "" : "s"} total.
        </p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <label className="inline-flex items-center gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={starredFirst}
              onChange={(e) => setStarredFirst(e.target.checked)}
            />
            <span>Starred first</span>
          </label>
          <div className="w-full sm:w-80">
          <label className="sr-only" htmlFor="pages-search">
            Search pages
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              id="pages-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by domain, slug, or title…"
              className="w-full !rounded-md border border-zinc-300 bg-white px-3 pr-9 py-1.5 text-sm text-zinc-800 shadow-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
        </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
      <div className="-mx-2 overflow-x-auto px-2 min-[1400px]:overflow-x-hidden">
        <table className="min-w-[1220px] min-[1400px]:min-w-0 w-full table-fixed rounded-lg bg-white text-md shadow-sm">
          <thead className="bg-zinc-50 text-[16px] uppercase tracking-[0.15em] text-zinc-500">
            <tr>
              <th className="w-[44px] px-2 py-2 text-left"></th>
              <th className="w-[165px] px-3 py-2 text-left">Domain</th>
              <th className="w-[220px] px-3 py-2 text-left">Title</th>
              <th className="w-[70px] px-3 py-2 text-left">Type</th>
              <th className="hidden w-[145px] px-3 py-2 text-left 2xl:table-cell">Mode</th>
              <th className="w-[88px] px-3 py-2 text-left">Status</th>
              <th className="w-[240px] px-3 py-2 text-left">Notes</th>
              <th className="hidden w-[150px] px-3 py-2 text-left xl:table-cell">Updated</th>
              <th className="w-[150px] px-3 py-2 text-left">Preview</th>
              <th className="w-[76px] px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {grouped.order.map((domain) => {
              const pagesForDomain = grouped.map.get(domain) ?? [];
              if (pagesForDomain.length === 0) return null;
              return (
                <>
                  <tr key={`group-${domain}`} className="border-t border-zinc-200 bg-zinc-50/60">
                    <td className="px-3 py-2 text-sm font-semibold text-zinc-800" colSpan={10}>
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={`https://${domain}`}
                          target="_blank"
                          className="hover:underline"
                        >
                          {domain}
                        </Link>
                        <span className="text-xs font-medium text-zinc-500">
                          {pagesForDomain.length} page{pagesForDomain.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {showReorder ? (
                    <SortableContext
                      items={pagesForDomain.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {pagesForDomain.map((page) => (
                        <SortablePagesTableRow
                          key={page.id}
                          page={page}
                          domain={domain}
                          previewSlot={renderPreviewSlot(page)}
                          onToggleBookmark={toggleBookmark}
                          onOpenNotes={openNotesDialog}
                        />
                      ))}
                    </SortableContext>
                  ) : (
                    pagesForDomain.map((page) => (
                      <tr
                        key={page.id}
                        className="border-t border-zinc-100 hover:bg-zinc-50/80 transition-colors"
                      >
                        {PagesTableRowBody({
                          page,
                          domain,
                          leadingCell: (
                            <button
                              type="button"
                              onClick={() =>
                                toggleBookmark(page.id, !page.bookmarked)
                              }
                              className="inline-flex relative left-[5px] h-8 w-8 items-center justify-center !rounded-md hover:bg-zinc-100"
                              title={page.bookmarked ? "Unstar" : "Star"}
                            >
                              <Star
                                className={`h-4 w-4 ${
                                  page.bookmarked
                                    ? "fill-amber-400 text-amber-500"
                                    : "text-zinc-400"
                                }`}
                              />
                            </button>
                          ),
                          previewSlot: renderPreviewSlot(page),
                          onOpenNotes: openNotesDialog,
                        })}
                      </tr>
                    ))
                  )}
                </>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  className="px-3 py-4 text-center text-zinc-500"
                  colSpan={10}
                >
                  No pages match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
            {notesError && (
              <p className="mt-2 text-xs text-red-600">{notesError}</p>
            )}
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
      </DndContext>
    </div>
  );
}

