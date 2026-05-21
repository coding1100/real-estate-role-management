import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getServerAuthSession } from "@/lib/auth";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

type TemplateSummary = {
  id: string;
  name: string;
};

export async function GET() {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!RESEND_API_KEY) {
    return NextResponse.json({
      templates: [] as TemplateSummary[],
      reason: "missing_api_key",
    });
  }

  try {
    let templates: TemplateSummary[] = [];

    // Prefer SDK call; fall back to direct REST if SDK shape/version differs.
    try {
      const resend = new Resend(RESEND_API_KEY);
      const response = await resend.templates.list();
      const raw = (response as any)?.data;
      const items = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as any)?.data)
          ? (raw as any).data
          : [];
      templates = items
        .map((item: any) => ({
          id: typeof item?.id === "string" ? item.id : "",
          name: typeof item?.name === "string" ? item.name : "",
        }))
        .filter((item: TemplateSummary) => item.id.length > 0);
    } catch {
      // Continue with REST fallback below.
    }

    if (templates.length === 0) {
      const rest = await fetch("https://api.resend.com/templates", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
      });
      if (!rest.ok) {
        const errJson = (await rest.json().catch(() => null)) as
          | { error?: { name?: string; message?: string } }
          | null;
        const restricted = errJson?.error?.name === "restricted_api_key";
        return NextResponse.json(
          {
            templates: [] as TemplateSummary[],
            reason: restricted ? "restricted_api_key" : "resend_api_error",
            message: errJson?.error?.message,
          },
          { status: 502 },
        );
      }
      const restJson = (await rest.json()) as any;
      const restItems = Array.isArray(restJson?.data)
        ? restJson.data
        : Array.isArray(restJson?.templates)
          ? restJson.templates
          : [];
      templates = restItems
        .map((item: any) => ({
          id: typeof item?.id === "string" ? item.id : "",
          name: typeof item?.name === "string" ? item.name : "",
        }))
        .filter((item: TemplateSummary) => item.id.length > 0);
    }

    return NextResponse.json({
      templates,
      reason: templates.length === 0 ? "no_templates" : undefined,
    });
  } catch (error) {
    console.error("[admin/resend/templates] Failed to list templates", error);
    return NextResponse.json(
      { error: "Failed to fetch templates from Resend.", reason: "resend_api_error" },
      { status: 500 },
    );
  }
}
