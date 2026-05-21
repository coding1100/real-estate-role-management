"use client";

import { useEffect, useRef, useState } from "react";
import type { FormSchema, FormFieldConfig } from "@/lib/types/form";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

interface FormEditorProps {
  value: FormSchema | null;
  onChange: (schema: FormSchema) => void;
  editorFonts?: { label: string; cssFamily: string }[];
}

const ID_SYNC_DEBOUNCE_MS = 900;

/** Fix empty/invalid whenFieldId and mismatched equals for option-based fields. */
function normalizeFormVisibilityFields(
  fields: FormFieldConfig[],
): FormFieldConfig[] {
  let changed = false;
  const next = fields.map((field, index) => {
    const vis = field.visibility as
      | { whenFieldId?: string; equals?: string }
      | undefined;
    if (!vis) return field;
    const others = fields.filter((_, i) => i !== index);
    if (others.length === 0) {
      changed = true;
      return { ...field, visibility: undefined };
    }
    let whenFieldId = vis.whenFieldId ?? "";
    let equals = vis.equals ?? "";
    if (!whenFieldId || !others.some((f) => f.id === whenFieldId)) {
      const preferred =
        others.find(
          (f) =>
            (f.type === "radio" ||
              f.type === "select" ||
              f.type === "checkbox") &&
            Array.isArray(f.options) &&
            f.options.length > 0,
        ) ?? others[0];
      whenFieldId = preferred.id;
      equals =
        preferred.options?.[0]?.value != null
          ? String(preferred.options[0].value)
          : "";
      changed = true;
      return { ...field, visibility: { whenFieldId, equals } };
    }
    const ctrl = others.find((f) => f.id === whenFieldId);
    const opts = ctrl?.options as Array<{ value: string }> | undefined;
    if (opts?.length) {
      const ok = opts.some((o) => String(o.value) === String(equals));
      if (!ok) {
        changed = true;
        return {
          ...field,
          visibility: { whenFieldId, equals: String(opts[0].value) },
        };
      }
    }
    return field;
  });
  if (!changed) return fields;
  return next;
}

