import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { domainId?: unknown; pageIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const domainId =
    typeof body.domainId === "string" ? body.domainId.trim() : "";
  const pageIds = body.pageIds;
  if (!domainId) {
    return NextResponse.json(
      { error: "domainId is required." },
      { status: 400 },
    );
  }
  if (!Array.isArray(pageIds) || pageIds.length === 0) {
    return NextResponse.json(
      { error: "pageIds must be a non-empty array." },
      { status: 400 },
    );
  }

  const normalizedIds = pageIds.map((id) => String(id));
  if (normalizedIds.some((id) => !id)) {
    return NextResponse.json(
      { error: "Each page id must be a non-empty string." },
      { status: 400 },
    );
  }
  if (new Set(normalizedIds).size !== normalizedIds.length) {
    return NextResponse.json(
      { error: "Duplicate page ids are not allowed." },
      { status: 400 },
    );
  }

  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    select: { id: true },
  });
  if (!domain) {
    return NextResponse.json({ error: "Domain not found." }, { status: 404 });
  }

  const pagesInDomain = await prisma.landingPage.findMany({
    where: { domainId, id: { in: normalizedIds } },
    select: { id: true, adminListOrder: true },
  });
  if (pagesInDomain.length !== normalizedIds.length) {
    return NextResponse.json(
      { error: "One or more page ids do not belong to this domain." },
      { status: 400 },
    );
  }
  // Reorder only the provided subset. This keeps drag-and-drop resilient when
  // the client view omits pages (e.g. filtered/archived views).
  const minExistingOrder = pagesInDomain.reduce(
    (min, page) => Math.min(min, page.adminListOrder ?? 0),
    Number.POSITIVE_INFINITY,
  );
  const baseOrder = Number.isFinite(minExistingOrder) ? minExistingOrder : 0;

  try {
    // Single bulk UPDATE avoids interactive transaction timeouts on larger
    // reorder lists in serverless production runtimes.
    const valuesSql = Prisma.join(
      normalizedIds.map((id, index) => Prisma.sql`(${id}, ${baseOrder + index})`),
    );
    await prisma.$executeRaw`
      WITH input("id", "ord") AS (
        VALUES ${valuesSql}
      ),
      typed AS (
        SELECT "id"::text AS "id", "ord"::int AS "ord"
        FROM input
      )
      UPDATE "LandingPage" lp
      SET "adminListOrder" = typed."ord", "updatedAt" = NOW()
      FROM typed
      WHERE lp."id" = typed."id"
        AND lp."domainId" = ${domainId}
    `;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const prismaError =
      err instanceof Prisma.PrismaClientKnownRequestError ||
      err instanceof Prisma.PrismaClientUnknownRequestError ||
      err instanceof Prisma.PrismaClientRustPanicError ||
      err instanceof Prisma.PrismaClientInitializationError ||
      err instanceof Prisma.PrismaClientValidationError
        ? err
        : null;
    const message =
      err instanceof Error ? err.message : "Unknown reorder error";
    const code =
      prismaError && "code" in prismaError
        ? (prismaError as { code?: string }).code ?? null
        : null;
    const meta =
      prismaError && "meta" in prismaError
        ? (prismaError as { meta?: unknown }).meta ?? null
        : null;
    console.error("[pages/reorder]", {
      message,
      code,
      meta,
      domainId,
      pageCount: normalizedIds.length,
    });
    return NextResponse.json(
      {
        error: "Failed to save page order.",
        details: code ? `prisma_${code}` : "reorder_write_failed",
      },
      { status: 500 },
    );
  }
}
