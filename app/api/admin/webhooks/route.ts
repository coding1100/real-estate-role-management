import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";

function validateWebhookInput(input: {
  name: unknown;
  url: unknown;
  method: unknown;
}): { ok: true; name: string; url: string; method: "POST" | "PUT" | "PATCH" } | { ok: false; error: string } {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const url = typeof input.url === "string" ? input.url.trim() : "";
  const method = typeof input.method === "string" ? input.method.trim().toUpperCase() : "POST";
  if (!name || !url) {
    return { ok: false, error: "name and url are required" };
  }
  const allowedMethods = new Set(["POST", "PUT", "PATCH"]);
  if (!allowedMethods.has(method)) {
    return { ok: false, error: "method must be POST, PUT, or PATCH" };
  }
  try {
    const parsed = new URL(url);
    if (!(parsed.protocol === "https:" || parsed.protocol === "http:")) {
      return { ok: false, error: "url must use http or https" };
    }
  } catch {
    return { ok: false, error: "url must be a valid URL" };
  }
  if (/\/webhook-test\//i.test(url)) {
    return {
      ok: false,
      error:
        "n8n test webhook URLs are temporary. Use the production /webhook/... URL with an active workflow.",
    };
  }
  if (/(?:^https?:\/\/)?[^/]*n8n[^/]*\//i.test(url)) {
    return {
      ok: false,
      error: "n8n integration is deactivated for this project.",
    };
  }
  return { ok: true, name, url, method: method as "POST" | "PUT" | "PATCH" };
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, url, method = "POST", isActive = true } = body ?? {};
  const validated = validateWebhookInput({ name, url, method });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const webhook = await prisma.webhookConfig.create({
    data: {
      name: validated.name,
      url: validated.url,
      method: validated.method,
      isActive,
      headers: {},
    },
  });

  return NextResponse.json({ webhook }, { status: 201 });
}

