// Zod schemas for ProjectDocument and Theme
import { z } from "zod";

const recordUnknown = z.record(z.string(), z.unknown());
const recordString = z.record(z.string(), z.string());

const SlotPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  rotation: z.number(),
  zIndex: z.number(),
});

const SlotSchema = z.object({
  id: z.string().min(1),
  componentType: z.enum(["text", "image", "video", "shape", "button", "icon", "divider"]),
  props: recordUnknown,
  position: SlotPositionSchema.optional(),
});

const SectionSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  layoutMode: z.enum(["stack", "grid", "free"]),
  slots: z.array(SlotSchema),
});

const PageSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  sections: z.array(SectionSchema),
});

export const ProjectDocumentSchema = z.object({
  schema_version: z.number().int().positive(),
  structure: z.object({
    pages: z.array(PageSchema).min(1),
    globalSlots: z.object({
      navigation: recordUnknown.nullable(),
      musicPlayer: recordUnknown.nullable(),
      footer: recordUnknown.nullable(),
    }),
  }),
  content: z.object({
    data: z.object({
      couple: z.object({
        partner1: z.string(),
        partner2: z.string(),
        weddingDate: z.string(),
        venue: z.string(),
        story: z.string(),
      }),
      event: z.object({
        ceremonies: z.array(z.unknown()),
        receptions: z.array(z.unknown()),
        afterParties: z.array(z.unknown()),
      }),
      gallery: z.object({ albums: z.array(z.unknown()) }),
      rsvp: z.object({
        formFields: z.array(z.unknown()),
        deadline: z.string().nullable(),
      }),
      music: z.object({
        tracks: z.array(z.unknown()),
        autoplay: z.boolean(),
      }),
    }),
    slotContent: recordUnknown,
    customSections: z.array(z.unknown()),
  }),
  behavior: z.object({
    sectionBehaviors: recordUnknown,
    pageTransitions: z.object({
      type: z.string(),
      duration: z.number(),
      easing: z.string(),
    }),
    globalBehaviors: z.object({
      smoothScroll: z.boolean(),
      lazyLoad: z.boolean(),
      prefetch: z.boolean(),
    }),
    accessibilityFallback: z.object({
      reducedMotion: z.boolean(),
      highContrast: z.boolean(),
      screenReader: z.boolean(),
    }),
  }),
});

export const ThemeSchema = z.object({
  baseThemeId: z.string(),
  tokens: z.object({
    color: z.object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
      background: z.string(),
      surface: z.string(),
      text: z.string(),
      textMuted: z.string(),
    }),
    typography: z.object({
      heading: z.object({
        family: z.string(),
        weight: z.string(),
        sizes: recordString,
      }),
      body: z.object({
        family: z.string(),
        weight: z.string(),
        sizes: recordString,
      }),
    }),
    spacing: z.object({
      section: z.string(),
      element: z.string(),
      page: z.string(),
    }),
    border: z.object({
      radius: z.string(),
      width: z.string(),
      color: z.string(),
    }),
    shadow: z.object({
      sm: z.string(),
      md: z.string(),
      lg: z.string(),
    }),
    animation: z.object({
      duration: z.string(),
      easing: z.string(),
      stagger: z.string(),
    }),
  }),
  overrides: recordUnknown.optional(),
});

export type ProjectDocument = z.infer<typeof ProjectDocumentSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
