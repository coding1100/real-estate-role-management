"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Lock, Pencil, Trash2, UserPlus } from "lucide-react";
import { useAdminToast } from "@/components/admin/useAdminToast";
import { Dialog } from "@/components/ui/Dialog";

type TenantRoleOption = {
  id: string;
  name: string;
  slug: string;
  isBuiltIn: boolean;
};

type TeamUser = {
  id: string;
  email: string;
  name: string;
  allDomains: boolean;
  roleId: string | null;
  roleName: string | null;
  roleIsBuiltIn: boolean | null;
  isProtected: boolean;
  assignments: {
    domainId: string;
    roleId: string;
    roleName: string;
    roleIsBuiltIn: boolean;
    hostname: string;
  }[];
};

function formatRoleLabel(name: string, isBuiltIn: boolean): string {
  return isBuiltIn ? name : `${name} (custom)`;
}

function primaryRoleLabel(user: TeamUser): string {
  if (user.allDomains && user.roleName != null) {
    return formatRoleLabel(user.roleName, user.roleIsBuiltIn ?? true);
  }
  const byRoleId = new Map<string, { name: string; isBuiltIn: boolean }>();
  for (const a of user.assignments) {
    byRoleId.set(a.roleId, { name: a.roleName, isBuiltIn: a.roleIsBuiltIn });
  }
  const labels = [...byRoleId.values()].map((r) =>
    formatRoleLabel(r.name, r.isBuiltIn),
  );
  if (labels.length === 1) return labels[0];
  if (labels.length > 1) return labels.join(", ");
  if (user.roleName) {
    return formatRoleLabel(user.roleName, user.roleIsBuiltIn ?? true);
  }
  return "—";
}

function accessScopeLabel(user: TeamUser): string {
  if (user.allDomains) return "All domains";
  const hosts = user.assignments.map((a) => a.hostname);
  if (hosts.length === 0) return "—";
  return hosts.join(", ");
}

type DomainOption = { id: string; hostname: string };

