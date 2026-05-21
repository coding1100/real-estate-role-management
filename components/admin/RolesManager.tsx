"use client";

import { useEffect, useState, useTransition } from "react";
import { useAdminToast } from "@/components/admin/useAdminToast";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

type TenantRoleRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  builtInKey: string | null;
  isBuiltIn: boolean;
  permissions: string[];
};

const PERMISSION_GROUPS: { label: string; perms: Permission[] }[] = [
  {
    label: "Team",
    perms: [
      PERMISSIONS.TEAM_LIST,
      PERMISSIONS.TEAM_CREATE,
      PERMISSIONS.TEAM_UPDATE,
      PERMISSIONS.TEAM_REMOVE,
    ],
  },
  {
    label: "Roles",
    perms: [
      PERMISSIONS.TENANT_ROLES_LIST,
      PERMISSIONS.TENANT_ROLES_CREATE,
      PERMISSIONS.TENANT_ROLES_UPDATE,
      PERMISSIONS.TENANT_ROLES_DELETE,
    ],
  },
  {
    label: "Domains",
    perms: [
      PERMISSIONS.DOMAIN_LIST,
      PERMISSIONS.DOMAIN_CREATE,
      PERMISSIONS.DOMAIN_UPDATE_SETTINGS,
      PERMISSIONS.DOMAIN_DELETE,
    ],
  },
  {
    label: "Pages",
    perms: [
      PERMISSIONS.PAGES_LIST_ALL,
      PERMISSIONS.PAGES_CREATE,
      PERMISSIONS.PAGES_PUBLISH,
      PERMISSIONS.PAGES_EDIT_CONTENT,
      PERMISSIONS.PAGES_ARCHIVE,
    ],
  },
  {
    label: "Leads",
    perms: [PERMISSIONS.LEADS_LIST],
  },
];

export function RolesManager() {
  const { success, error } = useAdminToast();
  const [roles, setRoles] = useState<TenantRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<Permission>>(new Set());

  async function loadRoles() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) throw new Error("Failed to load roles");
      const data = (await res.json()) as { roles: TenantRoleRow[] };
      setRoles(data.roles);
    } catch {
      error("Please refresh and try again.", "Could not load roles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRoles();
  }, []);

  function togglePerm(perm: Permission) {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (selectedPerms.size === 0) {
      error("Select at least one permission.", "Permissions required");
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
        success(undefined, "Role created");
        setName("");
        setDescription("");
        setSelectedPerms(new Set());
        setShowForm(false);
        await loadRoles();
      } catch (err) {
        error(
          err instanceof Error ? err.message : "Try again.",
          "Could not create role",
        );
      }
    });
  }

  async function handleDelete(role: TenantRoleRow) {
    if (role.isBuiltIn) return;
    if (!confirm(`Delete role "${role.name}"?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/roles/${role.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        error(
          typeof data.error === "string" ? data.error : "Try again.",
          "Could not delete",
        );
        return;
      }
      success(undefined, "Role deleted");
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
            Custom roles and permission sets for your organization. Built-in roles
            cannot be deleted.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
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
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-700">Permissions</p>
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.label} className="rounded-md border border-zinc-100 p-3">
                <p className="text-xs font-semibold uppercase text-zinc-500 mb-2">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-3">
                  {group.perms.map((perm) => (
                    <label
                      key={perm}
                      className="flex items-center gap-1.5 text-xs text-zinc-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPerms.has(perm)}
                        onChange={() => togglePerm(perm)}
                      />
                      {perm.replace(":", " ")}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
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
                <th className="px-4 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {role.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {role.isBuiltIn ? "Built-in" : "Custom"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {role.permissions.length} permission
                    {role.permissions.length === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!role.isBuiltIn ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(role)}
                        disabled={pending}
                        className="text-xs font-medium text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
