import type { Theme } from "../schemas/document.schema";

export const ELEGANT_THEME: Theme = {
  baseThemeId: "elegant",
  tokens: {
    color: {
      primary: "#8B5E3C",
      secondary: "#C4A882",
      accent: "#D4AF37",
      background: "#FAF8F5",
      surface: "#FFFFFF",
      text: "#2C2C2C",
      textMuted: "#888888",
    },
    typography: {
      heading: {
        family: "Playfair Display",
        weight: "700",
        sizes: { xl: "3rem", lg: "2rem", md: "1.5rem", sm: "1.25rem" },
      },
      body: {
        family: "Lora",
        weight: "400",
        sizes: { md: "1rem", sm: "0.875rem" },
      },
    },
    spacing: { section: "5rem", element: "1.5rem", page: "2rem" },
    border: { radius: "4px", width: "1px", color: "#C4A882" },
    shadow: {
      sm: "0 1px 3px rgba(0,0,0,0.1)",
      md: "0 4px 12px rgba(0,0,0,0.1)",
      lg: "0 8px 24px rgba(0,0,0,0.15)",
    },
    animation: { duration: "600ms", easing: "ease-in-out", stagger: "100ms" },
  },
};

export const MINIMAL_THEME: Theme = {
  baseThemeId: "minimal",
  tokens: {
    color: {
      primary: "#1A1A1A",
      secondary: "#666666",
      accent: "#FF6B6B",
      background: "#FFFFFF",
      surface: "#F5F5F5",
      text: "#1A1A1A",
      textMuted: "#999999",
    },
    typography: {
      heading: {
        family: "Inter",
        weight: "700",
        sizes: { xl: "2.5rem", lg: "1.75rem", md: "1.25rem", sm: "1rem" },
      },
      body: {
        family: "Inter",
        weight: "400",
        sizes: { md: "1rem", sm: "0.875rem" },
      },
    },
    spacing: { section: "3rem", element: "1rem", page: "1.5rem" },
    border: { radius: "2px", width: "1px", color: "#E5E5E5" },
    shadow: {
      sm: "0 1px 2px rgba(0,0,0,0.05)",
      md: "0 2px 8px rgba(0,0,0,0.08)",
      lg: "0 4px 16px rgba(0,0,0,0.1)",
    },
    animation: { duration: "300ms", easing: "ease", stagger: "50ms" },
  },
};

export const PLAYFUL_THEME: Theme = {
  baseThemeId: "playful",
  tokens: {
    color: {
      primary: "#FF85A1",
      secondary: "#FFA8C5",
      accent: "#85C1E9",
      background: "#FFF5F8",
      surface: "#FFFFFF",
      text: "#444444",
      textMuted: "#AAAAAA",
    },
    typography: {
      heading: {
        family: "Quicksand",
        weight: "700",
        sizes: { xl: "2.75rem", lg: "2rem", md: "1.5rem", sm: "1.25rem" },
      },
      body: {
        family: "Quicksand",
        weight: "500",
        sizes: { md: "1rem", sm: "0.875rem" },
      },
    },
    spacing: { section: "4rem", element: "1.25rem", page: "2rem" },
    border: { radius: "16px", width: "2px", color: "#FFA8C5" },
    shadow: {
      sm: "0 2px 8px rgba(255,133,161,0.15)",
      md: "0 4px 16px rgba(255,133,161,0.2)",
      lg: "0 8px 32px rgba(255,133,161,0.25)",
    },
    animation: {
      duration: "500ms",
      easing: "cubic-bezier(0.34,1.56,0.64,1)",
      stagger: "80ms",
    },
  },
};

export const SYSTEM_THEMES: Theme[] = [ELEGANT_THEME, MINIMAL_THEME, PLAYFUL_THEME];
