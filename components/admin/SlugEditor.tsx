"use client";

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { useAdminToast } from "@/components/admin/useAdminToast";

interface SlugEditorProps {
  pageId: string;
  initialSlug: string;
}

export function SlugEditor({ pageId, initialSlug }: SlugEditorProps) {
  const router = useRouter();
  const { success, error: errorToast } = useAdminToast();
  const [editing, setEditing] = useState(false);
  const [slug, setSlug] = useState(initialSlug);
  const [draft, setDraft] = useState(initialSlug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Slug cannot be empty.");
      errorToast("Slug cannot be empty.");
      return;
    }

    if (trimmed === slug) {
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
        body: JSON.stringify({ slug: trimmed }),
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
          "Failed to update slug. Please try again.";
        setError(message);
        errorToast(message);
        setSaving(false);
        return;
      }

      setSlug(trimmed);
      setDraft(trimmed);
      setEditing(false);
      setSaving(false);
      success("Slug updated.");
      router.refresh();
    } catch (err) {
      console.error(err);
      const message = "Failed to update slug. Please try again.";
      setError(message);
      errorToast(message);
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(slug);
    setEditing(false);
    setError(null);
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{slug}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
          aria-label="Edit slug"
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
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-6 w-6 items-center justify-center rounded bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-60"
          aria-label="Save slug"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-60"
          aria-label="Cancel slug edit"
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