export function FormEditor({ value, onChange, editorFonts }: FormEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);
  const schema: FormSchema =
    value && Array.isArray((value as any).fields)
      ? value
      : { fields: [] };
  const schemaFieldIds = Array.from(
    new Set(
      schema.fields
        .map((field) => String(field.id ?? "").trim())
        .filter((id) => id.length > 0),
    ),
  );
  const [rawJsonText, setRawJsonText] = useState<string>(() =>
    JSON.stringify(schema, null, 2),
  );

  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const idSyncTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    return () => {
      idSyncTimersRef.current.forEach(clearTimeout);
      idSyncTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const normalized = normalizeFormVisibilityFields(schema.fields);
    if (normalized === schema.fields) return;
    if (JSON.stringify(normalized) === JSON.stringify(schema.fields)) return;
    onChange({ fields: normalized });
  }, [schema.fields, onChange]);

  function stripHtml(html: string): string {
    if (!html) return "";
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function labelToId(label: string, fallbackIndex: number) {
    const base = stripHtml(label)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_");
    const trimmed = base.replace(/_+/g, "_").replace(/^_|_$/g, "");
    if (!trimmed) return `field_${fallbackIndex + 1}`;
    return trimmed;
  }

  /** Ensures no two fields share the same id (excluding current index when replacing). */
  function makeUniqueFieldId(
    base: string,
    fields: FormFieldConfig[],
    excludeIndex: number,
  ): string {
    if (!base) return `field_${excludeIndex + 1}`;
    let candidate = base;
    let suffix = 2;
    while (
      fields.some((f, i) => i !== excludeIndex && f.id === candidate)
    ) {
      candidate = `${base}_${suffix}`;
      suffix++;
    }
    return candidate;
  }

  /** When a field id changes, update conditional rules that pointed at the old id. */
  function remapVisibilityWhenFieldId(
    fields: FormFieldConfig[],
    oldId: string,
    newId: string,
  ): FormFieldConfig[] {
    if (oldId === newId) return fields;
    return fields.map((f) => {
      const vis = (f as FormFieldConfig & { visibility?: { whenFieldId?: string; equals?: string } }).visibility;
      if (vis?.whenFieldId === oldId) {
        return {
          ...f,
          visibility: { ...vis, whenFieldId: newId },
        } as FormFieldConfig;
      }
      return f;
    });
  }

  function syncFieldIdFromLabel(index: number) {
    const fields = schemaRef.current.fields;
    const field = fields[index];
    if (!field) return;
    const newLabel = field.label ?? "";
    const derived = labelToId(newLabel, index);
    const newId = makeUniqueFieldId(derived, fields, index);
    const oldId = field.id;
    if (newId === oldId) return;
    const next = [...fields];
    next[index] = {
      ...next[index],
      id: newId,
    };
    onChange({
      fields: remapVisibilityWhenFieldId(next, oldId, newId),
    });
  }

  function scheduleFieldIdSync(index: number) {
    const prev = idSyncTimersRef.current.get(index);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      idSyncTimersRef.current.delete(index);
      syncFieldIdFromLabel(index);
    }, ID_SYNC_DEBOUNCE_MS);
    idSyncTimersRef.current.set(index, t);
  }

  function flushFieldIdSync(index: number) {
    const prev = idSyncTimersRef.current.get(index);
    if (prev) {
      clearTimeout(prev);
      idSyncTimersRef.current.delete(index);
    }
    syncFieldIdFromLabel(index);
  }

  function updateField(index: number, patch: Partial<FormFieldConfig>) {
    const fields = [...schema.fields];
    fields[index] = { ...fields[index], ...patch };
    onChange({ fields });
  }

  function getPlainLabel(field: FormFieldConfig): string {
    const base = stripHtml(field.label ?? "");
    return base || field.id;
  }

  function addField() {
    const idx = schema.fields.length;
    const tentative = labelToId("New Field", idx);
    const nextId = makeUniqueFieldId(tentative, schema.fields, idx);
    const fields = [
      ...schema.fields,
      {
        id: nextId,
        type: "text" as const,
        label: "New Field",
        order: idx + 1,
      },
    ];
    onChange({ fields });
  }

  function removeField(index: number) {
    const fields = schema.fields.filter((_, i) => i !== index);
    // Re-normalize order so DynamicForm sorts correctly
    const withOrder = fields.map((f, i) => ({ ...f, order: i + 1 }));
    onChange({ fields: withOrder });
  }

  function handleJsonChange(text: string) {
    try {
      const parsed = JSON.parse(text) as FormSchema;
      if (!parsed.fields || !Array.isArray(parsed.fields)) {
        throw new Error("Invalid schema: missing fields array");
      }
      onChange(parsed);
      setRawJsonText(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Invalid JSON");
    }
  }

  async function copyFieldId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedFieldId(id);
      setTimeout(() => {
        setCopiedFieldId((current) => (current === id ? null : current));
      }, 1200);
    } catch {
      setCopiedFieldId(null);
    }
  }

  const loadDefaultContactPreset = () => {
    onChange({
      fields: [
        {
          id: "name",
          type: "text",
          label: "Name",
          placeholder: "Name",
          required: true,
          order: 1,
        },
        {
          id: "email",
          type: "email",
          label: "Email",
          placeholder: "Email",
          required: true,
          order: 2,
        },
        {
          id: "phone",
          type: "phone",
          label: "Phone",
          placeholder: "Phone",
          required: false,
          order: 3,
        },
      ],
    });
  };

  const loadQuestionnairePreset = () => {
    onChange({
      fields: [
        {
          id: "own_property_tetherow",
          type: "radio",
          label: "1. Do you currently own property in Tetherow?",
          required: true,
          order: 1,
          options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }],
        },
        {
          id: "selling_12_months",
          type: "radio",
          label: "2. Are you considering selling within the next 12 months?",
          required: true,
          order: 2,
          options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }],
        },
        {
          id: "optional_report_focus",
          type: "textarea",
          label: "Optional:",
          required: false,
          order: 3,
          optionalSection: true,
        },
      ],
    });
  };

  const loadDetailedPerspectivePreset = () => {
    onChange({
      fields: [
        {
          id: "service_type",
          type: "radio",
          label: "",
          required: true,
          order: 1,
          options: [
            { value: "market_review", label: "Schedule a 15-Minute Market Review" },
            { value: "valuation", label: "Request a Confidential Valuation Analysis" },
          ],
        },
        {
          id: "email",
          type: "email",
          label: "",
          placeholder: "Email",
          required: true,
          order: 2,
        },
      ],
    });
  };

  function handleReorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const fields = [...schema.fields];
    const [moved] = fields.splice(fromIndex, 1);
    fields.splice(toIndex, 0, moved);
    // Update order field to match new array index
    const withOrder = fields.map((f, i) => ({ ...f, order: i + 1 }));
    onChange({ fields: withOrder });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-md font-medium text-zinc-700">
          Fields
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadDefaultContactPreset}
            className="!rounded-md border border-zinc-300 bg-white px-2 py-1 text-md font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Load default contact form
          </button>
          <button
            type="button"
            onClick={loadQuestionnairePreset}
            className="!rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-md font-medium text-amber-800 hover:bg-amber-100"
          >
            Load questionnaire preset
          </button>
          <button
            type="button"
            onClick={loadDetailedPerspectivePreset}
            className="!rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-md font-medium text-amber-800 hover:bg-amber-100"
          >
            Load detailed perspective preset
          </button>
          <button
            type="button"
            onClick={addField}
            className="!rounded-md border border-zinc-300 px-2 py-1 text-md font-medium text-zinc-800 hover:bg-zinc-100"
          >
            + Add field
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {schema.fields.map((field, index) => {
          const isDragging = dragIndex === index;
          const otherFields = schema.fields.filter((_, i) => i !== index);
          const preferredControllingField =
            otherFields.find(
              (f) =>
                (f.type === "radio" ||
                  f.type === "select" ||
                  f.type === "checkbox") &&
                Array.isArray(f.options) &&
                f.options.length > 0,
            ) ?? otherFields[0];
          const visibility = (field as any).visibility as
            | { whenFieldId: string; equals: string }
            | undefined;
          const effectiveWhenFieldId =
            visibility && otherFields.length > 0
              ? otherFields.some((f) => f.id === visibility.whenFieldId)
                ? visibility.whenFieldId
                : (preferredControllingField ?? otherFields[0])!.id
              : undefined;
          const controlling =
            visibility && effectiveWhenFieldId
              ? otherFields.find((f) => f.id === effectiveWhenFieldId)
              : undefined;
          const controllingOptions =
            controlling && Array.isArray((controlling as any).options)
              ? ((controlling as any).options as Array<{
                  value: string;
                  label: string;
                }>)
              : [];
          const resolvedEquals =
            controllingOptions.length > 0
              ? controllingOptions.some(
                  (o) =>
                    String(o.value) === String(visibility?.equals ?? ""),
                )
                ? visibility!.equals
                : controllingOptions[0].value
              : (visibility?.equals ?? "");
          return (
            <div
              key={field.id}
              className={`flex items-start justify-between gap-2 !rounded-md border bg-white p-2 transition-shadow ${
                isDragging
                  ? "border-amber-500 shadow-lg shadow-amber-100"
                  : "border-zinc-200 hover:shadow-sm"
              }`}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex === null) return;
                handleReorder(dragIndex, index);
                setDragIndex(null);
              }}
            >
              <button
                type="button"
                className="mt-2 flex h-8 w-6 cursor-grab items-center justify-center text-zinc-400 hover:text-zinc-700"
                draggable
                onDragStart={() => setDragIndex(index)}
              >
                <span className="inline-flex flex-col gap-[3px]">
                  <span className="h-[2px] w-4 rounded bg-current" />
                  <span className="h-[2px] w-4 rounded bg-current" />
                  <span className="h-[2px] w-4 rounded bg-current" />
                </span>
              </button>
            <div
              className="flex-1 space-y-2 text-md"
              onPointerDownCapture={(e) => {
                if (dragIndex !== null) e.stopPropagation();
              }}
            >
              <RichTextEditor
                label="Field label (rich text – use toolbar for color, font size, etc.)"
                value={field.label ?? ""}
                onChange={(html) => {
                  const newLabel = html as string;
                  updateField(index, { label: newLabel });
                  scheduleFieldIdSync(index);
                }}
                onBlur={() => flushFieldIdSync(index)}
                placeholder="Question or field label"
                fontOptions={editorFonts}
                height={130}
              />
              <p className="text-[12px] text-zinc-500">
                Field key (saved on leads / webhooks):{" "}
                <code className="rounded bg-zinc-100 px-1 font-mono text-[13px] text-zinc-800">
                  {field.id}
                </code>
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  className="rounded border border-zinc-300 px-2 py-1"
                  value={field.type}
                  onChange={(e) =>
                    updateField(index, {
                      type: e.target.value as FormFieldConfig["type"],
                    })
                  }
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="address">Address</option>
                  <option value="textarea">Textarea</option>
                  <option value="select">Select</option>
                  <option value="radio">Radio</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="hidden">Hidden</option>
                </select>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={field.required ?? false}
                    onChange={(e) =>
                      updateField(index, { required: e.target.checked })
                    }
                  />
                  <span>Required</span>
                </label>
                {(field.type === "radio" || field.type === "checkbox") && (
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={field.boxedStyle ?? false}
                      onChange={(e) =>
                        updateField(index, { boxedStyle: e.target.checked })
                      }
                    />
                    <span>Boxed style</span>
                  </label>
                )}
                {(field.type === "textarea") && (
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={field.optionalSection ?? false}
                      onChange={(e) =>
                        updateField(index, { optionalSection: e.target.checked })
                      }
                    />
                    <span>Optional section style</span>
                  </label>
                )}
              </div>

              <div className="!rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-medium text-zinc-700">
                      Conditional visibility (If / Then)
                    </p>
                    <p className="text-[12px] text-zinc-500">
                      Show this field only when another field matches a value.
                      Hidden fields are not required and won’t block submission.
                    </p>
                  </div>
                  <label
                    className={`inline-flex items-center gap-2 text-[13px] ${
                      otherFields.length === 0
                        ? "cursor-not-allowed text-zinc-400"
                        : "text-zinc-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={otherFields.length === 0}
                      checked={!!visibility}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          updateField(index, { visibility: undefined } as any);
                          return;
                        }
                        if (otherFields.length === 0) return;
                        const base =
                          preferredControllingField ?? otherFields[0];
                        const defaultWhen = base.id;
                        const defaultEquals =
                          base.options?.[0]?.value != null
                            ? String(base.options[0].value)
                            : "";
                        updateField(index, {
                          visibility: {
                            whenFieldId: defaultWhen,
                            equals: defaultEquals,
                          },
                        } as any);
                      }}
                    />
                    <span>Enable</span>
                  </label>
                </div>
                {otherFields.length === 0 && (
                  <p className="mt-2 text-[12px] text-zinc-500">
                    Add at least one other field above this one, then enable
                    conditions to pick “Depends on” and “Equals”.
                  </p>
                )}

                {visibility && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block text-[13px] text-zinc-700">
                      <span className="font-medium">Depends on</span>
                      <select
                        className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-[13px]"
                        value={effectiveWhenFieldId ?? ""}
                        onChange={(e) => {
                          const nextWhen = e.target.value;
                          const nextCtrl = otherFields.find((f) => f.id === nextWhen);
                          const nextEquals =
                            nextCtrl?.options?.[0]?.value != null
                              ? String(nextCtrl.options[0].value)
                              : "";
                          updateField(index, {
                            visibility: { whenFieldId: nextWhen, equals: nextEquals },
                          } as any);
                        }}
                      >
                        {otherFields.map((f) => (
                          <option key={f.id} value={f.id}>
                            {getPlainLabel(f)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-[13px] text-zinc-700">
                      <span className="font-medium">Equals</span>
                      {controllingOptions.length > 0 ? (
                        <select
                          className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-[13px]"
                          value={resolvedEquals}
                          onChange={(e) =>
                            updateField(index, {
                              visibility: {
                                whenFieldId: effectiveWhenFieldId ?? visibility.whenFieldId,
                                equals: e.target.value,
                              },
                            } as any)
                          }
                        >
                          {controllingOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label || opt.value}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-[13px]"
                          value={resolvedEquals}
                          onChange={(e) =>
                            updateField(index, {
                              visibility: {
                                whenFieldId: effectiveWhenFieldId ?? visibility.whenFieldId,
                                equals: e.target.value,
                              },
                            } as any)
                          }
                          placeholder="Value to match"
                        />
                      )}
                    </label>
                    <div className="md:col-span-2 text-[12px] text-zinc-500">
                      Example: Show <span className="font-mono">{field.id}</span> when{" "}
                      <span className="font-mono">
                        {effectiveWhenFieldId ?? visibility.whenFieldId}
                      </span>{" "}
                      equals{" "}
                      <span className="font-mono">
                        {String(resolvedEquals ?? "") || "(empty)"}
                      </span>
                      .
                    </div>
                  </div>
                )}
              </div>

              {(field.type === "select" || field.type === "radio" || field.type === "checkbox") && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] font-medium text-zinc-500">
                      Options (value / label)
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const opts = [...(field.options ?? []), { value: "", label: "" }];
                        updateField(index, { options: opts });
                      }}
                      className="text-[14px] text-zinc-600 hover:text-zinc-900"
                    >
                      + Add option
                    </button>
                  </div>
                  {(field.options ?? []).map((opt, oi) => (
                    <div key={oi} className="flex gap-2 items-center">
                      <input
                        className="w-20 rounded border border-zinc-300 px-1.5 py-0.5 font-mono text-[14px]"
                        placeholder="value"
                        value={opt.value}
                        onChange={(e) => {
                          const opts = [...(field.options ?? [])];
                          opts[oi] = { ...opts[oi], value: e.target.value };
                          updateField(index, { options: opts });
                        }}
                      />
                      <input
                        className="flex-1 rounded border border-zinc-300 px-1.5 py-0.5"
                        placeholder="label"
                        value={opt.label}
                        onChange={(e) => {
                          const opts = [...(field.options ?? [])];
                          opts[oi] = { ...opts[oi], label: e.target.value };
                          updateField(index, { options: opts });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const opts = (field.options ?? []).filter((_, i) => i !== oi);
                          updateField(index, { options: opts });
                        }}
                        className="text-zinc-400 hover:text-red-500 text-md"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeField(index)}
              className="text-md text-zinc-500 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        );})}
      </div>
      <div>
        <div className="mb-1 flex items-center items-start gap-2">
          <p className="text-md font-medium text-zinc-700">Raw JSON (advanced)</p>
          <button
            type="button"
            onClick={() => {
              setRawJsonText(JSON.stringify(schema, null, 2));
              setError(null);
            }}
            className="inline-flex items-center gap-1 !rounded-md border border-zinc-300 bg-white px-2 py-1 text-md font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 10a6 6 0 1 1-1.76-4.24" />
              <path d="M16 4v4h-4" />
            </svg>
            Refresh JSON
          </button>
        </div>
        <div className="mb-2">
          <p className="mb-1 text-[12px] font-medium text-zinc-500">
            Schema Field IDs (for template variables)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {schemaFieldIds.length > 0 ? (
              schemaFieldIds.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 font-mono text-[12px] text-zinc-700"
                >
                  {id}
                  <button
                    type="button"
                    aria-label={`Copy ${id}`}
                    title={`Copy ${id}`}
                    onClick={() => {
                      void copyFieldId(id);
                    }}
                    className="inline-flex h-4 w-4 items-center justify-center rounded text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="7" y="3" width="10" height="12" rx="2" />
                      <path d="M5 7H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" />
                    </svg>
                  </button>
                  {copiedFieldId === id ? (
                    <span className="text-[10px] font-sans text-emerald-700">
                      Copied
                    </span>
                  ) : null}
                </span>
              ))
            ) : (
              <span className="text-[12px] text-zinc-400">No field IDs yet.</span>
            )}
          </div>
        </div>
        <textarea
          className="h-40 w-full !rounded-md border border-zinc-300 px-2 py-1 text-md font-mono"
          value={rawJsonText}
          onChange={(e) => setRawJsonText(e.target.value)}
          onBlur={(e) => handleJsonChange(e.target.value)}
        />
        {error && <p className="mt-1 text-md text-red-500">{error}</p>}
      </div>
    </div>
  );
}

