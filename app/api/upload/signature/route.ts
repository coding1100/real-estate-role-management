import { NextRequest, NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import { apiRequirePermission } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import crypto from "crypto";

function makePublicId(prefix: string) {
  const rand = crypto.randomBytes(4).toString("hex");
  return `${prefix}_${rand}`;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const domainId =
    typeof (body as { domainId?: unknown })?.domainId === "string"
      ? (body as { domainId: string }).domainId.trim()
      : undefined;
  const auth = await apiRequirePermission(PERMISSIONS.MEDIA_UPLOAD_SIGNATURE, {
    domainId,
  });
  if (auth instanceof NextResponse) return auth;

  const kind = typeof (body as { kind?: unknown })?.kind === "string" ? (body as { kind: string }).kind : "document";
  const isImage = kind === "image";

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  if (!cloudName || !apiKey) {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 });
  }

  const folder = isImage ? "real-estate" : "real-estate-docs";
  const publicId = isImage ? makePublicId("img") : makePublicId("file");
  const timestamp = Math.floor(Date.now() / 1000);

  // Cloudinary signature covers upload params (excluding file/api_key/etc).
  const signature = cloudinary.utils.api_sign_request(
    {
      folder,
      public_id: publicId,
      timestamp,
      overwrite: false,
    },
    process.env.CLOUDINARY_API_SECRET as string,
  );

  const resourceType = isImage ? "image" : "raw";
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  return NextResponse.json({
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
    publicId,
    uploadUrl,
    resourceType,
  });
}

