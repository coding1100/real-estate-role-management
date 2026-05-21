import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import {
  getDomainConnectionStatus,
  verifyProjectDomain,
  VercelDomainsError,
} from "@/lib/vercel-domains";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let domain;
  try {
    domain = await prisma.domain.findUnique({ where: { id } });
  } catch (error: unknown) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? ((error as { code: string }).code)
        : null;

    if (code === "ETIMEDOUT") {
      console.error(
        "[domains/verify] prisma.domain.findUnique timed out while loading domain",
        { id, error },
      );
      return NextResponse.json(
        {
          error:
            "The database request timed out while loading this domain. Please try again in a moment.",
        },
        { status: 503 },
      );
    }

    console.error(
      "[domains/verify] prisma.domain.findUnique failed while loading domain",
      { id, error },
    );
    return NextResponse.json(
      { error: "Failed to load domain from the database." },
      { status: 500 },
    );
  }
  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  try {
    const verifyResult = await verifyProjectDomain(domain.hostname);
    const vercel = await getDomainConnectionStatus(domain.hostname);

    return NextResponse.json(
      {
        ok: true,
        verifyResult,
        vercel,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof VercelDomainsError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode },
      );
    }
    console.error("[domains/verify] unexpected error", error);
    return NextResponse.json(
      { error: "Failed to verify domain." },
      { status: 500 },
    );
  }
}