export function TeamManager({
  domains,
}: {
  domains: DomainOption[];
}) {
  const { success, error, alert, apiErrorFromResponse } = useAdminToast();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [roles, setRoles] = useState<TenantRoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [allDomains, setAllDomains] = useState(false);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [domainRoleId, setDomainRoleId] = useState("");

  const [removeTarget, setRemoveTarget] = useState<TeamUser | null>(null);
  const [editTarget, setEditTarget] = useState<TeamUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRoleId, setEditRoleId] = useState("");
  const [editAllDomains, setEditAllDomains] = useState(false);
  const [editDomainIds, setEditDomainIds] = useState<string[]>([]);
  const [editDomainRoleId, setEditDomainRoleId] = useState("");
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const teamRes = await fetch("/api/admin/team");
      if (!teamRes.ok) {
        const errBody = await teamRes.json().catch(() => ({}));
        await apiErrorFromResponse(teamRes, errBody, "Could not load team.");
        throw new Error("load failed");
      }
      const teamData = (await teamRes.json()) as {
        users: TeamUser[];
        roles?: TenantRoleOption[];
      };
      setUsers(teamData.users);
      const roleOptions = teamData.roles ?? [];
      setRoles(roleOptions);
      if (!roleId && roleOptions[0]) {
        setRoleId(roleOptions[0].id);
        setDomainRoleId(roleOptions[0].id);
      }
    } catch {
      error("Could not load team", "Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setEmail("");
    setName("");
    setPassword("");
    setAllDomains(false);
    setSelectedDomainIds([]);
    if (roles[0]) {
      setRoleId(roles[0].id);
      setDomainRoleId(roles[0].id);
    }
  }

  const selectedRole = roles.find((r) => r.id === roleId);
  const editSelectedRole = roles.find((r) => r.id === editRoleId);

  function summaryLabel(
    role: TenantRoleOption | undefined,
    all: boolean,
    domainIds: string[],
  ): string {
    if (!role) return "";
    if (all) return `${role.name} on all domains`;
    const count = domainIds.length;
    return `${role.name} on ${count} domain${count === 1 ? "" : "s"}`;
  }

  function toggleDomain(
    id: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) {
    setter((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  function openEdit(user: TeamUser) {
    setEditTarget(user);
    setEditName(user.name);
    setEditPassword("");
    setEditAllDomains(user.allDomains);
    const firstAssignmentRole = user.assignments[0]?.roleId;
    setEditRoleId(
      user.roleId ?? firstAssignmentRole ?? roles[0]?.id ?? "",
    );
    setEditDomainIds(user.assignments.map((a) => a.domainId));
    setEditDomainRoleId(
      firstAssignmentRole ?? user.roleId ?? roles[0]?.id ?? "",
    );
    setSaveConfirmOpen(false);
  }

  function closeEdit() {
    setEditTarget(null);
    setSaveConfirmOpen(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!roleId) {
      alert("Role required", "Select a role.");
      return;
    }
    if (!allDomains && selectedDomainIds.length === 0) {
      alert(
        "Select domains",
        "Choose at least one domain or enable All domains.",
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            name,
            password,
            roleId,
            allDomains,
            assignments: allDomains
              ? undefined
              : selectedDomainIds.map((domainId) => ({
                  domainId,
                  roleId: domainRoleId || roleId,
                })),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          await apiErrorFromResponse(res, data);
          throw new Error(
            typeof data.error === "string" ? data.error : "Failed to create user",
          );
        }
        const roleLabel = selectedRole?.name ?? "role";
        success(
          "Team member added",
          `${name} (${email}) was added with ${summaryLabel(selectedRole, allDomains, selectedDomainIds) || roleLabel}.`,
        );
        resetForm();
        setShowForm(false);
        await load();
      } catch (err) {
        error(
          "Could not add member",
          err instanceof Error ? err.message : "Try again.",
        );
      }
    });
  }

  function requestSaveEdit() {
    if (!editTarget || !editRoleId) return;
    if (!editAllDomains && editDomainIds.length === 0) {
      alert(
        "Select domains",
        "Choose at least one domain or enable All domains.",
      );
      return;
    }
    setSaveConfirmOpen(true);
  }

  async function confirmSaveEdit() {
    if (!editTarget || !editRoleId) return;
    setSaveConfirmOpen(false);
    startTransition(async () => {
      try {
        const body: Record<string, unknown> = {
          name: editName.trim(),
          roleId: editAllDomains ? editRoleId : editDomainRoleId || editRoleId,
          allDomains: editAllDomains,
          assignments: editAllDomains
            ? undefined
            : editDomainIds.map((domainId) => ({
                domainId,
                roleId: editDomainRoleId || editRoleId,
              })),
        };
        if (editPassword.trim()) {
          body.password = editPassword;
        }
        const res = await fetch(`/api/admin/team/${editTarget.id}`, {
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
          "Team member updated",
          summaryLabel(editSelectedRole, editAllDomains, editDomainIds) ||
            "Access was updated.",
        );
        closeEdit();
        await load();
      } catch (err) {
        error(
          "Could not update member",
          err instanceof Error ? err.message : "Try again.",
        );
      }
    });
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoveTarget(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/team/${target.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await apiErrorFromResponse(res, data, "Could not remove team member.");
        return;
      }
      success("Team member removed", `${target.name} was removed from the team.`);
      await load();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
            Team
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage members and assign tenant roles (built-in or custom). Members
            with the Admin role cannot be removed; you can edit them to assign a
            different role.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#18181b] px-[15px] py-[10px] text-[18px] !rounded-md font-semibold text-white shadow-sm hover:bg-[#000000] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#228BE6]"
        >
          <UserPlus className="h-3.5 w-3.5 shrink-0" />
          {showForm ? "Cancel" : "Add team member"}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Name</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Temporary password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Role</span>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="mt-1 w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.isBuiltIn ? "" : " (custom)"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allDomains}
              onChange={(e) => setAllDomains(e.target.checked)}
            />
            <span>All domains (current and future)</span>
          </label>

          {!allDomains ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">Domains</p>
              {selectedDomainIds.length > 0 ? (
                <label className="block text-sm">
                  <span className="font-medium text-zinc-700">Role per domain</span>
                  <select
                    value={domainRoleId}
                    onChange={(e) => setDomainRoleId(e.target.value)}
                    className="mt-1 w-full max-w-md !rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="max-h-48 overflow-y-auto !rounded-md border border-zinc-200 p-2 space-y-1">
                {domains.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 text-sm text-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDomainIds.includes(d.id)}
                      onChange={() => toggleDomain(d.id, setSelectedDomainIds)}
                    />
                    {d.hostname}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-sm text-zinc-600">
            Summary:{" "}
            <strong>
              {summaryLabel(selectedRole, allDomains, selectedDomainIds)}
            </strong>
          </p>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 !rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <UserPlus className="h-3.5 w-3.5 shrink-0" />
            {pending ? "Saving…" : "Save team member"}
          </button>
        </form>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-zinc-500">Loading team…</p>
        ) : users.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">No team members yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Access</th>
                <th className="px-4 py-2 font-medium min-w-[13.5rem] w-[13.5rem] text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      {user.name}
                      {user.isProtected ? (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                          Admin
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {primaryRoleLabel(user)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {accessScopeLabel(user)}
                  </td>
                  <td className="px-4 py-3 min-w-[13.5rem] w-[13.5rem] text-right whitespace-nowrap">
                    <div className="inline-flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        disabled={pending}
                        className="inline-flex items-center gap-1.5 !rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
                      >
                        <Pencil className="h-3 w-3 shrink-0" />
                        Edit
                      </button>
                      {user.isProtected ? (
                        <span
                          className="inline-flex items-center gap-1.5 !rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-500"
                          title="Members with the Admin role cannot be removed"
                        >
                          <Lock className="h-3 w-3 shrink-0" aria-hidden />
                          Locked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(user)}
                          disabled={pending}
                          className="inline-flex items-center gap-1.5 !rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          <Trash2 className="h-3 w-3 shrink-0" />
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Remove team member?"
        description={
          removeTarget
            ? `${removeTarget.name} (${removeTarget.email}) will lose access to this organization. This cannot be undone.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2 px-6 py-4">
          <button
            type="button"
            onClick={() => setRemoveTarget(null)}
            className="!rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmRemove()}
            disabled={pending}
            className="inline-flex items-center gap-2 !rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            {pending ? "Removing…" : "Remove member"}
          </button>
        </div>
      </Dialog>

      <Dialog
        open={editTarget !== null && !saveConfirmOpen}
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
        title="Edit team member"
        description={editTarget ? editTarget.email : undefined}
        className="max-w-xl"
      >
        {editTarget ? (
          <div className="space-y-4 px-6 py-4">
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Name</span>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">
                New password (optional)
              </span>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="mt-1 w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Leave blank to keep current"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Role</span>
              <select
                value={editRoleId}
                onChange={(e) => setEditRoleId(e.target.value)}
                className="mt-1 w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.isBuiltIn ? "" : " (custom)"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editAllDomains}
                onChange={(e) => setEditAllDomains(e.target.checked)}
              />
              <span>All domains (current and future)</span>
            </label>
            {!editAllDomains ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-700">Domains</p>
                {editDomainIds.length > 0 ? (
                  <label className="block text-sm">
                    <span className="font-medium text-zinc-700">
                      Role per domain
                    </span>
                    <select
                      value={editDomainRoleId}
                      onChange={(e) => setEditDomainRoleId(e.target.value)}
                      className="mt-1 w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="max-h-40 overflow-y-auto !rounded-md border border-zinc-200 p-2 space-y-1">
                  {domains.map((d) => (
                    <label
                      key={d.id}
                      className="flex items-center gap-2 text-sm text-zinc-700"
                    >
                      <input
                        type="checkbox"
                        checked={editDomainIds.includes(d.id)}
                        onChange={() => toggleDomain(d.id, setEditDomainIds)}
                      />
                      {d.hostname}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="text-sm text-zinc-600">
              Summary:{" "}
              <strong>
                {summaryLabel(editSelectedRole, editAllDomains, editDomainIds)}
              </strong>
            </p>
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
            ? `Update access for ${editTarget.name} (${editTarget.email})?`
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
