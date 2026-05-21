import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { isLikelyPublicHostname, normalizeHostname } from "@/lib/hostnames";
import {
  addDomainToProject,
  getDomainConnectionStatus,
  removeProjectDomain,
  VercelDomainsError,
} from "@/lib/vercel-domains";

type VercelStatusResult = {
  vercel: unknown | null;
  vercelError?: {
    code: string;
    message: string;
    statusCode: number;
  };
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidUsPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^[0-9+\-()\s]+$/.test(trimmed)) return false;
  if (trimmed.includes("+") && !trimmed.startsWith("+")) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

async function safeReadVercelStatus(hostname: string): Promise<VercelStatusResult> {
  try {
    const vercel = await getDomainConnectionStatus(hostname);
    return { vercel };
  } catch (error) {
    if (error instanceof VercelDomainsError) {
      return {
        vercel: null,
        vercelError: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
        },
      };
    }
    return {
      vercel: null,
      vercelError: {
        code: "VERCEL_STATUS_UNKNOWN_ERROR",
        message: "Domain created but failed to read Vercel status.",
        statusCode: 500,
      },
    };
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    hostname,
    displayName,
    notifyEmail,
    notifySms,
    isActive = true,
    ga4Id,
    metaPixelId,
    logoUrl,
    faviconUrl,
    rightLogoUrl,
    linkedinUrl,
    linkedinVisible,
    googleUrl,
    googleVisible,
    facebookUrl,
    facebookVisible,
    instagramUrl,
    instagramVisible,
    zillowUrl,
    zillowVisible,
    defaultHomepageButtons,
  } = body ?? {};

  const normalizedHostname = normalizeHostname(String(hostname ?? ""));

  if (!normalizedHostname || !displayName || !notifyEmail) {
    return NextResponse.json(
      { error: "hostname, displayName, notifyEmail are required" },
      { status: 400 },
    );
  }
  if (!isLikelyPublicHostname(normalizedHostname)) {
    return NextResponse.json(
      { error: "Please provide a valid public hostname (e.g. example.com)." },
      { status: 400 },
    );
  }
  if (!isValidEmail(String(notifyEmail ?? ""))) {
    return NextResponse.json(
      { error: "Notify email must be a valid email (e.g., sample@gmail.com)." },
      { status: 400 },
    );
  }
  if (!isValidUsPhone(String(notifySms ?? ""))) {
    return NextResponse.json(
      {
        error:
          "Notify SMS must be a valid US number (10 digits, or 11 digits starting with 1).",
      },
      { status: 400 },
    );
  }

  try {
    await addDomainToProject(normalizedHostname);
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
    console.error("[domains] failed to add project domain", error);
    return NextResponse.json(
      { error: "Failed to add domain to Vercel project." },
      { status: 502 },
    );
  }

  let domain;
  try {
    domain = await prisma.domain.create({
      data: {
        hostname: normalizedHostname,
        displayName,
        notifyEmail,
        notifySms,
        isActive,
        ga4Id,
        metaPixelId,
        logoUrl,
        faviconUrl,
        agentPhoto: rightLogoUrl,
        linkedinUrl,
        linkedinVisible,
        googleUrl,
        googleVisible,
        facebookUrl,
        facebookVisible,
        instagramUrl,
        instagramVisible,
        zillowUrl,
        zillowVisible,
      },
    });
    if (Array.isArray(defaultHomepageButtons)) {
      await prisma.$executeRaw`
        UPDATE "Domain"
        SET "defaultHomepageButtons" = ${JSON.stringify(defaultHomepageButtons)}::jsonb,
            "updatedAt" = NOW()
        WHERE "id" = ${domain.id}
      `;
      domain = {
        ...domain,
        defaultHomepageButtons: defaultHomepageButtons as any,
      } as typeof domain;
    }
  } catch (error: unknown) {
    try {
      await removeProjectDomain(normalizedHostname);
    } catch (rollbackError) {
      console.error("[domains] failed to rollback Vercel domain after DB error", {
        hostname: normalizedHostname,
        rollbackError,
      });
    }

    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? ((error as { code: string }).code)
        : null;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "This hostname already exists." },
        { status: 409 },
      );
    }
    console.error("[domains] failed to create domain row", error);
    return NextResponse.json(
      { error: "Failed to create domain." },
      { status: 500 },
    );
  }

  const status = await safeReadVercelStatus(normalizedHostname);
  return NextResponse.json(
    {
      domain,
      vercel: status.vercel,
      ...(status.vercelError ? { vercelError: status.vercelError } : {}),
    },
    { status: 201 },
  );
}

