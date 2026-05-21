import { NextRequest, NextResponse } from "next/server";

function normalizeHostname(raw: string): string {
  if (!raw) return "";
  const first = raw.split(",")[0]?.trim().toLowerCase() ?? "";
  let host = first.replace(/^https?:\/\//, "");
  host = host.split("/")[0] ?? host;
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    if (end > 0) return host.slice(1, end);
  }
  host = host.split(":")[0] ?? host;
  return host.replace(/\.+$/, "").trim();
}

function parseHostList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => normalizeHostname(item))
    .filter(Boolean);
}

function getPlatformHosts(): Set<string> {
  const hosts = new Set<string>(["localhost", "127.0.0.1"]);
  parseHostList(process.env.PLATFORM_HOSTS).forEach((host) => hosts.add(host));

  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  if (nextAuthUrl) {
    try {
      hosts.add(normalizeHostname(new URL(nextAuthUrl).hostname));
    } catch {
      // ignore malformed URL
    }
  }

  return hosts;
}

function getRequestHostname(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-host");
  const host = forwarded || req.headers.get("host") || "";
  return normalizeHostname(host);
}

export function middleware(req: NextRequest) {
  const hostname = getRequestHostname(req);
  const platformHosts = getPlatformHosts();
  const allowVercelPreviews =
    (process.env.ALLOW_VERCEL_PREVIEW_HOSTS ?? "").trim().toLowerCase() === "true";

  const isPreviewVercelHost =
    allowVercelPreviews && hostname.endsWith(".vercel.app");

  if (platformHosts.has(hostname) || isPreviewVercelHost) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/", req.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/auth/:path*"],
};

