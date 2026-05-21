import { NextRequest, NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import { getServerAuthSession } from "@/lib/auth";

const ALLOWED_DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function isAllowedDocumentFile(file: File): boolean {
  const fileName = (file.name || "").toLowerCase().trim();
  const ext = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";
  const mime = (file.type || "").toLowerCase();
  return ALLOWED_DOCUMENT_EXTENSIONS.has(ext) || ALLOWED_DOCUMENT_MIME_TYPES.has(mime);
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const isImage = file.type.startsWith("image/");
  if (!isImage && !isAllowedDocumentFile(file)) {
    return NextResponse.json(
      { error: "Invalid file type. Only .doc, .docx, and .pdf files are allowed." },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    // Use Cloudinary "image" type for images, "raw" for documents (PDF, DOC, etc.).
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: isImage ? "real-estate" : "real-estate-docs",
          resource_type: isImage ? "image" : "raw",
          // For documents, let Cloudinary derive a filename from the original
          // while keeping the asset public and avoiding ACL issues.
          ...(isImage
            ? {}
            : {
                use_filename: true,
                unique_filename: true,
              }),
        },
        (error, uploaded) => {
          if (error) {
            reject(error);
            return;
          }
          if (!uploaded?.secure_url) {
            reject(new Error("Cloudinary upload returned no secure_url"));
            return;
          }
          resolve({ secure_url: uploaded.secure_url });
        },
      );
      stream.end(buffer);
    });

    return NextResponse.json({
      url: result.secure_url,
      mimeType: file.type || null,
      originalName: file.name || null,
    });
  } catch (e) {
    console.error("Cloudinary upload failed", e);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }
}

