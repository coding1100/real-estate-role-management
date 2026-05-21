"use client";

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";

type PageType = "buyer" | "seller";

interface TypeEditorProps {
  pageId: string;
  initialType: PageType;
}

export function TypeEditor({ pageId, initialType }: TypeEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<PageType>(initialType);
  const [draft, setDraft] = useState<PageType>(initialType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (draft === value) {
      setEditing(false);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: draft }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // ignore JSON parse errors
      }

      if (!res.ok) {
        setError(
          (data && data.error) ||
            "Failed to update type. Please try again.",
        );
        setSaving(false);
        return;
      }

      setValue(draft);
      setEditing(false);
      setSaving(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Failed to update type. Please try again.");
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
    setError(null);
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="capitalize">{value}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
          aria-label="Edit page type"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value as PageType)}
          className="h-7 flex-1 rounded border border-zinc-300 px-2 text-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
          disabled={saving}
        >
          <option value="buyer">buyer</option>
          <option value="seller">seller</option>
        </select>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-6 w-6 items-center justify-center rounded bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-60"
          aria-label="Save page type"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-60"
          aria-label="Cancel type edit"
        >
          <X className="h-3 w-3" />
        </button>
      </form>
      {error && (
        <p className="text-[14px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

