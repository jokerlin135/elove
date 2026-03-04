import type { Theme } from "../schemas/document.schema";
import { mergeDeep } from "../utils/merge-deep";

export function resolveTheme(theme: Theme): Record<string, string> {
  const tokens = theme.overrides
    ? (mergeDeep(theme.tokens as Record<string, unknown>, theme.overrides as Record<string, unknown>) as typeof theme.tokens)
    : theme.tokens;

  return {
    "--color-primary": tokens.color.primary,
    "--color-secondary": tokens.color.secondary,
    "--color-accent": tokens.color.accent,
    "--color-background": tokens.color.background,
    "--color-surface": tokens.color.surface,
    "--color-text": tokens.color.text,
    "--color-text-muted": tokens.color.textMuted,
    "--font-heading-family": tokens.typography.heading.family,
    "--font-heading-weight": tokens.typography.heading.weight,
    "--font-body-family": tokens.typography.body.family,
    "--font-body-weight": tokens.typography.body.weight,
    "--spacing-section": tokens.spacing.section,
    "--spacing-element": tokens.spacing.element,
    "--spacing-page": tokens.spacing.page,
    "--border-radius": tokens.border.radius,
    "--border-width": tokens.border.width,
    "--border-color": tokens.border.color,
    "--shadow-sm": tokens.shadow.sm,
    "--shadow-md": tokens.shadow.md,
    "--shadow-lg": tokens.shadow.lg,
    "--animation-duration": tokens.animation.duration,
    "--animation-easing": tokens.animation.easing,
    "--animation-stagger": tokens.animation.stagger,
  };
}
