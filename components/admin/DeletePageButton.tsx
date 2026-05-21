"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { useAdminToast } from "@/components/admin/useAdminToast";

interface DeletePageButtonProps {
  pageId: string;
  slug: string;
  mode?: "archive" | "restore" | "permanent-delete";
  variant?: "default" | "menu";
  disabled?: boolean;
  disabledReason?: string;
}

export function DeletePageButton({
  pageId,
  slug,
  mode = "archive",
  variant = "default",
  disabled = false,
  disabledReason = "This page cannot be updated.",
}: DeletePageButtonProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: errorToast } = useAdminToast();

  const isRestore = mode === "restore";
  const isPermanentDelete = mode === "permanent-delete";

  async function handleConfirmDelete() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        isPermanentDelete
          ? `/api/admin/pages/${pageId}?permanent=1`
          : `/api/admin/pages/${pageId}`,
        isRestore
          ? {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "restore" }),
            }
          : {
              method: "DELETE",
            },
      );

      if (!res.ok) {
        let data: { error?: string } | null = null;
        try {
          data = (await res.json()) as { error?: string };
        } catch {
          // ignore
        }
        const message =
          (data && data.error) ||
          (isRestore
            ? "Failed to restore page. Please try again."
            : isPermanentDelete
              ? "Failed to permanently delete page. Please try again."
              : "Failed to archive page. Please try again.");
        setError(message);
        errorToast(message);
        setLoading(false);
        return;
      }

      setConfirmOpen(false);
      router.refresh();
      success(
        isRestore
          ? `Page "${slug}" restored.`
          : isPermanentDelete
            ? `Page "${slug}" permanently deleted.`
            : `Page "${slug}" archived.`,
        isRestore
          ? "Page restored"
          : isPermanentDelete
            ? "Page permanently deleted"
            : "Page archived",
      );
    } catch (err) {
      console.error(err);
      const message = isRestore
        ? "Failed to restore page. Please try again."
        : isPermanentDelete
          ? "Failed to permanently delete page. Please try again."
          : "Failed to archive page. Please try again.";
      setError(message);
      errorToast(message);
    } finally {
      setLoading(false);
    }
  }

  const triggerButtonClassName =
    variant === "menu"
      ? `flex w-full items-center gap-2 px-3 py-1.5 text-sm ${
          isRestore
            ? "text-emerald-700 hover:bg-emerald-50"
            : "text-red-600 hover:bg-red-50"
        } focus:outline-none`
      : `inline-flex items-center gap-1 !rounded-md px-2 py-1 text-[14px] disabled:opacity-60 ${
          isRestore
            ? "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            : "border border-red-200 text-red-700 hover:bg-red-50"
        }`;

  return (
    <div className={variant === "menu" ? "w-full" : "flex flex-col items-end gap-1"}>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setConfirmOpen(true);
        }}
        disabled={loading || disabled}
        title={disabled ? disabledReason : undefined}
        className={triggerButtonClassName}
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span>
          {isRestore
            ? "Restore"
            : isPermanentDelete
              ? "Delete permanently"
              : "Archive"}
        </span>
      </button>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          isRestore
            ? "Restore page?"
            : isPermanentDelete
              ? "Delete page permanently?"
              : "Archive page?"
        }
        description={
          isRestore
            ? `Are you sure you want to restore "${slug}"?`
            : isPermanentDelete
              ? `Are you sure you want to permanently delete "${slug}"? This page will be permanently deleted and cannot be restored.`
              : `Are you sure you want to archive "${slug}"? You can restore it later.`
        }
      >
        <div className="space-y-4">
          {error && (
            <p className="!rounded-md bg-red-50 px-3 py-2 text-md text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
              className="!rounded-md border border-zinc-300 px-4 py-2 text-md font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={loading}
              className={`!rounded-md px-4 py-2 text-md font-medium text-white disabled:opacity-60 ${
                isRestore
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {loading
                ? isRestore
                  ? "Restoring…"
                  : isPermanentDelete
                    ? "Deleting permanently…"
                    : "Archiving…"
                : isRestore
                  ? "Restore"
                  : isPermanentDelete
                    ? "Delete permanently"
                    : "Archive"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

