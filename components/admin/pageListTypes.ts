export interface PageListItem {
  id: string;
  slug: string;
  type: string;
  status: string;
  updatedAt: string;
  headline: string | null;
  title: string | null;
  canonicalUrl?: string | null;
  domainHostname: string;
  domainId: string;
  multistepStepSlugs: string[] | null;
  notes: string | null;
  thumbnailImageUrl?: string | null;
  bookmarked?: boolean;
  adminListOrder: number;
  isFixedDefaultHomepage?: boolean;
  deletedAt?: string | null;
}
