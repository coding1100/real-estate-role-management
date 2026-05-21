const SIGN_PLACEHOLDER_PREFIX = "__SIGNS_WRAPPED__";

export function wrapLegalSignsHtml(html?: string | null): string {
  if (!html || (html.indexOf("®") === -1 && html.indexOf("©") === -1)) {
    return html ?? "";
  }

  const placeholders: string[] = [];
  const alreadyWrappedPattern =
    /<span\b[^>]*\bclass=(["'])[^"']*\bsigns\b[^"']*\1[^>]*>\s*(®|©)\s*<\/span>/gi;

  let output = html.replace(alreadyWrappedPattern, (match) => {
    const token = `${SIGN_PLACEHOLDER_PREFIX}${placeholders.length}__`;
    placeholders.push(match);
    return token;
  });

  output = output.replace(
    /[®©]/g,
    (symbol) => `<span class="signs">${symbol}</span>`,
  );

  for (let index = 0; index < placeholders.length; index += 1) {
    output = output.replace(
      `${SIGN_PLACEHOLDER_PREFIX}${index}__`,
      placeholders[index],
    );
  }

  return output;
}

