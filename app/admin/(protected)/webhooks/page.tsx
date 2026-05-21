import { prisma } from "@/lib/prisma";
import { WebhooksManager } from "@/components/admin/WebhooksManager";
import { safePrismaRead } from "@/lib/prismaRetry";

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  method: string | null;
  isActive: boolean;
}

export default async function WebhooksPage() {
  const hooks = (await safePrismaRead(
    "webhooks:webhookConfig.findMany",
    () =>
      prisma.webhookConfig.findMany({
        orderBy: { createdAt: "desc" },
      }),
    [],
  )) as WebhookRow[];

  const initialWebhooks = hooks.map((h: WebhookRow) => ({
    id: h.id,
    name: h.name,
    url: h.url,
    method: h.method ?? "POST",
    isActive: h.isActive,
  }));

  return <WebhooksManager initialWebhooks={initialWebhooks} />;
}

