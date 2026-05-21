/**
 * Editor font types and helpers. Safe to import from client components
 * (no Prisma or Node-only dependencies).
 */

export interface EditorFontOption {
  label: string;
  cssFamily: string;
  /** Optional Google Fonts or CSS import URL to load this font dynamically. */
  importUrl?: string;
  /** When false, font is excluded from editor dropdown. Default true. */
  enabled?: boolean;
}

export const DEFAULT_EDITOR_FONTS: EditorFontOption[] = [
  {
    label: "Playfair Display",
    cssFamily: '"Playfair Display", "Times New Roman", serif',
  },
  {
    label: "Inter",
    cssFamily:
      '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    label: "Cormorant Garamond",
    cssFamily: '"Cormorant Garamond", "Times New Roman", serif',
  },
  {
    label: "Source Sans 3",
    cssFamily:
      '"Source Sans 3", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    label: "Libre Baskerville",
    cssFamily: '"Libre Baskerville", "Times New Roman", serif',
  },
  {
    label: "Lato",
    cssFamily:
      '"Lato", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
];

/** Labels of built-in fonts that cannot be removed from the list. */
export const BUILT_IN_EDITOR_FONT_LABELS = new Set(
  DEFAULT_EDITOR_FONTS.map((f) => f.label),
);

export function isBuiltInEditorFont(font: EditorFontOption): boolean {
  return BUILT_IN_EDITOR_FONT_LABELS.has(font.label);
}

/** Returns only fonts that are included (enabled) for use in editor dropdowns. */
export function getEnabledEditorFonts(
  fonts: EditorFontOption[],
): EditorFontOption[] {
  const seen = new Set<string>();
  return fonts.filter((f) => {
    if (f.enabled === false) return false;
    const key = `${f.label}__${f.cssFamily}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
