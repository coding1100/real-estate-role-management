"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X, ChevronDown, GripVertical, Search } from "lucide-react";

interface PageOption {
  id: string;
  slug: string;
  displaySlug?: string;
  title: string;
  headline: string;
  type: string;
}

interface MultistepPageSelectorProps {
  domainId: string;
  value: string[];
  onChange: (slugs: string[]) => void;
  disabled?: boolean;
}

export function MultistepPageSelector({
  domainId,
  value,
  onChange,
  disabled,
}: MultistepPageSelectorProps) {
  const [pages, setPages] = useState<PageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  useEffect(() => {
    if (!domainId) {
      setPages([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async (attempt: number) => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/pages/for-multistep?domainId=${encodeURIComponent(
            domainId,
          )}`,
        );
        const data = await res
          .json()
          .catch(() => ({ error: "Failed to parse response" }));
        if (!res.ok) {
          const message =
            (data && typeof data.error === "string" && data.error) ||
            "Failed to fetch pages";
          throw new Error(message);
        }
        if (!cancelled) {
          setPages(data.pages ?? []);
        }
      } catch (err: any) {
        if (attempt < 2) {
          // Simple retry once after a short delay for transient issues like timeouts.
          setTimeout(() => load(attempt + 1), 400);
          return;
        }
        if (!cancelled) {
          setError(err?.message ?? "Failed to load pages");
          setPages([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load(1);

    return () => {
      cancelled = true;
    };
  }, [domainId]);

  const slugToPage = new Map(pages.map((p) => [p.slug, p]));
  const selectedSlugs = value;
  const availableToAdd = pages.filter((p) => !selectedSlugs.includes(p.slug));

  const filteredAvailable = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableToAdd;
    return availableToAdd.filter((p) => {
      const title = p.title || "";
      const headline = p.headline || "";
      return (
        p.slug.toLowerCase().includes(q) ||
        (p.displaySlug ?? "").toLowerCase().includes(q) ||
        title.toLowerCase().includes(q) ||
        headline.toLowerCase().includes(q)
      );
    });
  }, [availableToAdd, search]);

  const handleAdd = (slug: string) => {
    if (selectedSlugs.includes(slug)) return;
    onChange([...selectedSlugs, slug]);
  };

  const handleRemove = (slug: string) => {
    onChange(selectedSlugs.filter((s) => s !== slug));
  };

  const handleReorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    if (from >= selectedSlugs.length || to >= selectedSlugs.length) return;
    const next = [...selectedSlugs];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  if (loading) {
    return (
      <div className="!rounded-md border border-zinc-200 bg-zinc-50 px-3 py-4 text-sm text-zinc-500">
        Loading pages…
      </div>
    );
  }

  if (error) {
    return (
      <div className="!rounded-md border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-700">Selected steps (in order)</p>
        {selectedSlugs.length === 0 ? (
          <p className="text-xs text-zinc-500">No steps selected. Add pages below.</p>
        ) : (
          <ul className="space-y-1.5">
            {selectedSlugs.map((slug, idx) => {
              const page = slugToPage.get(slug);
              return (
                <li
                  key={slug}
                  className={`flex items-center justify-between !rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm transition-colors transition-transform ${
                    dragIndex === idx
                      ? "ring-2 ring-zinc-400 bg-zinc-50 scale-[0.99]"
                      : dragOverIndex === idx
                        ? "bg-zinc-100"
                        : "hover:bg-zinc-50"
                  }`}
                  draggable={!disabled}
                  onDragStart={(e) => {
                    if (disabled) return;
                    setDragIndex(idx);
                    // Use a transparent drag image so the list itself feels like it's moving
                    if (e.dataTransfer) {
                      const img = new Image();
                      img.src =
                        "data:image/gif;base64,R0lGODlhAQABAIABAP///wAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
                      e.dataTransfer.setDragImage(img, 0, 0);
                    }
                  }}
                  onDragOver={(e) => {
                    if (disabled) return;
                    e.preventDefault();
                    if (dragOverIndex !== idx) {
                      setDragOverIndex(idx);
                    }
                  }}
                  onDrop={(e) => {
                    if (disabled) return;
                    e.preventDefault();
                    if (dragIndex === null) return;
                    handleReorder(dragIndex, idx);
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragLeave={() => {
                    if (dragOverIndex === idx) {
                      setDragOverIndex(null);
                    }
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                >
                  <span className="flex items-center gap-2">
                    {!disabled && (
                      <span className="text-zinc-400 cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span className="text-zinc-400 font-mono text-xs w-5 text-right">
                      {idx + 1}.
                    </span>
                    {page ? (
                      <span className="text-zinc-800">
                        {`${(page.title || page.headline || "").trim()} (${page.displaySlug || `/${page.slug}`})`}
                      </span>
                    ) : (
                      <span className="text-amber-700">
                        {slug} <span className="text-amber-600">(page not found)</span>
                      </span>
                    )}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemove(slug)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                      aria-label={`Remove ${slug}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-700">Add steps</p>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={disabled || availableToAdd.length === 0}
            className="flex w-full items-center justify-between !rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>
              {availableToAdd.length === 0
                ? "All pages added"
                : `Select page (${availableToAdd.length} available)`}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-zinc-500 transition-transform ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {dropdownOpen && availableToAdd.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-hidden !rounded-md border border-zinc-200 bg-white shadow-lg">
              <div className="border-b border-zinc-200 px-2 py-1.5">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-zinc-400">
                    <Search className="h-3.5 w-3.5" />
                  </span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter pages…"
                    className="w-full !rounded-md border border-zinc-200 bg-white pl-7 pr-2 py-1 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>
              </div>
              <div className="max-h-40 overflow-auto py-1">
                {filteredAvailable.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-zinc-500">
                    No pages match your search.
                  </p>
                ) : (
                  filteredAvailable.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        handleAdd(p.slug);
                        setDropdownOpen(false);
                        setSearch("");
                      }}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
                    >
                      <span className="text-zinc-700">
                        {`${(p.title || p.headline || "").trim()} (${p.displaySlug || `/${p.slug}`})`}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        {pages.length === 0 && (
          <p className="text-xs text-amber-600">
            No published pages in this domain. Publish at least one page first.
          </p>
        )}
      </div>
    </div>
  );
}
