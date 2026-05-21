import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { getDomainConnectionStatus, VercelDomainsError } from "@/lib/vercel-domains";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: NextRequest, ctx: RouteContext) {
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
        "[domains/status] prisma.domain.findUnique timed out while loading domain",
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
      "[domains/status] prisma.domain.findUnique failed while loading domain",
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
    const vercel = await getDomainConnectionStatus(domain.hostname);
    return NextResponse.json(
      {
        domain: {
          id: domain.id,
          hostname: domain.hostname,
          isActive: domain.isActive,
        },
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
    console.error("[domains/status] unexpected error", error);
    return NextResponse.json(
      { error: "Failed to fetch domain status." },
      { status: 500 },
    );
  }
}

