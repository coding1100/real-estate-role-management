"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function TenantSwitcher() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const tenants = session?.user?.tenants ?? [];
  const active = session?.user?.activeTenantId ?? session?.user?.tenantId;

  if (tenants.length <= 1) {
    if (session?.user?.tenantName) {
      return (
        <span className="text-xs text-zinc-500 hidden sm:inline">
          {/* {session.user.tenantName} */}
        </span>
      );
    }
    return null;
  }

  return (
    <select
      disabled={pending}
      value={active ?? ""}
      onChange={(e) => {
        const tenantId = e.target.value;
        startTransition(async () => {
          await update({ activeTenantId: tenantId });
          router.refresh();
        });
      }}
      className="!rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
      aria-label="Switch organization"
    >
      {tenants.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
