/**
 * Canonical HTTPS URL for a page on a customer domain (no query string or hash).
 * Used when opening or copying links from admin so marketing/linker params
 * (e.g. _gl, gclid) are not copied from elsewhere — real ad traffic still lands with those intact.
 */
export function buildCustomerSiteUrl(hostname: string, pathname: string): string {
  const host = (hostname || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/[/].*$/, "")
    .trim();
  let path = (pathname || "").trim();
  path = path.split("?")[0]?.split("#")[0] ?? path;
  if (!path.startsWith("/")) path = `/${path}`;
  if (!host) return path;
  return `https://${host}${path}`;
}
