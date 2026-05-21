import type { PageListItem } from "@/components/admin/pageListTypes";

/**
 * UI-only category labels for the Landing Pages 2 dashboard.
 * There is no persisted category field; heuristics may be replaced by a DB column later.
 */
export function getPageCategoryLabel(page: PageListItem): string {
  const slug = (page.slug ?? "").toLowerCase();
  const ms = page.multistepStepSlugs;
  const hasMultistep = Array.isArray(ms) && ms.length > 0;

  if (slug.includes("ab-test") || slug.includes("abtest")) {
    return "A/B TEST";
  }
  if (slug.includes("inventory") || slug.includes("listings")) {
    return "INVENTORY LIST";
  }
  if (slug.includes("pillar") || slug.includes("guide") || slug.includes("blog")) {
    return "CONTENT PILLAR";
  }
  if (hasMultistep) {
    return "LEAD GEN";
  }
  if (page.type === "seller") {
    return "CONTENT PILLAR";
  }
  return "LEAD GEN";
}
