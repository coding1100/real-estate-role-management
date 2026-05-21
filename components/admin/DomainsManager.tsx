"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Dialog } from "@/components/ui/Dialog";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Check, X, Trash2, Plus, GripVertical, Search, ChevronDown } from "lucide-react";
import { useAdminToast } from "@/components/admin/useAdminToast";

interface DomainRow {
  id: string;
  hostname: string;
  displayName: string;
  notifyEmail: string;
  notifySms: string | null;
  isActive: boolean;
  ga4Id: string | null;
  metaPixelId: string | null;
  logoUrl: string | null;
  rightLogoUrl: string | null;
  faviconUrl: string | null;
  linkedinUrl: string | null;
  linkedinVisible: boolean;
  googleUrl: string | null;
  googleVisible: boolean;
  facebookUrl: string | null;
  facebookVisible: boolean;
  instagramUrl: string | null;
  instagramVisible: boolean;
  zillowUrl: string | null;
  zillowVisible: boolean;
  defaultHomepagePageId: string | null;
  defaultHomepageButtonLimit: number;
  defaultHomepageOptions: { id: string; slug: string; label: string; path: string }[];
  defaultHomepageButtons: {
    id: string;
    label: string;
    href: string;
    target: "_self" | "_blank";
    styleMode: "light" | "dark";
    ctaBgColor: string;
    ctaTextColor: string;
    ctaActiveBgColor: string;
    ctaActiveTextColor: string;
    isActive: boolean;
    isFeatured: boolean;
    linkedPageId: string | null;
  }[];
}

interface DomainsManagerProps {
  initialDomains: DomainRow[];
}

type HomepageOption = { id: string; slug: string; label: string; path: string };

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidUsPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^[0-9+\-()\s]+$/.test(trimmed)) return false;
  if (trimmed.includes("+") && !trimmed.startsWith("+")) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

function normalizeExternalHttpUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function isValidExternalHttpUrl(value: string): boolean {
  const normalized = normalizeExternalHttpUrl(value);
  if (!/^https?:\/\//i.test(normalized)) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function SortableHomepageButtonItem({
  id,
  isEditing,
  children,
}: {
  id: string;
  isEditing: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
      <div className={isEditing ? "flex items-start gap-2" : ""}>
        {isEditing ? (
          <button
            type="button"
            className="mt-1 inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center !rounded-md border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50 active:cursor-grabbing"
            aria-label="Drag button to reorder"
            title="Drag"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

function SearchableHomepageOptionSelector({
  options,
  value,
  onSelect,
}: {
  options: HomepageOption[];
  value: string | null;
  onSelect: (nextId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      `${option.label} ${option.slug} ${option.path}`.toLowerCase().includes(needle),
    );
  }, [options, query]);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);
  useEffect(() => {
    if (open) return;
    setQuery(selected ? `${selected.label} (${selected.path || `/${selected.slug}`})` : "");
  }, [selected, open]);

  return (
    <div ref={containerRef} className="relative w-full md:col-span-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-[10px] h-3.5 w-3.5 text-zinc-400" />
        <input
          type="text"
          className="w-full !rounded-md border border-zinc-300 bg-white py-2 pl-7 pr-2 text-xs"
          value={query}
          placeholder="Attach page (optional)"
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto !rounded-md border border-zinc-200 bg-white shadow-lg">
          <button
            type="button"
            className="block w-full border-b border-zinc-100 px-2 py-2 text-left text-xs text-zinc-500 hover:bg-zinc-50"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(null);
              setQuery("");
              setOpen(false);
            }}
          >
            No attached page
          </button>
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-xs text-zinc-500">No pages found.</p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.id}
                type="button"
                className="block w-full border-b border-zinc-100 px-2 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 last:border-b-0"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(option.id);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {option.label} ({option.path || `/${option.slug}`})
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function DomainsManager({ initialDomains }: DomainsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQueryFromParams = searchParams.get("q") ?? "";
  const initialDomainFromParams = searchParams.get("domain") ?? "";
  const [domains, setDomains] = useState<DomainRow[]>(initialDomains);
  const [searchQuery, setSearchQuery] = useState(initialQueryFromParams);
  const [selectedDomainId, setSelectedDomainId] = useState(initialDomainFromParams);
  const [savingId, setSavingId] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DomainRow | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isBackfillingDefaults, setIsBackfillingDefaults] = useState(false);
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [homepageButtonFieldErrors, setHomepageButtonFieldErrors] = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [newDomainForm, setNewDomainForm] = useState<DomainRow>({
    id: "new",
    hostname: "",
    displayName: "",
    notifyEmail: "",
    notifySms: null,
    isActive: true,
    ga4Id: null,
    metaPixelId: null,
    logoUrl: null,
    rightLogoUrl: null,
  faviconUrl: null,
    linkedinUrl: null,
    linkedinVisible: true,
    googleUrl: null,
    googleVisible: true,
    facebookUrl: null,
    facebookVisible: true,
    instagramUrl: null,
    instagramVisible: true,
    zillowUrl: null,
    zillowVisible: true,
    defaultHomepagePageId: null,
    defaultHomepageButtonLimit: 9,
    defaultHomepageOptions: [],
    defaultHomepageButtons: [],
  });

  const filteredDomains = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return domains.filter((d) => {
      if (selectedDomainId && d.id !== selectedDomainId) return false;
      if (!q) return true;
      return `${d.hostname} ${d.displayName} ${d.notifyEmail}`
        .toLowerCase()
        .includes(q);
    });
  }, [domains, searchQuery, selectedDomainId]);

  const selectedDomainLabel = useMemo(
    () => domains.find((d) => d.id === selectedDomainId)?.hostname ?? "",
    [domains, selectedDomainId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      const trimmed = searchQuery.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      if (selectedDomainId) next.set("domain", selectedDomainId);
      else next.delete("domain");
      const currentQuery = searchParams.toString();
      const nextQuery = next.toString();
      if (currentQuery === nextQuery) return;
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [pathname, router, searchParams, searchQuery, selectedDomainId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          (target.tagName === "INPUT" && target !== searchRef.current))
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);
  const { success: toastSuccess, error: toastError } = useAdminToast();
  const homepageButtonsSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function startEdit(domain: DomainRow) {
    setEditingId(domain.id);
    setDraft({ ...domain });
    setError(null);
    setHomepageButtonFieldErrors({});
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setError(null);
    setHomepageButtonFieldErrors({});
  }

  function updateDraft(patch: Partial<DomainRow>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function addDraftHomepageButton() {
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.defaultHomepageButtons.length >= prev.defaultHomepageButtonLimit) return prev;
      const nextIndex = prev.defaultHomepageButtons.length + 1;
      const nextId = `btn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        ...prev,
        defaultHomepageButtons: [
          ...prev.defaultHomepageButtons,
          {
            id: nextId,
            label: `Button ${nextIndex}`,
            href: "",
            target: "_self",
            styleMode: "light",
            ctaBgColor: "",
            ctaTextColor: "",
            ctaActiveBgColor: "",
            ctaActiveTextColor: "",
            isActive: true,
            isFeatured: false,
            linkedPageId: null,
          },
        ],
      };
    });
  }

  function validateHomepageButtons(buttons: DomainRow["defaultHomepageButtons"]) {
    const errors: Record<string, string> = {};
    for (let index = 0; index < buttons.length; index += 1) {
      const button = buttons[index];
      if (button.linkedPageId) continue;
      const href = String(button.href ?? "").trim();
      if (!href) continue;
      if (!isValidExternalHttpUrl(href)) {
        errors[`idx-${index}`] =
          `Button ${index + 1}: external link must start with http:// or https://`;
      }
    }
    return errors;
  }

  function updateDraftHomepageButton(
    index: number,
    patch: Partial<DomainRow["defaultHomepageButtons"][number]>,
  ) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.defaultHomepageButtons];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, ...patch };
      return { ...prev, defaultHomepageButtons: next };
    });
  }

  function removeDraftHomepageButton(index: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        defaultHomepageButtons: prev.defaultHomepageButtons.filter(
          (_item, idx) => idx !== index,
        ),
      };
    });
  }

  function setHomepageButtonsColorConfig(
    patch: Partial<{
      ctaBgColor: string;
      ctaTextColor: string;
      ctaActiveBgColor: string;
      ctaActiveTextColor: string;
    }>,
  ) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        defaultHomepageButtons: prev.defaultHomepageButtons.map((button) => ({
          ...button,
          ...patch,
        })),
      };
    });
  }

  function reorderDraftHomepageButtons(activeId: string, overId: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const oldIndex = prev.defaultHomepageButtons.findIndex((item) => item.id === activeId);
      const newIndex = prev.defaultHomepageButtons.findIndex((item) => item.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
      return {
        ...prev,
        defaultHomepageButtons: arrayMove(prev.defaultHomepageButtons, oldIndex, newIndex),
      };
    });
  }

  function onHomepageButtonsDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : "";
    if (!overId || activeId === overId) return;
    reorderDraftHomepageButtons(activeId, overId);
  }

  async function createDedicatedDefaultHomepage(domain: DomainRow) {
    setSavingId(domain.id);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/domains/${domain.id}/default-homepage`, {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json().catch(() => null)) as
          | {
              error?: string;
              page?: { id: string; slug: string; title: string | null; headline: string };
              defaultHomepagePageId?: string;
            }
          | null;
        if (!res.ok) {
          throw new Error(data?.error ?? "Failed to create dedicated default homepage.");
        }
        const page = data?.page;
        setDomains((prev) =>
          prev.map((d) => {
            if (d.id !== domain.id) return d;
            const options = [...d.defaultHomepageOptions];
            if (page && !options.some((opt) => opt.id === page.id)) {
              options.unshift({
                id: page.id,
                slug: page.slug,
                label: (page.title ?? "").trim() || page.headline || page.slug,
                path: `/${page.slug}`,
              });
            }
            return {
              ...d,
              defaultHomepageOptions: options,
              defaultHomepagePageId:
                data?.defaultHomepagePageId ?? d.defaultHomepagePageId,
            };
          }),
        );
        if (editingId === domain.id) {
          setDraft((prev) => {
            if (!prev || prev.id !== domain.id) return prev;
            const pageId = data?.defaultHomepagePageId ?? prev.defaultHomepagePageId;
            const pageLabel =
              (page?.title ?? "").trim() || page?.headline || page?.slug || "";
            const nextOptions = [...prev.defaultHomepageOptions];
            if (page && !nextOptions.some((opt) => opt.id === page.id)) {
              nextOptions.unshift({
                id: page.id,
                slug: page.slug,
                label: pageLabel,
                path: `/${page.slug}`,
              });
            }
            return {
              ...prev,
              defaultHomepagePageId: pageId,
              defaultHomepageOptions: nextOptions,
            };
          });
        }
        toastSuccess("Dedicated default homepage created and assigned.");
      } catch (e: any) {
        const message = e?.message ?? "Failed to create dedicated default homepage.";
        setError(message);
        toastError(message);
      } finally {
        setSavingId(null);
      }
    });
  }

  async function backfillDefaultHomepageForAllDomains() {
    setError(null);
    setIsBackfillingDefaults(true);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/domains/default-homepage/backfill", {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json().catch(() => null)) as
          | {
              error?: string;
              ok?: boolean;
              createdCount?: number;
              linkedCount?: number;
              totalDomains?: number;
            }
          | null;
        if (!res.ok) {
          throw new Error(data?.error ?? "Failed to backfill default home pages.");
        }
        toastSuccess(
          `Default home pages updated: ${data?.linkedCount ?? 0}/${data?.totalDomains ?? 0}. Created: ${data?.createdCount ?? 0}.`,
        );
        window.location.reload();
      } catch (e: any) {
        const message = e?.message ?? "Failed to backfill default home pages.";
        setError(message);
        toastError(message);
      } finally {
        setIsBackfillingDefaults(false);
      }
    });
  }

  async function saveDomain(domain: DomainRow) {
    setError(null);
    setHomepageButtonFieldErrors({});
    const notifyEmail = domain.notifyEmail?.trim() ?? "";
    const notifySms = domain.notifySms?.trim() ?? "";
    if (!isValidEmail(notifyEmail)) {
      const message = "Notify email must be a valid email (e.g., sample@gmail.com).";
      setError(message);
      toastError(message);
      return;
    }
    if (!isValidUsPhone(notifySms)) {
      const message =
        "Notify SMS must be a valid US number (10 digits, or 11 digits starting with 1).";
      setError(message);
      toastError(message);
      return;
    }
    const normalizedButtons = domain.defaultHomepageButtons.map((button) => {
      if (button.linkedPageId) {
        return {
          ...button,
          href: String(button.href ?? "").trim(),
        };
      }
      return {
        ...button,
        href: normalizeExternalHttpUrl(String(button.href ?? "")),
      };
    });
    for (const button of normalizedButtons) {
      if (button.linkedPageId) continue;
      const href = String(button.href ?? "").trim();
      if (!href) continue;
      if (!isValidExternalHttpUrl(href)) {
        const label = button.label?.trim() || "Homepage button";
        const message = `${label}: external link must start with http:// or https://`;
        setError(message);
        toastError(message);
        return;
      }
    }
    const buttonErrors = validateHomepageButtons(normalizedButtons);
    if (Object.keys(buttonErrors).length > 0) {
      setHomepageButtonFieldErrors(buttonErrors);
      const firstMessage = Object.values(buttonErrors)[0];
      setError(firstMessage);
      toastError(firstMessage);
      return;
    }
    setSavingId(domain.id || "new");
    startTransition(async () => {
      try {
        const isNew = !domain.id || domain.id === "new";
        const url = isNew
          ? "/api/admin/domains"
          : `/api/admin/domains/${domain.id}`;
        const method = isNew ? "POST" : "PATCH";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...domain,
            defaultHomepageButtons: normalizedButtons,
          }),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to save domain");
        const data = (await res.json()) as { domain: any };
        const mapped: DomainRow = {
          id: String(data.domain.id),
          hostname: String(data.domain.hostname),
          displayName: String(data.domain.displayName),
          notifyEmail: String(data.domain.notifyEmail),
          notifySms:
            data.domain.notifySms != null
              ? String(data.domain.notifySms)
              : null,
          isActive: Boolean(data.domain.isActive),
          ga4Id: data.domain.ga4Id != null ? String(data.domain.ga4Id) : null,
          metaPixelId:
            data.domain.metaPixelId != null
              ? String(data.domain.metaPixelId)
              : null,
          logoUrl:
            data.domain.logoUrl != null ? String(data.domain.logoUrl) : null,
          rightLogoUrl:
            data.domain.agentPhoto != null
              ? String(data.domain.agentPhoto)
              : null,
          faviconUrl:
            data.domain.faviconUrl != null
              ? String(data.domain.faviconUrl)
              : null,
          linkedinUrl:
            data.domain.linkedinUrl != null
              ? String(data.domain.linkedinUrl)
              : null,
          linkedinVisible:
            typeof data.domain.linkedinVisible === "boolean"
              ? data.domain.linkedinVisible
              : true,
          googleUrl:
            data.domain.googleUrl != null
              ? String(data.domain.googleUrl)
              : null,
          googleVisible:
            typeof data.domain.googleVisible === "boolean"
              ? data.domain.googleVisible
              : true,
          facebookUrl:
            data.domain.facebookUrl != null
              ? String(data.domain.facebookUrl)
              : null,
          facebookVisible:
            typeof data.domain.facebookVisible === "boolean"
              ? data.domain.facebookVisible
              : true,
          instagramUrl:
            data.domain.instagramUrl != null
              ? String(data.domain.instagramUrl)
              : null,
          instagramVisible:
            typeof data.domain.instagramVisible === "boolean"
              ? data.domain.instagramVisible
              : true,
          zillowUrl:
            data.domain.zillowUrl != null
              ? String(data.domain.zillowUrl)
              : null,
          zillowVisible:
            typeof data.domain.zillowVisible === "boolean"
              ? data.domain.zillowVisible
              : true,
          defaultHomepagePageId:
            data.domain.defaultHomepagePageId != null
              ? String(data.domain.defaultHomepagePageId)
              : null,
          defaultHomepageButtonLimit:
            typeof data.domain.defaultHomepageButtonLimit === "number"
              ? data.domain.defaultHomepageButtonLimit
              : domain.defaultHomepageButtonLimit,
          defaultHomepageOptions: domain.defaultHomepageOptions ?? [],
          defaultHomepageButtons: Array.isArray(data.domain.defaultHomepageButtons)
            ? data.domain.defaultHomepageButtons.map((item: any, index: number) => ({
                id: String(item?.id ?? `btn-${index + 1}`),
                label: String(item?.label ?? ""),
                href: String(item?.href ?? ""),
                target: item?.target === "_blank" ? "_blank" : "_self",
                styleMode: item?.styleMode === "dark" ? "dark" : "light",
                ctaBgColor: String(item?.ctaBgColor ?? ""),
                ctaTextColor: String(item?.ctaTextColor ?? ""),
                ctaActiveBgColor: String(item?.ctaActiveBgColor ?? ""),
                ctaActiveTextColor: String(item?.ctaActiveTextColor ?? ""),
                isActive: item?.isActive !== false,
                isFeatured: item?.isFeatured === true,
                linkedPageId:
                  item?.linkedPageId != null ? String(item.linkedPageId) : null,
              }))
            : domain.defaultHomepageButtons ?? [],
        };
        setDomains((prev) => {
          if (isNew) {
            // replace the 'new' row with returned one
            return prev
              .filter((d) => d.id !== "new")
              .concat(mapped);
          }
          return prev.map((d) =>
            d.id === domain.id ? mapped : d,
          );
        });
        setEditingId(null);
        setDraft(null);
        setHomepageButtonFieldErrors({});
        toastSuccess(isNew ? "Domain created successfully." : "Domain updated successfully.");
      } catch (e: any) {
        console.error(e);
        const message = e?.message ?? "Failed to save domain";
        setError(message);
        toastError(message);
      } finally {
        setSavingId(null);
      }
    });
  }

  async function deleteDomain(id: string) {
    if (!confirm("Delete this domain?")) return;
    setError(null);
    setSavingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/domains/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to delete domain");
        setDomains((prev) => prev.filter((d) => d.id !== id));
        toastSuccess("Domain deleted successfully.");
      } catch (e: any) {
        console.error(e);
        const message = e?.message ?? "Failed to delete domain";
        setError(message);
        toastError(message);
      } finally {
        setSavingId(null);
      }
    });
  }

  function openAddDialog() {
    setNewDomainForm({
      id: "new",
      hostname: "",
      displayName: "",
      notifyEmail: "",
      notifySms: null,
      isActive: true,
      ga4Id: null,
      metaPixelId: null,
      logoUrl: null,
      rightLogoUrl: null,
      faviconUrl: null,
      linkedinUrl: null,
      linkedinVisible: true,
      googleUrl: null,
      googleVisible: true,
      facebookUrl: null,
      facebookVisible: true,
      instagramUrl: null,
      instagramVisible: true,
      zillowUrl: null,
      zillowVisible: true,
      defaultHomepagePageId: null,
      defaultHomepageButtonLimit: 9,
      defaultHomepageOptions: [],
      defaultHomepageButtons: [],
    });
    setAddFormError(null);
    setAddDialogOpen(true);
  }

  function updateNewDomainForm(patch: Partial<DomainRow>) {
    setNewDomainForm((prev) => ({ ...prev, ...patch }));
  }

  async function createDomainFromDialog() {
    const { hostname, displayName, notifyEmail } = newDomainForm;
    if (!hostname?.trim() || !displayName?.trim() || !notifyEmail?.trim()) {
      setAddFormError("Hostname, display name, and notify email are required.");
      return;
    }
    if (!isValidEmail(notifyEmail)) {
      setAddFormError("Notify email must be a valid email (e.g., sample@gmail.com).");
      return;
    }
    if (!isValidUsPhone(newDomainForm.notifySms ?? "")) {
      setAddFormError(
        "Notify SMS must be a valid US number (10 digits, or 11 digits starting with 1).",
      );
      return;
    }
    setAddFormError(null);
    setSavingId("new");
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/domains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            hostname: newDomainForm.hostname.trim(),
            displayName: newDomainForm.displayName.trim(),
            notifyEmail: newDomainForm.notifyEmail.trim(),
            notifySms: newDomainForm.notifySms?.trim() || null,
            isActive: newDomainForm.isActive,
            ga4Id: newDomainForm.ga4Id?.trim() || null,
            metaPixelId: newDomainForm.metaPixelId?.trim() || null,
            logoUrl: newDomainForm.logoUrl || null,
            rightLogoUrl: newDomainForm.rightLogoUrl || null,
            faviconUrl: newDomainForm.faviconUrl || null,
            linkedinUrl: newDomainForm.linkedinUrl?.trim() || null,
            linkedinVisible: newDomainForm.linkedinVisible,
            googleUrl: newDomainForm.googleUrl?.trim() || null,
            googleVisible: newDomainForm.googleVisible,
            facebookUrl: newDomainForm.facebookUrl?.trim() || null,
            facebookVisible: newDomainForm.facebookVisible,
            instagramUrl: newDomainForm.instagramUrl?.trim() || null,
            instagramVisible: newDomainForm.instagramVisible,
            zillowUrl: newDomainForm.zillowUrl?.trim() || null,
            zillowVisible: newDomainForm.zillowVisible,
            defaultHomepagePageId: null,
            defaultHomepageButtonLimit: 9,
            defaultHomepageButtons: [],
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const message = data?.error ?? "Failed to create domain";
          setAddFormError(message);
          toastError(message);
          return;
        }
        const created = data.domain as Record<string, unknown>;
        const row: DomainRow = {
          id: String(created.id),
          hostname: String(created.hostname),
          displayName: String(created.displayName),
          notifyEmail: String(created.notifyEmail),
          notifySms: created.notifySms != null ? String(created.notifySms) : null,
          isActive: Boolean(created.isActive),
          ga4Id: created.ga4Id != null ? String(created.ga4Id) : null,
          metaPixelId: created.metaPixelId != null ? String(created.metaPixelId) : null,
          logoUrl: created.logoUrl != null ? String(created.logoUrl) : null,
          rightLogoUrl: created.agentPhoto != null ? String(created.agentPhoto) : null,
          faviconUrl: created.faviconUrl != null ? String(created.faviconUrl) : null,
          linkedinUrl:
            created.linkedinUrl != null ? String(created.linkedinUrl) : null,
          linkedinVisible:
            typeof created.linkedinVisible === "boolean"
              ? (created.linkedinVisible as boolean)
              : true,
          googleUrl:
            created.googleUrl != null ? String(created.googleUrl) : null,
          googleVisible:
            typeof created.googleVisible === "boolean"
              ? (created.googleVisible as boolean)
              : true,
          facebookUrl:
            created.facebookUrl != null ? String(created.facebookUrl) : null,
          facebookVisible:
            typeof created.facebookVisible === "boolean"
              ? (created.facebookVisible as boolean)
              : true,
          instagramUrl:
            created.instagramUrl != null ? String(created.instagramUrl) : null,
          instagramVisible:
            typeof created.instagramVisible === "boolean"
              ? (created.instagramVisible as boolean)
              : true,
          zillowUrl:
            created.zillowUrl != null ? String(created.zillowUrl) : null,
          zillowVisible:
            typeof created.zillowVisible === "boolean"
              ? (created.zillowVisible as boolean)
              : true,
          defaultHomepagePageId:
            created.defaultHomepagePageId != null
              ? String(created.defaultHomepagePageId)
              : null,
          defaultHomepageButtonLimit:
            typeof created.defaultHomepageButtonLimit === "number"
              ? (created.defaultHomepageButtonLimit as number)
              : 9,
          defaultHomepageOptions: [],
          defaultHomepageButtons: Array.isArray(created.defaultHomepageButtons)
            ? (created.defaultHomepageButtons as any[]).map((item, index) => ({
                id: String(item?.id ?? `btn-${index + 1}`),
                label: String(item?.label ?? ""),
                href: String(item?.href ?? ""),
                target: item?.target === "_blank" ? "_blank" : "_self",
                styleMode: item?.styleMode === "dark" ? "dark" : "light",
                ctaBgColor: String(item?.ctaBgColor ?? ""),
                ctaTextColor: String(item?.ctaTextColor ?? ""),
                ctaActiveBgColor: String(item?.ctaActiveBgColor ?? ""),
                ctaActiveTextColor: String(item?.ctaActiveTextColor ?? ""),
                isActive: item?.isActive !== false,
                isFeatured: item?.isFeatured === true,
                linkedPageId:
                  item?.linkedPageId != null ? String(item.linkedPageId) : null,
              }))
            : [],
        };
        setDomains((prev) => [...prev, row].sort((a, b) => a.hostname.localeCompare(b.hostname)));
        setAddDialogOpen(false);
        toastSuccess("Domain created successfully.");
      } catch (e: any) {
        console.error(e);
        const message = e?.message ?? "Failed to create domain";
        setAddFormError(message);
        toastError(message);
      } finally {
        setSavingId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
          Domains
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={backfillDefaultHomepageForAllDomains}
            disabled={isBackfillingDefaults || isPending}
            className="inline-flex items-center gap-2 !hidden !rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBackfillingDefaults ? "Creating default homes..." : "Backfill default homes"}
          </button>
        <button
          type="button"
          onClick={openAddDialog}
            className="inline-flex items-center gap-2 rounded-lg bg-[#18181b] px-[15px] py-[10px] text-[18px] !rounded-md font-semibold text-white shadow-sm hover:bg-[#000000] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#228BE6]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add domain
        </button>
        </div>
      </div>
      <div className="rounded-2xl border border-[#E9ECEF] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#ADB5BD]" />
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pages, slugs, or keywords…"
              className="w-full rounded-xl border border-[#fff] bg-[#fff] py-2.5 !border-0 pl-10 pr-4 text-sm text-[#212529] placeholder:text-[#ADB5BD] focus:border-[#fff] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#fff]"
            />
           
          </div>
          <div className="flex h-px w-full shrink-0 bg-[#E9ECEF] lg:h-8 lg:w-px" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                aria-label="Domain filter"
                value={selectedDomainId}
                onChange={(e) => setSelectedDomainId(e.target.value)}
                className="min-w-[140px] appearance-none rounded-xl bg-white py-2 pl-3 pr-8 text-sm font-medium text-[#212529] focus:border-[#fff] focus:outline-none focus:ring-2 focus:ring-[#fff]"
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
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-2 inline-flex items-center gap-1 !rounded-full border border-[#C5DCF7] bg-[#E7F1FF] px-2.5 py-1 text-xs font-semibold text-[#1864AB] hover:bg-[#d8eaff]"
            >
              Search: {searchQuery.trim()}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {selectedDomainLabel && (
            <button
              type="button"
              onClick={() => setSelectedDomainId("")}
              className="mt-2 inline-flex items-center gap-1 !rounded-full border border-[#DEE2E6] bg-[#F8F9FA] px-2.5 py-1 text-xs font-semibold text-[#495057] hover:bg-[#edf0f2]"
            >
              Domain: {selectedDomainLabel}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#212529]">
          Showing {filteredDomains.length} result{filteredDomains.length === 1 ? "" : "s"}{" "}
        </p>
      </div>

      <Dialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        title="Add domain"
        description="Create a new branded domain for your landing pages and leads."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createDomainFromDialog();
          }}
          className="space-y-4"
        >
          {addFormError && (
            <p className="!rounded-md bg-red-50 px-3 py-2 text-md text-red-700">
              {addFormError}
            </p>
          )}
          <div className="space-y-2">
            <label className="block text-md font-medium text-zinc-700">
              Hostname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newDomainForm.hostname}
              onChange={(e) => updateNewDomainForm({ hostname: e.target.value })}
              placeholder="bendhomes.us"
              className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-md font-medium text-zinc-700">
              Display name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newDomainForm.displayName}
              onChange={(e) => updateNewDomainForm({ displayName: e.target.value })}
              placeholder="Bend Homes"
              className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-md font-medium text-zinc-700">
              Notify email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={newDomainForm.notifyEmail}
              onChange={(e) => updateNewDomainForm({ notifyEmail: e.target.value })}
              placeholder="you@example.com"
              className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-md font-medium text-zinc-700">
              Notify SMS
            </label>
            <input
              type="text"
              value={newDomainForm.notifySms ?? ""}
              onChange={(e) =>
                updateNewDomainForm({ notifySms: e.target.value || null })
              }
              placeholder="+15551234567"
              className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-md font-medium text-zinc-700">
                GA4 ID
              </label>
              <input
                type="text"
                value={newDomainForm.ga4Id ?? ""}
                onChange={(e) =>
                  updateNewDomainForm({ ga4Id: e.target.value || null })
                }
                placeholder="G-XXXXXXX"
                className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-md font-medium text-zinc-700">
                Meta Pixel ID
              </label>
              <input
                type="text"
                value={newDomainForm.metaPixelId ?? ""}
                onChange={(e) =>
                  updateNewDomainForm({ metaPixelId: e.target.value || null })
                }
                placeholder="123456789012345"
                className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-md font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={newDomainForm.isActive}
                onChange={(e) =>
                  updateNewDomainForm({ isActive: e.target.checked })
                }
                className="h-4 w-4 rounded border-zinc-300"
              />
              Active
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-md font-medium text-zinc-700">
                Logo (left)
              </label>
              <ImageUploader
                label=""
                value={newDomainForm.logoUrl}
                onChange={(url) => updateNewDomainForm({ logoUrl: url ?? null })}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-md font-medium text-zinc-700">
                Logo (right)
              </label>
              <ImageUploader
                label=""
                value={newDomainForm.rightLogoUrl}
                onChange={(url) =>
                  updateNewDomainForm({ rightLogoUrl: url ?? null })
                }
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <label className="block text-md font-medium text-zinc-700">
              Favicon
              <span className="ml-1 text-xs font-normal text-zinc-500">
                (shown in browser tab; keep it square, ideally ≤ 24×24px)
              </span>
            </label>
            <ImageUploader
              label=""
              value={newDomainForm.faviconUrl}
              onChange={(url) =>
                updateNewDomainForm({ faviconUrl: url ?? null })
              }
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={() => setAddDialogOpen(false)}
              className="!rounded-md border border-zinc-300 px-4 py-2 text-md font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending && savingId === "new"}
              className="!rounded-md bg-zinc-900 px-4 py-2 text-md font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {isPending && savingId === "new" ? "Creating…" : "Create domain"}
            </button>
          </div>
        </form>
      </Dialog>

      {error && (
        <p className="text-md text-red-500">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {filteredDomains.map((d: DomainRow) => {
          const isEditing = editingId === d.id;
          const current = isEditing && draft && draft.id === d.id ? draft : d;

          return (
            <div
              key={d.id}
              className="!rounded-md bg-white p-4 shadow-sm ring-1 ring-zinc-100"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  {/* Top row: hostname + active + edit controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[14px] uppercase tracking-[0.16em] text-zinc-500">
                        Hostname
                      </p>
                      {isEditing ? (
                        <input
                          className="w-full max-w-xs !rounded-md border border-zinc-300 px-2 py-1 text-md"
                          value={current.hostname}
                          onChange={(e) =>
                            updateDraft({ hostname: e.target.value })
                          }
                          placeholder="bendhomes.us"
                        />
                      ) : (
                        <p className="text-sm font-medium text-zinc-900">
                          {d.hostname}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-[14px] font-medium text-zinc-700">
                        <input
                          type="checkbox"
                          checked={current.isActive}
                          disabled={!isEditing}
                          onChange={(e) =>
                            updateDraft({ isActive: e.target.checked })
                          }
                        />
                        Active
                      </label>
                      <div className="flex items-center gap-2 text-[14px]">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => draft && saveDomain(draft)}
                              disabled={isPending || !draft}
                              className="inline-flex items-center gap-1.5 !rounded-md border border-zinc-300 bg-zinc-900 px-2.5 py-1 text-white hover:bg-zinc-800 disabled:opacity-60"
                            >
                              <Check className="h-3 w-3" />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={isPending}
                              className="inline-flex items-center gap-1.5 !rounded-md border border-zinc-300 px-2.5 py-1 text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
                            >
                              <X className="h-3 w-3" />
                              <span>Cancel</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(d)}
                              className="inline-flex items-center gap-1.5 !rounded-md border border-zinc-300 px-2.5 py-1 text-zinc-700 hover:bg-zinc-100"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            {d.id !== "new" && (
                              <button
                                type="button"
                                onClick={() => deleteDomain(d.id)}
                                disabled={isPending}
                                className="inline-flex items-center gap-1 !rounded-md border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-60"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>Delete</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Main editable fields */}
                  <div className="grid gap-4 md:grid-cols-1">
                    <div className="space-y-2">
                      <label className="block text-[14px] font-medium text-zinc-700">
                        Display name
                      </label>
                      {isEditing ? (
                        <input
                          className="w-full !rounded-md border border-zinc-300 px-2 py-1 text-md"
                          value={current.displayName}
                          onChange={(e) =>
                            updateDraft({ displayName: e.target.value })
                          }
                          placeholder="Bend Homes"
                        />
                      ) : (
                        <p className="text-md text-zinc-800">
                          {d.displayName}
                        </p>
                      )}

                      <div className="rounded-xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-4 space-y-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Default Home Experience
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Control homepage source, button count, and custom CTA cards.
                          </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className="block text-[13px] font-semibold text-zinc-700">
                              Default home page
                            </label>
                            <p className="text-xs text-zinc-500">
                              Choose which published page opens at "/" for this domain.
                            </p>
                            {isEditing ? (
                              <select
                                className="w-full !rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-sm"
                                value={current.defaultHomepagePageId ?? ""}
                                onChange={(e) =>
                                  updateDraft({
                                    defaultHomepagePageId: e.target.value || null,
                                  })
                                }
                              >
                                <option value="">No fixed homepage</option>
                                {current.defaultHomepageOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label} ({opt.path || `/${opt.slug}`})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="!rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-800">
                                {d.defaultHomepageOptions.find(
                                  (opt) => opt.id === d.defaultHomepagePageId,
                                )?.label ?? "No fixed homepage"}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[13px] font-semibold text-zinc-700">
                              Number of page buttons
                            </label>
                            <p className="text-xs text-zinc-500">
                              Controls how many page buttons appear on homepage preview (1-24).
                            </p>
                            {isEditing ? (
                              <input
                                type="number"
                                min={1}
                                max={24}
                                className="w-full !rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-sm"
                                value={current.defaultHomepageButtonLimit}
                                onChange={(e) =>
                                  updateDraft({
                                    defaultHomepageButtonLimit: Math.min(
                                      24,
                                      Math.max(1, Number(e.target.value || 9)),
                                    ),
                                  })
                                }
                              />
                            ) : (
                              <p className="!rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-800">
                                {d.defaultHomepageButtonLimit}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => createDedicatedDefaultHomepage(current)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 !rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
                        >
                          Create new default home page
                        </button>

                        <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <label className="block text-[13px] font-semibold text-zinc-700">
                              Homepage buttons (custom text + URL)
                            </label>
                            {isEditing && (
                              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                                <button
                                  type="button"
                                  onClick={addDraftHomepageButton}
                                  disabled={
                                    current.defaultHomepageButtons.length >=
                                    current.defaultHomepageButtonLimit
                                  }
                                  className="inline-flex items-center gap-1 !rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-100"
                                >
                                  <Plus className="h-3 w-3" />
                                  Add button
                                </button>
                                {current.defaultHomepageButtons.length >=
                                current.defaultHomepageButtonLimit ? (
                                  <span className="text-[11px] font-medium text-amber-700">
                                    Limit reached ({current.defaultHomepageButtonLimit})
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">
                            Leave empty to use automatic published-page buttons.
                          </p>
                          {isEditing && (
                            <div className="rounded-xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                                CTA Colors
                              </p>
                              <div className="grid gap-2 md:grid-cols-4">
                              <label className="space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2">
                                <span className="block text-[11px] font-semibold text-zinc-700">CTA BG color</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    className="h-8 w-8 !rounded-md border border-zinc-300 bg-white p-0 shadow-sm"
                                    value={current.defaultHomepageButtons[0]?.ctaBgColor || "#ffffff"}
                                    onChange={(e) =>
                                      setHomepageButtonsColorConfig({ ctaBgColor: e.target.value })
                                    }
                                  />
                                  <input
                                    className="w-full !rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs uppercase tracking-wide"
                                    value={current.defaultHomepageButtons[0]?.ctaBgColor || ""}
                                    onChange={(e) =>
                                      setHomepageButtonsColorConfig({ ctaBgColor: e.target.value })
                                    }
                                    placeholder="#ffffff"
                                  />
                                </div>
                              </label>
                              <label className="space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2">
                                <span className="block text-[11px] font-semibold text-zinc-700">CTA text color</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    className="h-8 w-8 !rounded-md border border-zinc-300 bg-white p-0 shadow-sm"
                                    value={current.defaultHomepageButtons[0]?.ctaTextColor || "#111827"}
                                    onChange={(e) =>
                                      setHomepageButtonsColorConfig({ ctaTextColor: e.target.value })
                                    }
                                  />
                                  <input
                                    className="w-full !rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs uppercase tracking-wide"
                                    value={current.defaultHomepageButtons[0]?.ctaTextColor || ""}
                                    onChange={(e) =>
                                      setHomepageButtonsColorConfig({ ctaTextColor: e.target.value })
                                    }
                                    placeholder="#111827"
                                  />
                                </div>
                              </label>
                              <label className="space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2">
                                <span className="block text-[11px] font-semibold text-zinc-700">CTA Active BG color</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    className="h-8 w-8 !rounded-md border border-zinc-300 bg-white p-0 shadow-sm"
                                    value={current.defaultHomepageButtons[0]?.ctaActiveBgColor || "#f0cd72"}
                                    onChange={(e) =>
                                      setHomepageButtonsColorConfig({ ctaActiveBgColor: e.target.value })
                                    }
                                  />
                                  <input
                                    className="w-full !rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs uppercase tracking-wide"
                                    value={current.defaultHomepageButtons[0]?.ctaActiveBgColor || ""}
                                    onChange={(e) =>
                                      setHomepageButtonsColorConfig({ ctaActiveBgColor: e.target.value })
                                    }
                                    placeholder="#f0cd72"
                                  />
                                </div>
                              </label>
                              <label className="space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2">
                                <span className="block text-[11px] font-semibold text-zinc-700">CTA Active text color</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    className="h-8 w-8 !rounded-md border border-zinc-300 bg-white p-0 shadow-sm"
                                    value={current.defaultHomepageButtons[0]?.ctaActiveTextColor || "#111827"}
                                    onChange={(e) =>
                                      setHomepageButtonsColorConfig({ ctaActiveTextColor: e.target.value })
                                    }
                                  />
                                  <input
                                    className="w-full !rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs uppercase tracking-wide"
                                    value={current.defaultHomepageButtons[0]?.ctaActiveTextColor || ""}
                                    onChange={(e) =>
                                      setHomepageButtonsColorConfig({ ctaActiveTextColor: e.target.value })
                                    }
                                    placeholder="#111827"
                                  />
                                </div>
                              </label>
                              </div>
                            </div>
                          )}
                        {(isEditing
                          ? current.defaultHomepageButtons
                          : d.defaultHomepageButtons
                        ).length === 0 ? (
                          <div className="!rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                            No custom buttons configured.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <DndContext
                              sensors={homepageButtonsSensors}
                              collisionDetection={closestCenter}
                              onDragEnd={onHomepageButtonsDragEnd}
                            >
                              <SortableContext
                                items={(isEditing
                                  ? current.defaultHomepageButtons
                                  : d.defaultHomepageButtons
                                ).map((btn) => btn.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {(isEditing
                                  ? current.defaultHomepageButtons
                                  : d.defaultHomepageButtons
                                ).map((btn, idx) => (
                              <SortableHomepageButtonItem
                                key={`${btn.id}-${idx}`}
                                id={btn.id}
                                isEditing={isEditing}
                              >
                                <div className="grid gap-2 md:grid-cols-4">
                                  {isEditing ? (
                                    <>
                                      <input
                                        className="w-full !rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-xs"
                                        value={btn.label}
                                        onChange={(e) =>
                                          updateDraftHomepageButton(idx, { label: e.target.value })
                                        }
                                        placeholder="Button text"
                                      />
                                      
                                      <SearchableHomepageOptionSelector
                                        options={current.defaultHomepageOptions}
                                        value={btn.linkedPageId}
                                        onSelect={(nextPageId) => {
                                          const selectedPage = current.defaultHomepageOptions.find(
                                            (option) => option.id === nextPageId,
                                          );
                                          updateDraftHomepageButton(idx, {
                                            linkedPageId: nextPageId,
                                            href: selectedPage
                                              ? (selectedPage.path || `/${selectedPage.slug}`)
                                              : btn.href,
                                            label: selectedPage
                                              ? btn.label || selectedPage.label
                                              : btn.label,
                                          });
                                        }}
                                      />
                                      <div className="space-y-1">
                                        <input
                                          className="w-full !rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-xs"
                                          value={btn.href}
                                          readOnly={!!btn.linkedPageId}
                                          onChange={(e) => {
                                            updateDraftHomepageButton(idx, { href: e.target.value });
                                            setHomepageButtonFieldErrors((prev) => {
                                              const next = { ...prev };
                                              delete next[`idx-${idx}`];
                                              return next;
                                            });
                                          }}
                                          placeholder={
                                            btn.linkedPageId
                                              ? "Auto from selected page"
                                              : "https://example.com"
                                          }
                                        />
                                        {!btn.linkedPageId && homepageButtonFieldErrors[`idx-${idx}`] ? (
                                          <p className="text-[11px] text-red-600">
                                            {homepageButtonFieldErrors[`idx-${idx}`]}
                                          </p>
                                        ) : null}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-xs text-zinc-700">{btn.label || "Untitled"}</p>
                                      <p className="text-xs text-zinc-500 break-all">{btn.href || "—"}</p>
                                    </>
                                  )}
                                </div>
                                {isEditing && (
                                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                                    <label className="inline-flex items-center gap-1">
                                      <input
                                        type="checkbox"
                                        checked={btn.isActive}
                                        onChange={(e) =>
                                          updateDraftHomepageButton(idx, {
                                            isActive: e.target.checked,
                                          })
                                        }
                                      />
                                      Active
                                    </label>
                                    <select
                                      className="!rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs"
                                      value={btn.target}
                                      onChange={(e) =>
                                        updateDraftHomepageButton(idx, {
                                          target:
                                            e.target.value === "_blank"
                                              ? "_blank"
                                              : "_self",
                                        })
                                      }
                                    >
                                      <option value="_self">Open same tab</option>
                                      <option value="_blank">Open new tab</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => removeDraftHomepageButton(idx)}
                                      className="ml-auto inline-flex items-center gap-1 !rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Remove
                                    </button>
                                  </div>
                                )}
                              </SortableHomepageButtonItem>
                            ))}
                              </SortableContext>
                            </DndContext>
                          </div>
                        )}
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                      <label className="block text-[14px] font-medium text-zinc-700">
                        Notify email
                      </label>
                      {isEditing ? (
                        <input
                          className="w-full !rounded-md border border-zinc-300 px-2 py-1 text-md"
                          value={current.notifyEmail}
                          onChange={(e) =>
                            updateDraft({ notifyEmail: e.target.value })
                          }
                          placeholder="you@example.com"
                        />
                      ) : (
                        <p className="text-md text-zinc-800">
                          {d.notifyEmail}
                        </p>
                      )}
                        </div>
                        <div className="space-y-2">
                      <label className="block text-[14px] font-medium text-zinc-700">
                        Notify SMS
                      </label>
                      {isEditing ? (
                        <input
                          className="w-full !rounded-md border border-zinc-300 px-2 py-1 text-md"
                          value={current.notifySms ?? ""}
                          onChange={(e) =>
                            updateDraft({
                              notifySms: e.target.value || null,
                            })
                          }
                          placeholder="+15551234567"
                        />
                      ) : (
                        <p className="text-md text-zinc-800">
                          {d.notifySms || "—"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[14px] font-medium text-zinc-700">
                        GA4 ID
                      </label>
                      {isEditing ? (
                        <input
                          className="w-full !rounded-md border border-zinc-300 px-2 py-1 text-md"
                          value={current.ga4Id ?? ""}
                          onChange={(e) =>
                            updateDraft({
                              ga4Id: e.target.value || null,
                            })
                          }
                          placeholder="G-XXXXXXX"
                        />
                      ) : (
                        <p className="text-md text-zinc-800">
                          {d.ga4Id || "—"}
                        </p>
                      )}
                        </div>
                        <div className="space-y-2">
                      <label className="block text-[14px] font-medium text-zinc-700">
                        Meta Pixel ID
                      </label>
                      {isEditing ? (
                        <input
                          className="w-full !rounded-md border border-zinc-300 px-2 py-1 text-md"
                          value={current.metaPixelId ?? ""}
                          onChange={(e) =>
                            updateDraft({
                              metaPixelId: e.target.value || null,
                            })
                          }
                          placeholder="123456789012345"
                        />
                      ) : (
                        <p className="text-md text-zinc-800">
                          {d.metaPixelId || "—"}
                        </p>
                      )}
                        </div>
                      </div>
                    </div>
                     
                  </div>
                  {/* Social profiles moved to per-page Form tab; domain-level UI hidden */}
                </div>
              </div>

              {/* Logos + favicon row */}
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-[14px] font-medium uppercase tracking-[0.12em] text-zinc-600">
                    Logo (left)
                  </p>
                  <ImageUploader
                    label="Logo"
                    value={current.logoUrl}
                    onChange={(url) => {
                      const next = url ?? null;
                      if (isEditing) {
                        updateDraft({ logoUrl: next });
                      } else {
                        const updated: DomainRow = { ...d, logoUrl: next };
                        setDomains((prev) =>
                          prev.map((dom) => (dom.id === d.id ? updated : dom)),
                        );
                        void saveDomain(updated);
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-[14px] font-medium uppercase tracking-[0.12em] text-zinc-600">
                    Logo (right)
                  </p>
                  <ImageUploader
                    label="Right logo"
                    value={current.rightLogoUrl}
                    onChange={(url) => {
                      const next = url ?? null;
                      if (isEditing) {
                        updateDraft({ rightLogoUrl: next });
                      } else {
                        const updated: DomainRow = {
                          ...d,
                          rightLogoUrl: next,
                        };
                        setDomains((prev) =>
                          prev.map((dom) => (dom.id === d.id ? updated : dom)),
                        );
                        void saveDomain(updated);
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-[14px] font-medium uppercase tracking-[0.12em] text-zinc-600">
                    Favicon
                  </p>
                  <ImageUploader
                    label="Favicon"
                    value={current.faviconUrl}
                    allowedTypes={[
                      "image/x-icon",
                      "image/vnd.microsoft.icon",
                    ]}
                    accept=".ico,image/x-icon,image/vnd.microsoft.icon"
                    typeErrorMessage="Please upload a .ico favicon file."
                    previewClassName="relative w-[50px] h-[50px] overflow-hidden !rounded-md flex p-[4px] border border-[#eee] rounded-[2px]"
                    onChange={(url) => {
                      const next = url ?? null;
                      if (isEditing) {
                        updateDraft({ faviconUrl: next });
                      } else {
                        const updated: DomainRow = {
                          ...d,
                          faviconUrl: next,
                        };
                        setDomains((prev) =>
                          prev.map((dom) => (dom.id === d.id ? updated : dom)),
                        );
                        void saveDomain(updated);
                      }
                    }}
                  />
                  <p className="text-[11px] text-zinc-500">
                    <p>Upload Ico file for fav icon.</p> 
                    <p>Upload recommended file max 24px by 24px larger images will be
                    downscaled by browsers.</p>
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {domains.length === 0 && (
          <p className="py-8 text-center text-md text-zinc-500">
            No domains yet. Click &quot;+ Add domain&quot; to create one.
          </p>
        )}
        {domains.length > 0 && filteredDomains.length === 0 && (
          <p className="py-8 text-center text-md text-zinc-500">
            No domains match your search.
          </p>
        )}
      </div>
    </div>
  );
}
