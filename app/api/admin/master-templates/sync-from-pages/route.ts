import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRequirePermission } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";

export async function POST(_req: NextRequest) {
  const auth = await apiRequirePermission(PERMISSIONS.TEMPLATES_SYNC_MASTER);
  if (auth instanceof NextResponse) return auth;

  // Find canonical master pages by slug
  const masterPages = await prisma.landingPage.findMany({
    where: {
      slug: {
        in: ["master-buyer", "master-seller"],
      },
    },
    select: {
      id: true,
      slug: true,
      type: true,
      sections: true,
      formSchema: true,
      masterTemplateId: true,
    },
  });

  if (masterPages.length === 0) {
    return NextResponse.json(
      { message: "No master-buyer or master-seller pages found." },
      { status: 200 },
    );
  }

  const updates = [];

  for (const page of masterPages) {
    if (!page.masterTemplateId) continue;

    const template = await prisma.masterTemplate.update({
      where: { id: page.masterTemplateId },
      data: {
        sections: page.sections as any,
        formSchema: (page.formSchema ?? null) as any,
      },
    });

    updates.push({
      masterTemplateId: template.id,
      masterTemplateType: template.type,
      fromPageId: page.id,
      fromPageSlug: page.slug,
    });
  }

  return NextResponse.json(
    {
      message: "Master templates synced from master pages.",
      updates,
    },
    { status: 200 },
  );
}

