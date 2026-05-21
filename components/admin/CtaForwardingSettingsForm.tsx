"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  type CtaForwardingDocument,
  type CtaForwardingNotifyEmail,
  type CtaForwardingRule,
  sanitizeCtaTitle,
} from "@/lib/types/ctaForwarding";
import { useAdminToast } from "@/components/admin/useAdminToast";
import { Search, Trash2, Upload } from "lucide-react";

interface CtaForwardingSettingsFormProps {
  initialRules: CtaForwardingRule[];
  multistepNotifyEachStep?: boolean;
  onMultistepNotifyEachStepChange?: (enabled: boolean) => void;
  onSaveRules?: (
    rules: CtaForwardingRule[],
    options?: { multistepNotifyEachStep?: boolean },
  ) => Promise<void>;
  saveButtonLabel?: string;
}

interface CtaForwardingRow extends CtaForwardingRule {
  id: string;
  forwardUrl: string;
  forwardEnabled: boolean;
  deliveryMode: "documents_with_notify" | "notify_only_form_data";
}

type ResendTemplateOption = {
  id: string;
  name: string;
};

type TemplatesFetchReason =
  | "missing_api_key"
  | "restricted_api_key"
  | "resend_api_error"
  | "no_templates"
  | null;

function SearchableTemplateSelector({
  templates,
  value,
  loading,
  disabled = false,
  onSelect,
}: {
  templates: ResendTemplateOption[];
  value: string;
  loading: boolean;
  disabled?: boolean;
  onSelect: (nextTemplateId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedTemplate = useMemo(
    () => templates.find((tpl) => tpl.id === value) ?? null,
    [templates, value],
  );

  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return templates;
    return templates.filter((tpl) =>
      `${tpl.name} ${tpl.id}`.toLowerCase().includes(needle),
    );
  }, [templates, query]);

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
  const displayValue = open
    ? query
    : (selectedTemplate ? selectedTemplate.name || selectedTemplate.id : "");

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-2 top-[10px] z-10 h-3.5 w-3.5 text-zinc-400" />
      <input
        type="text"
        className="h-9 w-full !rounded-md border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        value={displayValue}
        placeholder={
          disabled
            ? "Disabled for this delivery mode"
            : loading
              ? "Loading templates..."
              : "Use default template logic"
        }
        disabled={disabled}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          if (disabled) return;
          setOpen(true);
          setQuery(e.target.value);
        }}
      />
      {open && !disabled && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto !rounded-md border border-zinc-200 bg-white shadow-lg">
          <button
            type="button"
            className="block w-full border-b border-zinc-100 px-2 py-2 text-left text-xs text-zinc-500 hover:bg-zinc-50"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect("");
              setQuery("");
              setOpen(false);
            }}
          >
            Use default template logic
          </button>
          {loading ? (
            <p className="px-2 py-2 text-xs text-zinc-500">Loading templates...</p>
          ) : filteredTemplates.length === 0 ? (
            <p className="px-2 py-2 text-xs text-zinc-500">No matching templates.</p>
          ) : (
            filteredTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="block w-full border-b border-zinc-100 px-2 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 last:border-b-0"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(tpl.id);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {tpl.name || tpl.id}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function createRow(id: string, rule?: Partial<CtaForwardingRule>): CtaForwardingRow {
  const forwardUrl = rule?.forwardUrl?.trim() ?? "";
  return {
    id,
    ctaTitle: sanitizeCtaTitle(rule?.ctaTitle ?? ""),
    deliveryMode:
      rule?.deliveryMode === "notify_only_form_data"
        ? "notify_only_form_data"
        : "documents_with_notify",
    forwardUrl,
    forwardEnabled: rule?.forwardEnabled ?? !!forwardUrl,
    resendTemplateId: rule?.resendTemplateId?.trim() ?? "",
    resendTemplateName: rule?.resendTemplateName?.trim() ?? "",
    documents: Array.isArray(rule?.documents)
      ? [...rule!.documents!]
      : [],
    notifyEmails: Array.isArray(rule?.notifyEmails)
      ? [...rule!.notifyEmails!]
      : [],
  };
}

function isAbsoluteHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function isAllowedDocumentFile(file: File) {
  const fileName = (file.name || "").toLowerCase().trim();
  const ext = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";
  const mime = (file.type || "").toLowerCase();
  const allowedExt = new Set(["pdf", "doc", "docx"]);
  const allowedMime = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  return allowedExt.has(ext) || allowedMime.has(mime);
}

export function CtaForwardingSettingsForm({
  initialRules,
  multistepNotifyEachStep = false,
  onMultistepNotifyEachStepChange,
  onSaveRules,
  saveButtonLabel = "Save changes",
}: CtaForwardingSettingsFormProps) {
  const [rows, setRows] = useState<CtaForwardingRow[]>(
    initialRules.map((rule, index) => createRow(`rule-${index}`, rule)),
  );
  const [nextId, setNextId] = useState(rows.length);
  const [isPending, startTransition] = useTransition();
  const { success, error } = useAdminToast();
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ResendTemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesReason, setTemplatesReason] =
    useState<TemplatesFetchReason>(null);

  useEffect(() => {
    setRows(initialRules.map((rule, index) => createRow(`rule-${index}`, rule)));
    setNextId(initialRules.length);
  }, [initialRules]);

  useEffect(() => {
    let ignore = false;
    setTemplatesLoading(true);
    fetch("/api/admin/resend/templates")
      .then(async (res) => {
        if (!res.ok) {
          const errData = (await res.json().catch(() => null)) as
            | { reason?: TemplatesFetchReason; message?: string }
            | null;
          if (!ignore && errData?.message) {
            error(errData.message, "Unable to update");
          }
          if (!ignore) setTemplatesReason(errData?.reason ?? "resend_api_error");
          throw new Error("Failed to load templates");
        }
        const data = (await res.json()) as {
          templates?: Array<{ id?: string; name?: string }>;
          reason?: TemplatesFetchReason;
        };
        const normalized = (Array.isArray(data.templates) ? data.templates : [])
          .map((item) => ({
            id: typeof item.id === "string" ? item.id : "",
            name: typeof item.name === "string" ? item.name : "",
          }))
          .filter((item) => item.id);
        if (!ignore) {
          setTemplates(normalized);
          setTemplatesReason(data.reason ?? (normalized.length ? null : "no_templates"));
        }
      })
      .catch(() => {
        if (!ignore) {
          setTemplates([]);
          setTemplatesReason((prev) => prev ?? "resend_api_error");
        }
      })
      .finally(() => {
        if (!ignore) setTemplatesLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const validationErrors = useMemo(() => {
    return rows.map((row) => {
      const title = row.ctaTitle.trim();
      const url = row.forwardUrl.trim();
      return {
        ctaTitle: title.length === 0 ? "CTA title is required." : "",
        forwardUrl:
          row.forwardEnabled && url.length === 0
            ? "Forward URL is required when forwarding is active."
            : url.length > 0 && !isAbsoluteHttpUrl(url)
              ? "Forward URL must start with http:// or https://."
              : "",
      };
    });
  }, [rows]);

  const hasValidationErrors = validationErrors.some(
    (item) => !!item.ctaTitle || !!item.forwardUrl,
  );
  const dependencyErrors = useMemo(() => {
    return rows.map((row) => {
      const docs = (row.documents ?? []).filter(
        (doc) => doc.name?.trim().length && doc.url?.trim().length,
      );
      const emails = (row.notifyEmails ?? []).filter(
        (entry) => entry.email?.trim().length,
      );
      const docsRequireEmails =
        row.deliveryMode === "documents_with_notify" &&
        docs.length > 0 &&
        emails.length === 0
          ? "Add at least one notification email because a document is configured."
          : "";
      const emailsRequireDocs =
        row.deliveryMode === "documents_with_notify" &&
        emails.length > 0 &&
        docs.length === 0
          ? "Add at least one document because notification emails are configured."
          : "";
      const notifyOnlyRequiresEmails =
        row.deliveryMode === "notify_only_form_data" && emails.length === 0
          ? "Add at least one notification email for 'send form data without document' mode."
          : "";
      return { docsRequireEmails, emailsRequireDocs, notifyOnlyRequiresEmails };
    });
  }, [rows]);
  const hasDependencyErrors = dependencyErrors.some(
    (item) =>
      !!item.docsRequireEmails ||
      !!item.emailsRequireDocs ||
      !!item.notifyOnlyRequiresEmails,
  );

  function updateRow(
    id: string,
    key: keyof Pick<CtaForwardingRow, "ctaTitle" | "forwardUrl" | "forwardEnabled">,
    value: string | boolean,
  ) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [key]:
                key === "ctaTitle"
                  ? String(value)
                  : value,
            }
          : row,
      ),
    );
  }

  function updateDocuments(
    id: string,
    updater: (docs: CtaForwardingDocument[]) => CtaForwardingDocument[],
  ) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              documents: updater(row.documents ?? []),
            }
          : row,
      ),
    );
  }

  function updateNotifyEmails(
    id: string,
    updater: (list: CtaForwardingNotifyEmail[]) => CtaForwardingNotifyEmail[],
  ) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              notifyEmails: updater(row.notifyEmails ?? []),
            }
          : row,
      ),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, createRow(`rule-${nextId}`)]);
    setNextId((prev) => prev + 1);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasValidationErrors) {
      error(
        "Please fix CTA title/URL validation errors before saving.",
        "Unable to update",
      );
      return;
    }
    if (hasDependencyErrors) {
      const hasDocsWithoutEmails = dependencyErrors.some(
        (item) => !!item.docsRequireEmails,
      );
      const hasNotifyOnlyWithoutEmails = dependencyErrors.some(
        (item) => !!item.notifyOnlyRequiresEmails,
      );
      const hasEmailsWithoutDocs = dependencyErrors.some(
        (item) => !!item.emailsRequireDocs,
      );
      const dependencyMessages: string[] = [];
      if (hasDocsWithoutEmails) {
        dependencyMessages.push(
          "Documents are configured for one or more CTA rules, so add at least one Notification email (BCC/CC).",
        );
      }
      if (hasNotifyOnlyWithoutEmails) {
        dependencyMessages.push(
          "For 'send form data without document' mode, add at least one Notification email (BCC/CC).",
        );
      }
      if (hasEmailsWithoutDocs) {
        dependencyMessages.push(
          "Notification emails are configured for one or more CTA rules, so add at least one document.",
        );
      }
      error(dependencyMessages.join(" "), "Unable to update");
      return;
    }
    const payload: CtaForwardingRule[] = rows.map((row) => {
      const selectedTemplate = templates.find(
        (tpl) => tpl.id === row.resendTemplateId?.trim(),
      );
      const base: CtaForwardingRule = {
        ctaTitle: sanitizeCtaTitle(row.ctaTitle),
        deliveryMode: row.deliveryMode,
        forwardEnabled: row.forwardEnabled,
        ...(row.forwardUrl.trim()
          ? { forwardUrl: row.forwardUrl.trim() }
          : {}),
        ...(row.resendTemplateId?.trim()
          ? { resendTemplateId: row.resendTemplateId.trim() }
          : {}),
        ...(selectedTemplate?.name
          ? { resendTemplateName: selectedTemplate.name }
          : {}),
      };
      const docs = (row.documents ?? [])
        .filter(
          (doc) =>
            doc.name?.trim().length &&
            doc.url?.trim().length,
        )
        .map((doc) => ({
          ...doc,
          // Default to true unless explicitly turned off.
          autoSend: doc.autoSend !== false,
        }));
      const emails = (row.notifyEmails ?? [])
        .filter((entry) => entry.email?.trim().length)
        .map((entry) => ({
          ...entry,
          kind: entry.kind === "cc" || entry.kind === "bcc" ? entry.kind : "bcc",
        }));
      return {
        ...base,
        ...(row.deliveryMode === "documents_with_notify" && docs.length
          ? { documents: docs }
          : {}),
        ...(emails.length ? { notifyEmails: emails } : {}),
      };
    });
    startTransition(async () => {
      try {
        if (onSaveRules) {
          await onSaveRules(payload, {
            multistepNotifyEachStep,
          });
        } else {
          const res = await fetch("/api/admin/ui-settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ctaForwardingRules: payload }),
          });
          if (!res.ok) {
            throw new Error("Failed to update CTA forwarding settings");
          }
        }
        success("CTA forwarding rules saved.");
      } catch {
        error("Failed to save CTA forwarding rules.", "Unable to update");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            CTA URL Forwarding
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Map button titles to destination URLs and optional follow-up assets
            so each CTA can power a complete experience after form submit.
          </p>
        </div>
        {/* <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 !rounded-md border border-amber-700 bg-amber-600 px-3 py-1.5 text-sm font-medium text-amber-50 shadow-sm hover:bg-amber-700"
        >
          <span className="text-lg leading-none">＋</span>
          <span>Add rule</span>
        </button> */}
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center !rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? "Saving..." : saveButtonLabel}
        </button>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="!rounded-md border border-dashed border-zinc-300 p-3 text-sm text-zinc-600">
            No CTA forwarding rules configured. Click Add rule to create one.
          </p>
        ) : rows.map((row, index) => (
          <div
            key={row.id}
            className="space-y-4 rounded-lg border border-amber-100 bg-amber-50/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
                    CTA & redirect
                  </label>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                aria-label="Delete CTA rule"
                title="Delete CTA rule"
                className="inline-flex !hidden items-center !rounded-md p-1.5 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 md:items-start">
              <div className="flex h-full flex-col">
                <label className="mb-1 block min-h-5 text-xs font-medium text-zinc-600">
                  Selector / CTA Title
                </label>
                <input
                  type="text"
                  value={row.ctaTitle}
                  onChange={(e) => updateRow(row.id, "ctaTitle", e.target.value)}
                  placeholder="Book My Home Valuation"
                  className="h-9 w-full !rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
                {validationErrors[index]?.ctaTitle ? (
                  <p className="mt-1 text-xs text-red-600">
                    {validationErrors[index].ctaTitle}
                  </p>
                ) : null}
              </div>
              <div className="flex h-full flex-col">
                <div className="mb-1 flex min-h-5 items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-zinc-600">
                    URL forwarding input
                  </label>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-zinc-600 -mt-[5px]">
                    <span>
                      {row.forwardEnabled ? "Active" : "Inactive"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={row.forwardEnabled}
                      onClick={() =>
                        updateRow(
                          row.id,
                          "forwardEnabled",
                          !row.forwardEnabled,
                        )
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 !rounded-full border transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400 focus:ring-offset-1 ${
                        row.forwardEnabled
                          ? "border-amber-700 bg-amber-600"
                          : "border-zinc-300 bg-zinc-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          row.forwardEnabled
                            ? "translate-x-4"
                            : "translate-x-0.5"
                        }`}
                        style={{ marginTop: 1 }}
                      />
                    </button>
                  </label>
                </div>
                <input
                  type="url"
                  value={row.forwardUrl}
                  onChange={(e) => updateRow(row.id, "forwardUrl", e.target.value)}
                  placeholder="https://example.com/thank-you"
                  disabled={!row.forwardEnabled}
                  className={`h-9 w-full !rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 ${
                    row.forwardEnabled
                      ? "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900"
                      : "border-zinc-200 bg-zinc-100 text-zinc-500"
                  }`}
                />
                {validationErrors[index]?.forwardUrl ? (
                  <p className="mt-1 text-xs text-red-600">
                    {validationErrors[index].forwardUrl}
                  </p>
                ) : null}
                <p className="mt-1 min-h-8 text-[11px] text-zinc-500">
                  {row.forwardEnabled
                    ? "Visitors matching this CTA are redirected here after a successful form submission."
                    : "Forwarding is disabled. This CTA will not redirect after submit."}
                </p>
              </div>
            </div>
            <hr className="mt-4 !mb-8 border-zinc-200 !w-full"/>      
            <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
                Delivery mode
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 !text-md text-zinc-700">
                  <input
                    type="checkbox"
                    checked={row.deliveryMode === "documents_with_notify"}
                    onChange={() =>
                      setRows((prev) =>
                        prev.map((item) =>
                          item.id === row.id
                            ? { ...item, deliveryMode: "documents_with_notify" }
                            : item,
                        ),
                      )
                    }
                  />
                  Send documents to notification emails
                </label>
                <label className="inline-flex items-center gap-2 !text-md text-zinc-700">
                  <input
                    type="checkbox"
                    checked={row.deliveryMode === "notify_only_form_data"}
                    onChange={() =>
                      setRows((prev) =>
                        prev.map((item) =>
                          item.id === row.id
                            ? { ...item, deliveryMode: "notify_only_form_data" }
                            : item,
                        ),
                      )
                    }
                  />
                  Send form data without document
                </label>
              </div>
            </div>
            
            <div className="grid gap-3 md:grid-cols-3 md:items-start">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
                    Documents to send
                  </p>
                  {/* <span className="text-[11px] text-zinc-500">
                    Optional PDFs, guides, or policies for this CTA.
                  </span> */}
                </div>
                {row.deliveryMode !== "documents_with_notify" ? (
                  <p className="!rounded-md border border-dashed border-zinc-200 p-2 text-xs text-zinc-500">
                    Disabled in "send form data without document" mode.
                  </p>
                ) : (row.documents ?? []).length === 0 ? (
                  <p className="!rounded-md border border-dashed border-zinc-200 p-2 text-xs text-zinc-500">
                    No documents added. Use Add document to link guides, privacy
                    policies, etc.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(row.documents ?? []).map((doc, docIndex) => {
                      const ext = (() => {
                        const fromName = (doc.name ?? "").trim();
                        if (fromName.includes(".")) {
                          return fromName.split(".").pop()?.toUpperCase() ?? "";
                        }
                        const fromUrl = (doc.url ?? "").trim();
                        if (fromUrl.includes(".")) {
                          return fromUrl.split(".").pop()?.split("?")[0]?.split("#")[0]?.toUpperCase() ?? "";
                        }
                        return "";
                      })();
                      const uploadKey = `${row.id}-doc-${docIndex}`;
                      return (
                        <div
                          key={`${row.id}-doc-${docIndex}`}
                          className="grid gap-2 !rounded-md border border-zinc-200 p-2 text-xs md:grid-cols-[auto_minmax(1,1fr)]"
                        >
                          <div className="flex flex-col items-center justify-center gap-1 px-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-white text-[10px] font-semibold text-zinc-700 shadow-sm">
                              {ext || "FILE"}
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] text-zinc-600">
                                Auto send
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={doc.autoSend !== false}
                                onClick={() =>
                                  updateDocuments(row.id, (docs) =>
                                    docs.map((d, i) =>
                                      i === docIndex
                                        ? { ...d, autoSend: d.autoSend === false }
                                        : d,
                                    ),
                                  )
                                }
                                className={`relative inline-flex h-5 w-9 shrink-0 !rounded-full border transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400 focus:ring-offset-1 ${
                                  doc.autoSend !== false
                                    ? "border-amber-700 bg-amber-600"
                                    : "border-zinc-300 bg-zinc-200"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                    doc.autoSend !== false ? "translate-x-4" : "translate-x-0.5"
                                  }`}
                                  style={{ marginTop: 1 }}
                                />
                              </button>
                              <label className="mt-1 inline-flex cursor-pointer items-center justify-center !rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-700 hover:bg-zinc-50">
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.doc,.docx"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    if (!isAllowedDocumentFile(file)) {
                                      error(
                                        "Only .doc, .docx, and .pdf files are allowed.",
                                        "Unable to update",
                                      );
                                      e.target.value = "";
                                      return;
                                    }
                                    const MAX_BYTES = 20 * 1024 * 1024; // 20MB
                                    if (file.size > MAX_BYTES) {
                                      error(
                                        "Document must be smaller than 20MB.",
                                        "Unable to update",
                                      );
                                      e.target.value = "";
                                      return;
                                    }
                                    setUploadingKey(uploadKey);
                                    try {
                                      const sigRes = await fetch("/api/upload/signature", {
                                        method: "POST",
                                        headers: { "content-type": "application/json" },
                                        body: JSON.stringify({ kind: "document" }),
                                      });
                                      if (!sigRes.ok) {
                                        throw new Error("Upload failed");
                                      }
                                      const sig = (await sigRes.json()) as {
                                        uploadUrl: string;
                                        apiKey: string;
                                        timestamp: number;
                                        signature: string;
                                        folder: string;
                                        publicId: string;
                                        resourceType: "raw";
                                      };

                                      const cloudForm = new FormData();
                                      cloudForm.append("file", file);
                                      cloudForm.append("api_key", sig.apiKey);
                                      cloudForm.append("timestamp", String(sig.timestamp));
                                      cloudForm.append("signature", sig.signature);
                                      cloudForm.append("folder", sig.folder);
                                      cloudForm.append("public_id", sig.publicId);
                                      cloudForm.append("overwrite", "false");

                                      const uploadRes = await fetch(sig.uploadUrl, {
                                        method: "POST",
                                        body: cloudForm,
                                      });
                                      if (!uploadRes.ok) {
                                        throw new Error("Upload failed");
                                      }
                                      const uploaded = (await uploadRes.json()) as {
                                        secure_url?: string;
                                        original_filename?: string;
                                        public_id?: string;
                                        format?: string;
                                      };
                                      if (!uploaded.secure_url) {
                                        throw new Error("Missing URL from upload");
                                      }
                                      const uploadedUrl = uploaded.secure_url;
                                      updateDocuments(row.id, (docs) =>
                                        docs.map((d, i) =>
                                          i === docIndex
                                            ? {
                                                ...d,
                                                name:
                                                  uploaded.original_filename ||
                                                  d.name ||
                                                  file.name,
                                                url: uploadedUrl,
                                                mimeType:
                                                  file.type || d.mimeType,
                                                publicId:
                                                  uploaded.public_id ||
                                                  d.publicId,
                                                format:
                                                  uploaded.format ||
                                                  d.format,
                                                autoSend:
                                                  d.autoSend !== false,
                                              }
                                            : d,
                                        ),
                                      );
                                    } catch (err) {
                                      console.error(err);
                                      error("Document upload failed.", "Unable to update");
                                    } finally {
                                      setUploadingKey(null);
                                      e.target.value = "";
                                    }
                                  }}
                                />
                                {uploadingKey === uploadKey ? (
                                  <span>Uploading...</span>
                                ) : (
                                  <span
                                    aria-label="Upload document"
                                    title="Upload document"
                                    className="inline-flex items-center"
                                  >
                                    <Upload className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </label>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={doc.name}
                              onChange={(e) =>
                                updateDocuments(row.id, (docs) =>
                                  docs.map((d, i) =>
                                    i === docIndex
                                      ? { ...d, name: e.target.value }
                                      : d,
                                  ),
                                )
                              }
                              placeholder="Document name (shown in UI)"
                              className="w-full !rounded-md border border-zinc-300 px-2 py-1 text-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                            />
                            <input
                              type="url"
                              value={doc.url}
                              onChange={(e) =>
                                updateDocuments(row.id, (docs) =>
                                  docs.map((d, i) =>
                                    i === docIndex
                                      ? { ...d, url: e.target.value }
                                      : d,
                                  ),
                                )
                              }
                              placeholder="https://… (SharePoint, Google Docs, etc.)"
                              className="w-full !rounded-md border border-zinc-300 px-2 py-1 text-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                            />
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  updateDocuments(row.id, (docs) =>
                                    docs.filter((_, i) => i !== docIndex),
                                  )
                                }
                                aria-label="Delete document"
                                title="Delete document"
                                className="mt-1 inline-flex items-center !rounded-md p-1.5 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  disabled={row.deliveryMode !== "documents_with_notify"}
                  onClick={() =>
                    updateDocuments(row.id, (docs) => [
                      ...docs,
                      { name: "", url: "", autoSend: true },
                    ])
                  }
                  className="mt-1 !rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add document
                </button>
                {dependencyErrors[index]?.docsRequireEmails ? (
                  <p className="text-xs text-red-600">
                    {dependencyErrors[index].docsRequireEmails}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
                    Notification emails (BCC / CC)
                  </p>
                  {/* <span className="text-[11px] text-zinc-500">
                    Who should receive alerts for this CTA.
                  </span> */}
                </div>
                {(row.notifyEmails ?? []).length === 0 ? (
                  <p className="!rounded-md border border-dashed border-zinc-200 p-2 text-xs text-zinc-500">
                    No overrides configured. Domain-level notify email will be used.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(row.notifyEmails ?? []).map((entry, emailIndex) => (
                      <div
                        key={`${row.id}-email-${emailIndex}`}
                        className="flex items-center gap-2 !rounded-md border border-zinc-200 p-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <label className="flex flex-col gap-0.5 text-[10px] text-zinc-600">
                            <span>Send</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={entry.enabled ?? true}
                              onClick={() =>
                                updateNotifyEmails(row.id, (list) =>
                                  list.map((item, i) =>
                                    i === emailIndex
                                      ? {
                                          ...item,
                                          enabled: !(item.enabled ?? true),
                                        }
                                      : item,
                                  ),
                                )
                              }
                              className={`relative inline-flex h-5 w-9 shrink-0 !rounded-full border transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400 focus:ring-offset-1 ${
                                entry.enabled ?? true
                                  ? "border-amber-700 bg-amber-600"
                                  : "border-zinc-300 bg-zinc-200"
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                  entry.enabled ?? true
                                    ? "translate-x-4"
                                    : "translate-x-0.5"
                                }`}
                                style={{ marginTop: 1 }}
                              />
                            </button>
                          </label>
                          <select
                            value={entry.kind === "cc" ? "cc" : "bcc"}
                            onChange={(e) =>
                              updateNotifyEmails(row.id, (list) =>
                                list.map((item, i) =>
                                  i === emailIndex
                                    ? {
                                        ...item,
                                        kind: e.target.value as "cc" | "bcc",
                                      }
                                    : item,
                                ),
                              )
                            }
                            className="!rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-[11px] text-zinc-700 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                          >
                            <option value="bcc">BCC</option>
                            <option value="cc">CC</option>
                          </select>
                        </div>
                        <input
                          type="email"
                          value={entry.email}
                          onChange={(e) =>
                            updateNotifyEmails(row.id, (list) =>
                              list.map((item, i) =>
                                i === emailIndex
                                  ? { ...item, email: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="team@example.com"
                          className="flex-1 !rounded-md border border-zinc-300 px-2 py-1 text-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateNotifyEmails(row.id, (list) =>
                              list.filter((_, i) => i !== emailIndex),
                            )
                          }
                          aria-label="Delete notification email"
                          title="Delete notification email"
                          className="shrink-0 !rounded-md p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() =>
                    updateNotifyEmails(row.id, (list) => [
                      ...list,
                      { email: "", enabled: true, kind: "bcc" },
                    ])
                  }
                  className="mt-1 !rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                >
                  Add email
                </button>
                {dependencyErrors[index]?.notifyOnlyRequiresEmails ? (
                  <p className="text-xs text-red-600">
                    {dependencyErrors[index].notifyOnlyRequiresEmails}
                  </p>
                ) : null}
                {dependencyErrors[index]?.emailsRequireDocs ? (
                  <p className="text-xs text-red-600">
                    {dependencyErrors[index].emailsRequireDocs}
                  </p>
                ) : null}
              </div>

              <div
                className={`flex h-full flex-col ${
                  row.deliveryMode !== "documents_with_notify"
                    ? "pointer-events-none opacity-60"
                    : ""
                }`}
              >
                <label
                  className={`mb-1 block min-h-5 text-xs font-semibold uppercase tracking-[0.12em] ${
                    row.deliveryMode !== "documents_with_notify"
                      ? "text-zinc-400"
                      : "text-zinc-600"
                  }`}
                >
                  Resend template (for this CTA document email)
                </label>
                <SearchableTemplateSelector
                  templates={templates}
                  value={row.resendTemplateId ?? ""}
                  loading={templatesLoading}
                  disabled={row.deliveryMode !== "documents_with_notify"}
                  onSelect={(nextTemplateId) =>
                    setRows((prev) =>
                      prev.map((item) =>
                        item.id === row.id
                          ? {
                              ...item,
                              resendTemplateId: nextTemplateId,
                              resendTemplateName:
                                templates.find((t) => t.id === nextTemplateId)?.name ?? "",
                            }
                          : item,
                      ),
                    )
                  }
                />
                {row.deliveryMode !== "documents_with_notify" ? (
                  <p className="mt-1 min-h-8 text-[11px] text-zinc-500">
                    Disabled in "send form data without document" mode. Default template logic will be used.
                  </p>
                ) : row.resendTemplateId ? (
                  <p className="mt-1 min-h-8 text-[11px] text-zinc-500">
                    Selected template ID:{" "}
                    <span className="font-mono">{row.resendTemplateId}</span>
                  </p>
                ) : (
                  <p className="mt-1 min-h-8 text-[11px] text-zinc-500">
                    No template selected. Existing document email rendering will be used.
                  </p>
                )}
                {row.deliveryMode === "documents_with_notify" &&
                  !templatesLoading &&
                  templates.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    {templatesReason === "missing_api_key"
                      ? "RESEND_API_KEY is missing on the server."
                      : templatesReason === "restricted_api_key"
                        ? "Your Resend API key is send-only (restricted), so template listing is blocked."
                      : templatesReason === "no_templates"
                        ? "No templates found in your Resend account."
                        : "Unable to fetch templates from Resend right now."}
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 !rounded border-zinc-300"
                  checked={multistepNotifyEachStep}
                  onChange={(e) =>
                    onMultistepNotifyEachStepChange?.(e.target.checked)
                  }
                />
                <span>
                  <span className="block text-sm font-medium text-zinc-800">
                    Multistep: notify on this page's Continue
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500">
                    When this page is a step in a multistep flow (or the home-value
                    entry step), turning this on sends the CTA Management
                    notification email each time the visitor clicks this step's CTA
                    to go forward. Final submit still uses the normal lead flow.
                  </span>
                </span>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={addRow}
          className="hidden !rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-red-50"
        >
          Add rule
        </button>
        
      </div>
    </form>
  );
}

