"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Lock, Pencil, Plus, ShieldPlus, Trash2 } from "lucide-react";
import { useAdminToast } from "@/components/admin/useAdminToast";
import { Dialog } from "@/components/ui/Dialog";
import { Switch } from "@/components/ui/Switch";
import {
  getPermissionLabel,
  PERMISSION_UI_GROUPS,
  PERMISSIONS,
  type Permission,
} from "@/lib/permissions";

type TenantRoleRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  builtInKey: string | null;
  isBuiltIn: boolean;
  permissions: string[];
};

function isAdminRole(role: TenantRoleRow): boolean {
  return role.builtInKey === "admin";
}

function PermissionPicker({
  selected,
  onToggle,
}: {
  selected: Set<Permission>;
  onToggle: (perm: Permission) => void;
}) {
  return (
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {PERMISSION_UI_GROUPS.map((group) => (
        <div key={group.label} className="!rounded-md border border-zinc-100 p-3">
          <p className="text-xs font-semibold uppercase text-zinc-500 mb-2">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.perms.map((perm) => {
              const label = getPermissionLabel(perm);
              const on = selected.has(perm);
              return (
                <div
                  key={perm}
                  className="flex items-center justify-between gap-3 !rounded-md px-1 py-1.5 hover:bg-zinc-50"
                >
                  <span className="text-sm text-zinc-700">{label}</span>
                  <Switch
                    checked={on}
                    onCheckedChange={() => onToggle(perm)}
                    aria-label={label}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RolesManager() {
  const { success, error, apiErrorFromResponse } = useAdminToast();
  const [roles, setRoles] = useState<TenantRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<Permission>>(new Set());

  const [editTarget, setEditTarget] = useState<TenantRoleRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPerms, setEditPerms] = useState<Set<Permission>>(new Set());
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TenantRoleRow | null>(null);

  async function loadRoles() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        await apiErrorFromResponse(res, errBody, "Could not load roles.");
        throw new Error("Failed to load roles");
      }
      const data = (await res.json()) as { roles: TenantRoleRow[] };
      setRoles(data.roles);
    } catch {
      error("Could not load roles", "Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRoles();
  }, []);

  function togglePerm(
    perm: Permission,
    setter: React.Dispatch<React.SetStateAction<Set<Permission>>>,
  ) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  }

  function openEdit(role: TenantRoleRow) {
    setEditTarget(role);
    setEditName(role.name);
    setEditDescription(role.description ?? "");
    setEditPerms(
      new Set(
        role.permissions.filter((p): p is Permission =>
          (Object.values(PERMISSIONS) as string[]).includes(p),
        ),
      ),
    );
    setSaveConfirmOpen(false);
  }

  function closeEdit() {
    setEditTarget(null);
    setSaveConfirmOpen(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (selectedPerms.size === 0) {
      error("Permissions required", "Select at least one permission.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            permissions: [...selectedPerms],
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Failed to create role",
          );
        }
        const created = data.role as { name?: string } | undefined;
        const roleLabel = created?.name ?? name.trim();
        success(
          "Role created",
          `"${roleLabel}" is ready. Assign it on the Team page when adding or editing a member.`,
        );
        setName("");
        setDescription("");
        setSelectedPerms(new Set());
        setShowForm(false);
        await loadRoles();
      } catch (err) {
        error(
          "Could not create role",
          err instanceof Error ? err.message : "Try again.",
        );
      }
    });
  }

  function requestSaveEdit() {
    if (!editTarget || editPerms.size === 0) {
      error("Permissions required", "Select at least one permission.");
      return;
    }
    setSaveConfirmOpen(true);
  }

  async function confirmSaveEdit() {
    if (!editTarget) return;
    setSaveConfirmOpen(false);
    startTransition(async () => {
      try {
        const body: Record<string, unknown> = {
          permissions: [...editPerms],
          description: editDescription.trim() || null,
        };
        if (!editTarget.isBuiltIn) {
          body.name = editName.trim();
        }
        const res = await fetch(`/api/admin/roles/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          await apiErrorFromResponse(res, data);
          throw new Error(
            typeof data.error === "string" ? data.error : "Update failed",
          );
        }
        success(
          "Role updated",
          `"${editTarget.name}" permissions were saved.`,
        );
        closeEdit();
        await loadRoles();
      } catch (err) {
        error(
          "Could not update role",
          err instanceof Error ? err.message : "Try again.",
        );
      }
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/roles/${target.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await apiErrorFromResponse(res, data, "Could not delete role.");
        return;
      }
      success("Role deleted", `"${target.name}" was removed.`);
      await loadRoles();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
            Roles
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage permission sets for your organization. The Admin role is
            locked; all other roles can be edited or deleted.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#18181b] px-[15px] py-[10px] text-[18px] !rounded-md font-semibold text-white shadow-sm hover:bg-[#000000] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#228BE6]"
        >
          <ShieldPlus className="h-3.5 w-3.5 shrink-0" />
          {showForm ? "Cancel" : "Add custom role"}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-zinc-200 bg-white p-4 space-y-4"
        >
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Role name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-700">Permissions</p>
            <PermissionPicker
              selected={selectedPerms}
              onToggle={(p) => togglePerm(p, setSelectedPerms)}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 !rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            {pending ? "Saving…" : "Create role"}
          </button>
        </form>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-zinc-500">Loading roles…</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Permissions</th>
                <th className="px-4 py-2 min-w-[13.5rem] w-[13.5rem] text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <span className="inline-flex items-center gap-2">
                      {role.name}
                      {isAdminRole(role) ? (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                          Locked
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {role.isBuiltIn ? "Built-in" : "Custom"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {role.permissions.length} permission
                    {role.permissions.length === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3 min-w-[13.5rem] w-[13.5rem] text-right whitespace-nowrap">
                    {isAdminRole(role) ? (
                      <span
                        className="inline-flex items-center gap-1.5 !rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-500"
                        title="Admin role cannot be edited or deleted"
                      >
                        <Lock className="h-3 w-3 shrink-0" aria-hidden />
                        Locked
                      </span>
                    ) : (
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(role)}
                          disabled={pending}
                          className="inline-flex items-center gap-1.5 !rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
                        >
                          <Pencil className="h-3 w-3 shrink-0" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(role)}
                          disabled={pending}
                          className="inline-flex items-center gap-1.5 !rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          <Trash2 className="h-3 w-3 shrink-0" />
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete role?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed. Reassign any team members using this role first.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2 px-6 py-4">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="!rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmDelete()}
            disabled={pending}
            className="inline-flex items-center gap-2 !rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            {pending ? "Deleting…" : "Delete role"}
          </button>
        </div>
      </Dialog>

      <Dialog
        open={editTarget !== null && !saveConfirmOpen}
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
        title="Edit role"
        description={editTarget?.name}
        className="max-w-xl"
      >
        {editTarget ? (
          <div className="space-y-4 px-6 py-4">
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Role name</span>
              <input
                type="text"
                required
                disabled={editTarget.isBuiltIn}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500"
              />
              {editTarget.isBuiltIn ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Built-in role names are fixed; you can change permissions.
                </p>
              ) : null}
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Description</span>
              <input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="mt-1 w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">Permissions</p>
              <PermissionPicker
                selected={editPerms}
                onToggle={(p) => togglePerm(p, setEditPerms)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeEdit}
                className="!rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={requestSaveEdit}
                disabled={pending}
                className="inline-flex items-center gap-2 !rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5 shrink-0" />
                Save changes
              </button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={saveConfirmOpen && editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setSaveConfirmOpen(false);
        }}
        title="Save changes?"
        description={
          editTarget
            ? `Update permissions for "${editTarget.name}"?`
            : undefined
        }
      >
        <div className="flex justify-end gap-2 px-6 py-4">
          <button
            type="button"
            onClick={() => setSaveConfirmOpen(false)}
            className="!rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmSaveEdit()}
            disabled={pending}
            className="inline-flex items-center gap-2 !rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5 shrink-0" />
            {pending ? "Saving…" : "Confirm"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
