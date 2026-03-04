import type { Theme } from "@elove/shared";
import { resolveTheme } from "@elove/shared";

export async function step4CompileTheme(
  theme: Theme,
): Promise<{ cssTokens: Record<string, string>; fontDeclarations: string }> {
  const cssTokens = resolveTheme(theme);

  // Build Google Fonts import from heading + body families
  const families = [
    theme.tokens.typography.heading.family,
    theme.tokens.typography.body.family,
  ]
    .filter(Boolean)
    .map((f) => f.replace(/ /g, "+"))
    .join("&family=");

  const fontDeclarations = families
    ? `@import url('https://fonts.googleapis.com/css2?family=${families}&display=swap');\n`
    : "";

  return { cssTokens, fontDeclarations };
}
