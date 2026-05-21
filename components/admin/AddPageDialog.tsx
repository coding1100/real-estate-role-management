"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Plus } from "lucide-react";
import { useAdminToast } from "@/components/admin/useAdminToast";

interface DomainOption {
  id: string;
  hostname: string;
}

interface TemplateOption {
  id: string;
  type: string;
  name: string;
}

interface PageOption {
  id: string;
  slug: string;
  type: string;
  domainHostname: string;
  domainId: string;
}

interface AddPageDialogProps {
  domains: DomainOption[];
  templates: TemplateOption[];
  defaultTemplate?: string;
  pages?: PageOption[];
  /** Custom trigger: render buttons that call open(template?) to open the dialog with optional template pre-selected. If not set, the default "New page" button is shown. */
  trigger?: (open: (template?: string) => void) => React.ReactNode;
}

export function AddPageDialog({
  domains,
  templates,
  defaultTemplate = "buyer",
  pages = [],
  trigger: triggerRender,
}: AddPageDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"template" | "duplicate">("template");
  const [duplicateSearch, setDuplicateSearch] = useState("");
  const [duplicateSelectorOpen, setDuplicateSelectorOpen] = useState(false);
  const duplicateSelectorRef = useRef<HTMLDivElement | null>(null);
  const [duplicatePageId, setDuplicatePageId] = useState(
    pages[0]?.id ?? "",
  );
  const [duplicateDomainId, setDuplicateDomainId] = useState(
    pages[0]?.domainId ?? domains[0]?.id ?? "",
  );
  const [duplicateSlug, setDuplicateSlug] = useState(
    pages[0]?.slug ? `${pages[0].slug}-copy` : "",
  );
  const [duplicateType, setDuplicateType] = useState<string>(
    pages[0]?.type ?? "buyer",
  );
  const [form, setForm] = useState({
    domainId: domains[0]?.id ?? "",
    template: defaultTemplate,
    slug: "",
    headline: "",
    subheadline: "",
  });
  const { success: successToast, error: errorToast } = useAdminToast();

  const filteredDuplicatePages = useMemo(() => {
    const q = duplicateSearch.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((p) => {
      const hay = `${p.domainHostname} ${p.slug} ${p.type}`.toLowerCase();
      return hay.includes(q);
    });
  }, [duplicateSearch, pages]);

  const selectedDuplicatePageLabel = useMemo(() => {
    const selected = pages.find((p) => p.id === duplicatePageId);
    if (!selected) return "";
    return `${selected.domainHostname} — ${selected.slug} (${selected.type})`;
  }, [duplicatePageId, pages]);

  useEffect(() => {
    if (!duplicateSelectorOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = duplicateSelectorRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setDuplicateSelectorOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [duplicateSelectorOpen]);

  function openDialog(template?: string) {
    setMode("template");
    setDuplicateSearch("");
    setDuplicateSelectorOpen(false);
    setDuplicatePageId(pages[0]?.id ?? "");
    setDuplicateDomainId(pages[0]?.domainId ?? domains[0]?.id ?? "");
    setDuplicateSlug(pages[0]?.slug ? `${pages[0].slug}-copy` : "");
    setDuplicateType(pages[0]?.type ?? "buyer");
    setForm({
      domainId: domains[0]?.id ?? "",
      template: template ?? defaultTemplate,
      slug: "",
      headline: "",
      subheadline: "",
    });
    setError(null);
    setOpen(true);
  }

  function updateForm(patch: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "duplicate") {
      if (!duplicatePageId) {
        setError("Please select a page to duplicate.");
        errorToast("Please select a page to duplicate.");
        return;
      }
      startTransition(async () => {
        try {
          const res = await fetch("/api/admin/pages/duplicate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pageId: duplicatePageId,
              domainId: duplicateDomainId || null,
              slug: duplicateSlug,
                type: duplicateType,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            const message =
              data?.error ?? "Failed to duplicate page";
            setError(message);
            errorToast(message);
            return;
          }
          setOpen(false);
          successToast("Page duplicated successfully.", "Page duplicated");
          router.push(`/admin/pages/${data.page.id}/edit`);
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Failed to duplicate page";
          setError(message);
          errorToast(message);
        }
      });
      return;
    }

    if (!form.domainId?.trim() || !form.slug?.trim() || !form.headline?.trim()) {
      const message = "Domain, slug, and headline are required.";
      setError(message);
      errorToast(message);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domainId: form.domainId,
            type: form.template,
            slug: form.slug.trim(),
            headline: form.headline.trim(),
            subheadline: form.subheadline?.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const message =
            data?.error ?? "Failed to create page";
          setError(message);
          errorToast(message);
          return;
        }
        setOpen(false);
        successToast("Page created successfully.", "Page created");
        router.push(`/admin/pages/${data.page.id}/edit`);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to create page";
        setError(message);
        errorToast(message);
      }
    });
  }

  return (
    <>
      {triggerRender ? (
        triggerRender(openDialog)
      ) : (
        <button
          type="button"
          onClick={() => openDialog()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#18181b] px-[15px] py-[10px] text-[18px] !rounded-md font-semibold text-white shadow-sm hover:bg-[#000000] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#228BE6]"
        >
          <Plus className="h-3.5 w-3.5 text-white" />
          New page
        </button>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="New landing page"
        description="Create a new funnel from a master template or duplicate an existing page."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="!rounded-md bg-red-50 px-3 py-2 text-md text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-md">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="create-mode"
                value="template"
                checked={mode === "template"}
                onChange={() => setMode("template")}
              />
              <span>Create from template</span>
            </label>
            {pages.length > 0 && (
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="create-mode"
                  value="duplicate"
                  checked={mode === "duplicate"}
                  onChange={() => setMode("duplicate")}
                />
                <span>Duplicate existing page</span>
              </label>
            )}
          </div>

          {mode === "template" ? (
            <>
              <div className="space-y-2">
                <label className="block text-md font-medium text-zinc-700">
                  Domain <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.domainId}
                  onChange={(e) => updateForm({ domainId: e.target.value })}
                  className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  required
                >
                  <option value="">Select domain</option>
                  {domains.map((d: DomainOption) => (
                    <option key={d.id} value={d.id}>
                      {d.hostname}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-md font-medium text-zinc-700">
                    Template <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.template}
                    onChange={(e) => updateForm({ template: e.target.value })}
                    className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  >
                    {templates.map((t: TemplateOption) => (
                      <option key={t.id} value={t.type}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-md font-medium text-zinc-700">
                    Slug <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => updateForm({ slug: e.target.value })}
                    placeholder="free-homes-list"
                    className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-md font-medium text-zinc-700">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.headline}
                  onChange={(e) => updateForm({ headline: e.target.value })}
                  placeholder="Free List of Homes in Bend"
                  className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-md font-medium text-zinc-700">
                Meta Description
                </label>
                <textarea
                  value={form.subheadline}
                  onChange={(e) => updateForm({ subheadline: e.target.value })}
                  placeholder="Optional supporting copy"
                  rows={3}
                  className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="block text-md font-medium text-zinc-700">
                  Base page to duplicate <span className="text-red-500">*</span>
                </label>
                <div ref={duplicateSelectorRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDuplicateSelectorOpen((v) => !v)}
                    className="flex w-full items-center justify-between !rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  >
                    <span className="min-w-0 truncate">
                      {selectedDuplicatePageLabel || "Select a page"}
                    </span>
                    <span className="ml-2 text-zinc-400">▾</span>
                  </button>

                  {duplicateSelectorOpen && (
                    <div className="absolute z-50 mt-2 w-full overflow-hidden !rounded-md border border-zinc-200 bg-white shadow-lg">
                      <div className="border-b border-zinc-100 p-2">
                        <input
                          type="search"
                          autoFocus
                          value={duplicateSearch}
                          onChange={(e) => setDuplicateSearch(e.target.value)}
                          placeholder="Search pages… (domain, slug, type)"
                          className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        />
                        {duplicateSearch.trim().length > 0 && (
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Showing {filteredDuplicatePages.length} of{" "}
                            {pages.length}
                          </p>
                        )}
                      </div>
                      <div className="max-h-64 overflow-auto py-1">
                        {filteredDuplicatePages.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-zinc-500">
                            No matches.
                          </div>
                        ) : (
                          filteredDuplicatePages.map((p) => {
                            const label = `${p.domainHostname} — ${p.slug} (${p.type})`;
                            const selected = p.id === duplicatePageId;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setDuplicatePageId(p.id);
                                  setDuplicateDomainId(p.domainId);
                                  setDuplicateSlug(`${p.slug}-copy`);
                                  setDuplicateType(p.type);
                                  setDuplicateSelectorOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 ${
                                  selected
                                    ? "bg-zinc-50 font-medium text-zinc-900"
                                    : "text-zinc-700"
                                }`}
                                title={label}
                              >
                                <div className="truncate">{label}</div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-md font-medium text-zinc-700">
                  Type for new page <span className="text-red-500">*</span>
                </label>
                <select
                  value={duplicateType}
                  onChange={(e) => setDuplicateType(e.target.value)}
                  className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  required
                >
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-md font-medium text-zinc-700">
                  Domain for new page <span className="text-red-500">*</span>
                </label>
                <select
                  value={duplicateDomainId}
                  onChange={(e) => setDuplicateDomainId(e.target.value)}
                  className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  required
                >
                  <option value="">Select domain</option>
                  {domains.map((d: DomainOption) => (
                    <option key={d.id} value={d.id}>
                      {d.hostname}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-md font-medium text-zinc-700">
                  Slug for new page
                </label>
                <input
                  type="text"
                  value={duplicateSlug}
                  onChange={(e) => setDuplicateSlug(e.target.value)}
                  placeholder="auto-generated if left blank"
                  className="w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
                
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="!rounded-md border border-zinc-300 px-4 py-2 text-md font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="!rounded-md bg-zinc-900 px-4 py-2 text-md font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {isPending ? "Creating…" : "Create page"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
