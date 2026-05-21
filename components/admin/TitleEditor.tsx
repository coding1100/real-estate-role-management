"use client";

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { useAdminToast } from "@/components/admin/useAdminToast";

interface TitleEditorProps {
  pageId: string;
  initialTitle: string;
}

export function TitleEditor({ pageId, initialTitle }: TitleEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [draft, setDraft] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: errorToast } = useAdminToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();

    if (trimmed === title) {
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
        body: JSON.stringify({
          title: trimmed.length > 0 ? trimmed : null,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // ignore JSON parse errors
      }

      if (!res.ok) {
        const message =
          (data && data.error) ||
          "Failed to update title. Please try again.";
        setError(message);
        errorToast(message);
        setSaving(false);
        return;
      }

      setTitle(trimmed);
      setDraft(trimmed);
      setEditing(false);
      setSaving(false);
      success("Title updated.");
      router.refresh();
    } catch (err) {
      console.error(err);
      const message = "Failed to update title. Please try again.";
      setError(message);
      errorToast(message);
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(title);
    setEditing(false);
    setError(null);
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{title || "—"}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
          aria-label="Edit title"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-7 flex-1 rounded border border-zinc-300 px-2 text-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
          disabled={saving}
          placeholder="Optional title"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-6 w-6 items-center justify-center rounded bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-60"
          aria-label="Save title"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-60"
          aria-label="Cancel title edit"
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

