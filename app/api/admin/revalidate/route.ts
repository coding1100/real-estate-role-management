import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiRequirePermission } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const auth = await apiRequirePermission(PERMISSIONS.CACHE_REVALIDATE);
  if (auth instanceof NextResponse) return auth;

  const { domain, slug } = await req.json();
  if (!domain || !slug) {
    return NextResponse.json(
      { error: "Missing domain or slug" },
      { status: 400 },
    );
  }

  // Our landing routes live at /[slug]; the domain is resolved from the host
  // header, so we only need to revalidate by slug path.
  const path = `/${slug}`;
  revalidatePath(path);

  return NextResponse.json({ revalidated: true, path });
}

