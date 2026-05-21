import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";

export async function POST(_req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

