import { describe, it, expect } from "vitest";
import { resolveTheme } from "../resolve-theme";
import { ELEGANT_THEME, MINIMAL_THEME, PLAYFUL_THEME, SYSTEM_THEMES } from "../system-themes";

describe("resolveTheme", () => {
  it("returns flat CSS custom properties from ELEGANT_THEME", () => {
    const result = resolveTheme(ELEGANT_THEME);
    expect(result["--color-primary"]).toBeDefined();
    expect(result["--font-heading-family"]).toBeDefined();
    expect(result["--spacing-section"]).toBeDefined();
    expect(result["--animation-duration"]).toBeDefined();
  });

  it("applies overrides on top of base tokens", () => {
    const theme = {
      ...ELEGANT_THEME,
      overrides: { color: { primary: "#FF0000" } },
    };
    const result = resolveTheme(theme);
    expect(result["--color-primary"]).toBe("#FF0000");
    // Unchanged tokens must remain
    expect(result["--color-secondary"]).toBe(ELEGANT_THEME.tokens.color.secondary);
  });

  it("3 system themes are exported", () => {
    expect(SYSTEM_THEMES).toHaveLength(3);
    expect(SYSTEM_THEMES.map(t => t.baseThemeId)).toContain("elegant");
    expect(SYSTEM_THEMES.map(t => t.baseThemeId)).toContain("minimal");
    expect(SYSTEM_THEMES.map(t => t.baseThemeId)).toContain("playful");
  });

  it("MINIMAL_THEME resolves correctly", () => {
    const result = resolveTheme(MINIMAL_THEME);
    expect(result["--color-primary"]).toBe(MINIMAL_THEME.tokens.color.primary);
  });
});
