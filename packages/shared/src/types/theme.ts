// Theme types for ELove Platform

export interface ColorTokens {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
}

export interface TypographyScale {
  family: string;
  weight: string;
  sizes: Record<string, string>;
}

export interface TypographyTokens {
  heading: TypographyScale;
  body: TypographyScale;
}

export interface SpacingTokens {
  section: string;
  element: string;
  page: string;
}

export interface BorderTokens {
  radius: string;
  width: string;
  color: string;
}

export interface ShadowTokens {
  sm: string;
  md: string;
  lg: string;
}

export interface AnimationTokens {
  duration: string;
  easing: string;
  stagger: string;
}

export interface ThemeTokens {
  color: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  border: BorderTokens;
  shadow: ShadowTokens;
  animation: AnimationTokens;
}

// Theme type is re-exported from ../schemas/document.schema as z.infer<typeof ThemeSchema>
