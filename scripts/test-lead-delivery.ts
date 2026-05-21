import fs from "node:fs";
import path from "node:path";

function loadEnvFromFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] != null) continue;
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main() {
  const cwd = process.cwd();
  loadEnvFromFile(path.join(cwd, ".env.local"));
  loadEnvFromFile(path.join(cwd, ".env"));

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Add it to .env.local or environment.");
  }

  const [{ prisma }, { dispatchLeadToFollowUpBoss }, { sendLeadNotifications }] =
    await Promise.all([
      import("../lib/prisma"),
      import("../lib/followupboss"),
      import("../lib/notifications"),
    ]);

  const leadIdArg = process.argv[2]?.trim();
  const lead =
    leadIdArg
      ? await prisma.lead.findUnique({
          where: { id: leadIdArg },
          select: { id: true, createdAt: true },
        })
      : await prisma.lead.findFirst({
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true },
        });

  if (!lead) {
    throw new Error("No lead found to test.");
  }

  const summary = {
    leadId: lead.id,
    fub: { ok: false, error: "" },
    notificationsDocs: { ok: false, error: "" },
  };

  try {
    console.log("[test-lead-delivery] Step 1/2: FUB dispatch start", { leadId: lead.id });
    await dispatchLeadToFollowUpBoss(lead.id, { throwOnFailure: true });
    summary.fub.ok = true;
    console.log("[test-lead-delivery] Step 1/2: FUB dispatch success", { leadId: lead.id });
  } catch (error) {
    summary.fub.error = error instanceof Error ? error.message : String(error);
    console.error("[test-lead-delivery] Step 1/2: FUB dispatch failed", {
      leadId: lead.id,
      error: summary.fub.error,
    });
  }

  try {
    console.log("[test-lead-delivery] Step 2/2: Notification+Doc send start", {
      leadId: lead.id,
    });
    await sendLeadNotifications(lead.id, { throwOnFailure: true });
    summary.notificationsDocs.ok = true;
    console.log("[test-lead-delivery] Step 2/2: Notification+Doc send success", {
      leadId: lead.id,
    });
  } catch (error) {
    summary.notificationsDocs.error =
      error instanceof Error ? error.message : String(error);
    console.error("[test-lead-delivery] Step 2/2: Notification+Doc send failed", {
      leadId: lead.id,
      error: summary.notificationsDocs.error,
    });
  }

  console.log("[test-lead-delivery] Summary", summary);
  await prisma.$disconnect();

  if (!summary.fub.ok || !summary.notificationsDocs.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[test-lead-delivery] Fatal error", error);
  process.exit(1);
});
