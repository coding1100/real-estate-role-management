import { prisma } from "./prisma";

const DEFAULT_TIMEOUT_MS = 8000;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function getWebhookTimeoutMs(): number {
  const raw = Number.parseInt(process.env.LEAD_WEBHOOK_TIMEOUT_MS ?? "", 10);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(raw, 30000);
}

function isLikelyN8nTestWebhook(url: string): boolean {
  return /\/webhook-test\//i.test(url);
}

function isN8nWebhookUrl(url: string): boolean {
  return /(?:^https?:\/\/)?[^/]*n8n[^/]*\//i.test(url);
}

function getResponseErrorText(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "No response body";
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const candidates = [parsed.message, parsed.error, parsed.hint];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

async function sendWebhookRequest(input: {
  leadId: string;
  hook: { name: string; url: string; method: string | null; headers: unknown };
  payload: unknown;
  timeoutMs: number;
}) {
  const method = (input.hook.method ?? "POST").toUpperCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const res = await fetch(input.hook.url, {
      method,
      headers: {
        "Content-Type": "application/json",
        // Deterministic key helps downstream dedupe if supported.
        "X-Lead-Idempotency-Key": `lead:${input.leadId}:${input.hook.name}`,
        ...(input.hook.headers as Record<string, string>),
      },
      body: JSON.stringify(input.payload),
      signal: controller.signal,
    });
    const bodyText = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      retryable: RETRYABLE_STATUS_CODES.has(res.status),
      body: bodyText,
      endpoint: input.hook.url,
      hookName: input.hook.name,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function dispatchLeadToWebhooks(
  leadId: string,
  options?: { throwOnFailure?: boolean },
) {
  const throwOnFailure = options?.throwOnFailure === true;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      domain: true,
      page: true,
    },
  });

  if (!lead) return;

  const webhooks = await prisma.webhookConfig.findMany({
    where: { isActive: true },
  });

  const payload = {
    id: lead.id,
    createdAt: lead.createdAt,
    type: lead.type,
    status: lead.status,
    formData: lead.formData,
    utm: {
      source: lead.utmSource,
      medium: lead.utmMedium,
      campaign: lead.utmCampaign,
    },
    domain: {
      hostname: lead.domain.hostname,
      displayName: lead.domain.displayName,
    },
    page: {
      slug: lead.page.slug,
      headline: lead.page.headline,
      type: lead.page.type,
    },
    // Helpful flag for tools like Zapier to know this might be a multistep payload
    meta: {
      isMultistep:
        !!lead.formData &&
        typeof lead.formData === "object" &&
        Object.keys(lead.formData as Record<string, unknown>).some((key) =>
          /^step\d+$/.test(key),
        ),
      stepsCount:
        !!lead.formData && typeof lead.formData === "object"
          ? Object.keys(lead.formData as Record<string, unknown>).filter((key) =>
              /^step\d+$/.test(key),
            ).length
          : 0,
    },
  };

  const zapierUrl = process.env.ZAPIER_LEADS_WEBHOOK_URL;
  const timeoutMs = getWebhookTimeoutMs();
  const failures: string[] = [];

  if (webhooks.length) {
    for (const hook of webhooks) {
      if (isN8nWebhookUrl(hook.url)) {
        console.warn(
          `[webhook] Skipping ${hook.name} (${hook.url}) because n8n integration is fully deactivated.`,
        );
        continue;
      }
      if (isLikelyN8nTestWebhook(hook.url)) {
        const err =
          `[webhook] ${hook.name} is configured with an n8n test URL (${hook.url}). ` +
          "Use /webhook/... production URL with an active workflow.";
        failures.push(err);
        console.error(err);
        continue;
      }
      try {
        const result = await sendWebhookRequest({
          leadId,
          hook: {
            name: hook.name,
            url: hook.url,
            method: hook.method,
            headers: hook.headers,
          },
          payload,
          timeoutMs,
        });
        if (!result.ok) {
          const message = getResponseErrorText(result.body);
          const err = `[webhook] Failed for ${hook.name} (${hook.url}): ${result.status} ${message}`;
          failures.push(err);
          if (result.retryable) {
            console.warn(`${err} (retryable)`);
          } else {
            console.error(err);
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? "Unknown error");
        const err = `[webhook] Error for ${hook.name} (${hook.url}): ${message}`;
        failures.push(err);
        console.error(err);
      }
    }
  }

  if (zapierUrl) {
    try {
      const res = await sendWebhookRequest({
        leadId,
        hook: {
          name: "Zapier",
          url: zapierUrl,
          method: "POST",
          headers: {},
        },
        payload,
        timeoutMs,
      });
      if (!res.ok) {
        const err = `[zapier] Failed webhook (${zapierUrl}): ${res.status} ${getResponseErrorText(res.body)}`;
        failures.push(err);
        if (res.retryable) {
          console.warn(`${err} (retryable)`);
        } else {
          console.error(err);
        }
      } else {
        console.log("[zapier] Lead sent successfully");
      }
    } catch (error) {
      const err = `[zapier] Error calling webhook (${zapierUrl}): ${
        error instanceof Error ? error.message : String(error ?? "Unknown error")
      }`;
      failures.push(err);
      console.error(err);
    }
  }

  if (failures.length > 0 && throwOnFailure) {
    throw new Error(failures.join(" | "));
  }
}

