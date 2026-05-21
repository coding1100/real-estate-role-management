"use client";

import { useState, useTransition } from "react";

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  method: string;
  isActive: boolean;
}

interface WebhooksManagerProps {
  initialWebhooks: WebhookRow[];
}

export function WebhooksManager({
  initialWebhooks,
}: WebhooksManagerProps) {
  const [hooks, setHooks] = useState<WebhookRow[]>(initialWebhooks);
  const [savingId, setSavingId] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateHook(id: string, patch: Partial<WebhookRow>) {
    setHooks((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    );
  }

  function addNewRow() {
    if (hooks.find((h) => h.id === "new")) return;
    setHooks((prev) => [
      ...prev,
      {
        id: "new",
        name: "",
        url: "",
        method: "POST",
        isActive: true,
      },
    ]);
  }

  async function saveHook(hook: WebhookRow) {
    setError(null);
    setSavingId(hook.id || "new");
    startTransition(async () => {
      try {
        const isNew = hook.id === "new";
        const url = isNew
          ? "/api/admin/webhooks"
          : `/api/admin/webhooks/${hook.id}`;
        const method = isNew ? "POST" : "PATCH";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(hook),
        });
        if (!res.ok) throw new Error("Failed to save webhook");
        const data = (await res.json()) as { webhook: WebhookRow };
        setHooks((prev) => {
          if (isNew) {
            return prev
              .filter((h) => h.id !== "new")
              .concat(data.webhook);
          }
          return prev.map((h) =>
            h.id === hook.id ? data.webhook : h,
          );
        });
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "Failed to save webhook");
      } finally {
        setSavingId(null);
      }
    });
  }

  async function deleteHook(id: string) {
    if (!confirm("Delete this webhook?")) return;
    setError(null);
    setSavingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/webhooks/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete webhook");
        setHooks((prev) => prev.filter((h) => h.id !== id));
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "Failed to delete webhook");
      } finally {
        setSavingId(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
          Webhooks
        </h1>
        <button
          type="button"
          onClick={addNewRow}
          className="!rounded-md bg-zinc-900 px-3 py-1.5 text-md font-medium text-white hover:bg-zinc-800"
        >
          + Add webhook
        </button>
      </div>
      {error && (
        <p className="text-md text-red-500">
          {error}
        </p>
      )}
      <div className="max-[768px]:overflow-x-auto max-[768px]:-mx-2">
        <table className="min-w-full overflow-hidden rounded-lg bg-white text-md shadow-sm max-[768px]:min-w-[600px]">
        <thead className="bg-zinc-50 text-[16px] uppercase tracking-[0.15em] text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">URL</th>
            <th className="px-3 py-2 text-left">Method</th>
            <th className="px-3 py-2 text-left">Active</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {hooks.map((h) => (
            <tr key={h.id} className="border-t border-zinc-100">
              <td className="px-3 py-2">
                <input
                  className="w-full rounded border border-zinc-200 px-2 py-1"
                  value={h.name}
                  onChange={(e) =>
                    updateHook(h.id, { name: e.target.value })
                  }
                  placeholder="Zapier - Main CRM"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  className="w-full rounded border border-zinc-200 px-2 py-1"
                  value={h.url}
                  onChange={(e) =>
                    updateHook(h.id, { url: e.target.value })
                  }
                  placeholder="https://hooks.zapier.com/..."
                />
              </td>
              <td className="px-3 py-2">
                <select
                  className="rounded border border-zinc-200 px-2 py-1"
                  value={h.method}
                  onChange={(e) =>
                    updateHook(h.id, {
                      method: e.target.value || "POST",
                    })
                  }
                >
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={h.isActive}
                  onChange={(e) =>
                    updateHook(h.id, { isActive: e.target.checked })
                  }
                />
              </td>
              <td className="px-3 py-2 text-right">
                <div className="inline-flex gap-1">
                  <button
                    type="button"
                    onClick={() => saveHook(h)}
                    disabled={isPending}
                    className="rounded-sm border border-zinc-300 px-2 py-1 text-[14px] text-zinc-800 hover:bg-zinc-100 disabled:opacity-60"
                  >
                    {savingId === h.id ? "Saving..." : "Save"}
                  </button>
                  {h.id !== "new" && (
                    <button
                      type="button"
                      onClick={() => deleteHook(h.id)}
                      disabled={isPending}
                      className="!rounded-md border border-zinc-300 px-2 py-1 text-[14px] text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {hooks.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-4 text-center text-zinc-500"
              >
                No webhooks configured yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

