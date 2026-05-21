import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain) {
    return NextResponse.json({ error: "Domain not found." }, { status: 404 });
  }

  const source = await prisma.landingPage.findFirst({
    where: {
      domainId: id,
      slug: "washington-homes-for-sale",
    },
    orderBy: { updatedAt: "desc" },
  });

  const template =
    (await prisma.masterTemplate.findFirst({
      where: { type: (source?.type as string | undefined) ?? "seller" },
    })) ??
    (await prisma.masterTemplate.findFirst({
      orderBy: { createdAt: "asc" },
    }));

  if (!template) {
    return NextResponse.json(
      { error: "No master template found to create default homepage." },
      { status: 400 },
    );
  }

  const baseSlug = slugify(`${domain.displayName}-default-home`) || "default-home";
  let nextSlug = baseSlug;
  let counter = 2;
  while (true) {
    const exists = await prisma.landingPage.findFirst({
      where: { domainId: id, slug: nextSlug },
      select: { id: true },
    });
    if (!exists) break;
    nextSlug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  const created = await prisma.landingPage.create({
    data: {
      slug: nextSlug,
      domainId: id,
      masterTemplateId: template.id,
      type: (source?.type as string | undefined) ?? "seller",
      status: "published",
      title: `${domain.displayName} Default Home`,
      headline:
        source?.headline ??
        `${domain.displayName} Main Domain Hub`,
      subheadline: source?.subheadline ?? null,
      heroImageUrl: source?.heroImageUrl ?? null,
      sections: ((source?.sections ?? template.sections ?? []) as Prisma.InputJsonValue),
      ctaText: source?.ctaText ?? "Explore Landing Paths",
      successMessage: source?.successMessage ?? "Thank you!",
      footerHtml: source?.footerHtml ?? null,
      formSchema: ((source?.formSchema ?? template.formSchema ?? { fields: [] }) as Prisma.InputJsonValue),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      headline: true,
    },
  });

  await prisma.$executeRaw`
    UPDATE "Domain"
    SET "defaultHomepagePageId" = ${created.id},
        "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;

  return NextResponse.json(
    {
      page: created,
      defaultHomepagePageId: created.id,
    },
    { status: 201 },
  );
}

