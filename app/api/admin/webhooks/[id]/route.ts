import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function validateWebhookPatch(body: Record<string, unknown>): {
  ok: true;
  name: string;
  url: string;
  method: "POST" | "PUT" | "PATCH";
  isActive: boolean;
} | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const method =
    typeof body.method === "string" ? body.method.trim().toUpperCase() : "POST";
  const isActive = Boolean(body.isActive);

  if (!name || !url) {
    return { ok: false, error: "name and url are required" };
  }
  if (!new Set(["POST", "PUT", "PATCH"]).has(method)) {
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

  return { ok: true, name, url, method: method as "POST" | "PUT" | "PATCH", isActive };
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const validated = validateWebhookPatch((body ?? {}) as Record<string, unknown>);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const { id } = await ctx.params;

  const webhook = await prisma.webhookConfig.update({
    where: { id },
    data: {
      name: validated.name,
      url: validated.url,
      method: validated.method,
      isActive: validated.isActive,
    },
  });

  return NextResponse.json({ webhook }, { status: 200 });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  await prisma.webhookConfig.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

