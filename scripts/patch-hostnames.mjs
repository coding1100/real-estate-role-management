import fs from "fs";
const path = "lib/hostnames.ts";
let s = fs.readFileSync(path, "utf8");
s = s.replace(/\n\/\/ test\n*$/, "\n");
const block = `

function getQueryPreviewParam(
  query: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const raw = query[key];
  if (raw == null) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

export function shouldIncludeDraftForLandingRequest(
  requestHostname: string,
  query: Record<string, string | string[] | undefined>,
): boolean {
  const pv = getQueryPreviewParam(query, "preview");
  const wantsPreview = pv === "1" || pv === "true";
  if (isPreviewHostname(requestHostname)) return true;
  if (isPlatformHostname(requestHostname) && wantsPreview) return true;
  return false;
}

`;
if (!s.includes("shouldIncludeDraftForLandingRequest")) {
  s = s.replace(
    "return getPlatformHostnames().has(normalized);\n}\n\nexport function isPreviewHostname",
    "return getPlatformHostnames().has(normalized);\n}" + block + "\nexport function isPreviewHostname",
  );
}
fs.writeFileSync(path, s);
console.log("ok");
