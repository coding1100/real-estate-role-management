"use client";

import { useEffect, useState, useTransition } from "react";
import { useAdminToast } from "@/components/admin/useAdminToast";

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
  assignments: { domainId: string; roleId: string; roleName: string; hostname: string }[];
};

type DomainOption = { id: string; hostname: string };

export function TeamManager({
  domains,
}: {
  domains: DomainOption[];
}) {
  const { success, error, alert } = useAdminToast();
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

  async function load() {
    setLoading(true);
    try {
      const [teamRes, rolesRes] = await Promise.all([
        fetch("/api/admin/team"),
        fetch("/api/admin/roles"),
      ]);
      if (!teamRes.ok || !rolesRes.ok) throw new Error("load failed");
      const teamData = (await teamRes.json()) as { users: TeamUser[] };
      const rolesData = (await rolesRes.json()) as { roles: TenantRoleOption[] };
      setUsers(teamData.users);
      setRoles(rolesData.roles);
      if (!roleId && rolesData.roles[0]) {
        setRoleId(rolesData.roles[0].id);
        setDomainRoleId(rolesData.roles[0].id);
      }
    } catch {
      error("Please refresh and try again.", "Could not load team");
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

  function summaryLabel(): string {
    if (!selectedRole) return "";
    if (allDomains) return `${selectedRole.name} on all domains`;
    const count = selectedDomainIds.length;
    return `${selectedRole.name} on ${count} domain${count === 1 ? "" : "s"}`;
  }

  function toggleDomain(id: string) {
    setSelectedDomainIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!roleId) {
      alert("Select a role.", "Role required");
      return;
    }
    if (!allDomains && selectedDomainIds.length === 0) {
      alert(
        "Choose at least one domain or enable All domains.",
        "Select domains",
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
          throw new Error(
            typeof data.error === "string" ? data.error : "Failed to create user",
          );
        }
        success(summaryLabel(), "Team member added");
        resetForm();
        setShowForm(false);
        await load();
      } catch (err) {
        error(
          err instanceof Error ? err.message : "Try again.",
          "Could not add member",
        );
      }
    });
  }

  async function handleRemove(user: TeamUser) {
    if (!confirm(`Remove ${user.name} (${user.email}) from this team?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/team/${user.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        error(
          typeof data.error === "string" ? data.error : "Try again.",
          "Could not remove",
        );
        return;
      }
      success(undefined, "Team member removed");
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
            Manage members and assign tenant roles (built-in or custom).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
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
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Name</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Temporary password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Role</span>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
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
              {!allDomains && selectedDomainIds.length > 0 ? (
                <label className="block text-sm">
                  <span className="font-medium text-zinc-700">Role per domain</span>
                  <select
                    value={domainRoleId}
                    onChange={(e) => setDomainRoleId(e.target.value)}
                    className="mt-1 w-full max-w-md rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="max-h-48 overflow-y-auto rounded-md border border-zinc-200 p-2 space-y-1">
                {domains.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 text-sm text-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDomainIds.includes(d.id)}
                      onChange={() => toggleDomain(d.id)}
                    />
                    {d.hostname}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-sm text-zinc-600">
            Summary: <strong>{summaryLabel()}</strong>
          </p>

          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
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
                <th className="px-4 py-2 font-medium">Access</th>
                <th className="px-4 py-2 font-medium w-24" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{user.name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {user.allDomains && user.roleName
                      ? `${user.roleName} · all domains`
                      : user.assignments
                          .map(
                            (a) => `${a.roleName} · ${a.hostname}`,
                          )
                          .join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(user)}
                      disabled={pending}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      Remove
                    </button>
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
