import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(_req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sourceDomain = await prisma.domain.findFirst({
    where: { hostname: "bendhomeforsale.us" },
    select: { id: true, defaultHomepagePageId: true },
  });
  if (!sourceDomain) {
    return NextResponse.json(
      { error: "Source domain bendhomeforsale.us not found." },
      { status: 400 },
    );
  }

  let sourcePage = sourceDomain.defaultHomepagePageId
    ? await prisma.landingPage.findUnique({
        where: { id: sourceDomain.defaultHomepagePageId },
      })
    : null;
  if (!sourcePage) {
    sourcePage = await prisma.landingPage.findFirst({
      where: { domainId: sourceDomain.id, status: "published" },
      orderBy: { updatedAt: "desc" },
    });
  }
  if (!sourcePage) {
    return NextResponse.json(
      { error: "No source default homepage found on bendhomeforsale.us." },
      { status: 400 },
    );
  }

  const template =
    (await prisma.masterTemplate.findFirst({
      where: { type: (sourcePage.type as string | undefined) ?? "seller" },
    })) ??
    (await prisma.masterTemplate.findFirst({
      orderBy: { createdAt: "asc" },
    }));
  if (!template) {
    return NextResponse.json(
      { error: "No master template found to create default homepage pages." },
      { status: 400 },
    );
  }

  const domains = await prisma.domain.findMany({
    select: { id: true, displayName: true, defaultHomepagePageId: true },
  });

  let createdCount = 0;
  let linkedCount = 0;

  for (const domain of domains) {
    if (domain.defaultHomepagePageId) {
      const linkedPage = await prisma.landingPage.findUnique({
        where: { id: domain.defaultHomepagePageId },
        select: { id: true },
      });
      if (linkedPage) continue;
    }

    let target = await prisma.landingPage.findFirst({
      where: { domainId: domain.id, title: "Default Home Page" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, slug: true },
    });

    if (!target) {
      const baseSlug = slugify(`${domain.displayName}-default-home`) || "default-home";
      let nextSlug = baseSlug;
      let counter = 2;
      while (true) {
        const exists = await prisma.landingPage.findFirst({
          where: { domainId: domain.id, slug: nextSlug },
          select: { id: true },
        });
        if (!exists) break;
        nextSlug = `${baseSlug}-${counter}`;
        counter += 1;
      }

      const created = await prisma.landingPage.create({
        data: {
          slug: nextSlug,
          domainId: domain.id,
          masterTemplateId: template.id,
          type: sourcePage.type,
          status: "published",
          title: "Default Home Page",
          headline: sourcePage.headline ?? "Default Home Page",
          subheadline: sourcePage.subheadline ?? null,
          heroImageUrl: sourcePage.heroImageUrl ?? null,
          sections: ((sourcePage.sections ?? template.sections ?? []) as Prisma.InputJsonValue),
          ctaText: sourcePage.ctaText ?? "Explore Landing Paths",
          successMessage: sourcePage.successMessage ?? "Thank you!",
          footerHtml: sourcePage.footerHtml ?? null,
          formSchema: ((sourcePage.formSchema ?? template.formSchema ?? { fields: [] }) as Prisma.InputJsonValue),
        },
        select: { id: true, slug: true },
      });
      target = created;
      createdCount += 1;
    }

    await prisma.$executeRaw`
      UPDATE "Domain"
      SET "defaultHomepagePageId" = ${target.id},
          "updatedAt" = NOW()
      WHERE "id" = ${domain.id}
    `;
    linkedCount += 1;
  }

  return NextResponse.json(
    {
      ok: true,
      createdCount,
      linkedCount,
      totalDomains: domains.length,
    },
    { status: 200 },
  );
}
