# ELove Template Engine — Deep Technical Design

**Version:** 1.0
**Date:** March 3, 2026
**Scope:** The internal rendering engine that converts JSON template definitions into interactive, animated wedding invitation websites.
**Prerequisite:** Read `architecture-saas-wedding-platform.md` for system context.

---

## Table of Contents

1. JSON Schema Structure (Four-Layer Architecture)
2. Component Registry Design
3. Rendering Pipeline (15-Step Detail)
4. Template Versioning Strategy
5. Multi-Theme Support Per Template
6. Template Deduplication Strategy
7. Marketplace Template Safety
8. Performance Strategy
9. AI Content Injection Capability

---

## 1. JSON Schema Structure — Four-Layer Architecture

The template engine uses a strict four-layer document model. Each layer has a distinct responsibility and can be versioned, themed, and composed independently. This is the critical architectural insight: separating *structure* from *style* from *content* from *behavior* enables reuse, theming, A/B testing, and AI injection without mutation of the core template.

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: BEHAVIOR LAYER (animation + interaction)          │
│  "What moves and responds"                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  LAYER 3: CONTENT LAYER (text, images, data bindings)  │ │
│  │  "What the visitor sees"                               │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  LAYER 2: THEME LAYER (design tokens + styles)   │  │ │
│  │  │  "How it looks"                                  │  │ │
│  │  │  ┌────────────────────────────────────────────┐  │  │ │
│  │  │  │  LAYER 1: STRUCTURE LAYER (layout + slots) │  │  │ │
│  │  │  │  "Where things go"                         │  │  │ │
│  │  │  └────────────────────────────────────────────┘  │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 Layer 1 — Structure Layer (Template Blueprint)

This is the skeleton. It defines the page topology, section ordering, slot positions, and layout constraints. It never contains actual content or styling — only *where things go*.

```jsonc
{
  "$schema": "elove/template/v2",
  "templateId": "eternal-bloom",
  "schemaVersion": 2,
  "metadata": {
    "name": "Eternal Bloom",
    "category": "elegant",
    "tags": ["floral", "serif", "animated", "multi-page"],
    "author": { "id": "usr_xxx", "name": "Studio Bloom", "type": "marketplace" },
    "license": "marketplace-standard",       // or "system" for first-party
    "previewUrl": "https://cdn.elove.me/templates/eternal-bloom/preview.mp4",
    "thumbnails": {
      "card": "https://cdn.elove.me/templates/eternal-bloom/thumb-card.webp",
      "full": "https://cdn.elove.me/templates/eternal-bloom/thumb-full.webp"
    },
    "supportedFeatures": ["rsvp", "guestbook", "countdown", "gallery", "music", "map"],
    "estimatedLoadWeight": "medium"          // light | medium | heavy (used for perf budgets)
  },

  "pages": [
    {
      "pageId": "home",
      "slug": "home",
      "title": "Home",
      "isRequired": true,                    // cannot be removed by user
      "sections": [
        {
          "sectionId": "hero",
          "type": "hero",
          "layoutMode": "stack",             // stack | free | grid
          "layoutConfig": {
            "direction": "vertical",
            "alignment": "center",
            "justification": "center",
            "gap": 0,
            "padding": [0, 0, 0, 0],
            "minHeight": "100vh",
            "maxWidth": null,                // null = full-bleed
            "overflow": "hidden"
          },
          "slots": [
            {
              "slotId": "hero-background",
              "purpose": "section-background",
              "accepts": ["image", "video", "gradient", "lottie"],
              "required": true,
              "constraints": {
                "aspectRatio": null,          // null = fills container
                "position": "absolute-fill",  // absolute-fill | flow
                "zIndex": 0
              }
            },
            {
              "slotId": "hero-overlay",
              "purpose": "decorative-overlay",
              "accepts": ["gradient", "shape"],
              "required": false,
              "constraints": {
                "position": "absolute-fill",
                "zIndex": 1
              }
            },
            {
              "slotId": "hero-couple-names",
              "purpose": "primary-text",
              "accepts": ["text"],
              "required": true,
              "constraints": {
                "position": "flow",
                "zIndex": 2,
                "maxCharacters": 60,
                "textRole": "heading-1"       // maps to theme token
              },
              "contentBinding": "$.couple.displayNames"   // data-bind path
            },
            {
              "slotId": "hero-date",
              "purpose": "date-display",
              "accepts": ["text", "countdown"],
              "required": true,
              "constraints": {
                "position": "flow",
                "zIndex": 2,
                "textRole": "heading-3"
              },
              "contentBinding": "$.event.dateFormatted"
            },
            {
              "slotId": "hero-venue",
              "purpose": "venue-display",
              "accepts": ["text"],
              "required": false,
              "constraints": {
                "position": "flow",
                "zIndex": 2,
                "textRole": "body-large"
              },
              "contentBinding": "$.event.venueName"
            },
            {
              "slotId": "hero-cta",
              "purpose": "call-to-action",
              "accepts": ["button"],
              "required": false,
              "constraints": {
                "position": "flow",
                "zIndex": 2,
                "buttonRole": "primary"       // maps to theme token
              }
            },
            {
              "slotId": "hero-scroll-indicator",
              "purpose": "scroll-affordance",
              "accepts": ["lottie", "shape", "icon"],
              "required": false,
              "constraints": {
                "position": "absolute-bottom",
                "zIndex": 3
              }
            }
          ],
          "responsiveOverrides": {
            "mobile": {
              "layoutConfig": {
                "padding": [40, 20, 40, 20],
                "minHeight": "100svh"         // safe viewport height for mobile
              },
              "slotOverrides": {
                "hero-scroll-indicator": { "hidden": true }
              }
            }
          }
        },
        {
          "sectionId": "countdown",
          "type": "countdown",
          "layoutMode": "stack",
          "layoutConfig": {
            "direction": "vertical",
            "alignment": "center",
            "gap": 24,
            "padding": [80, 40, 80, 40],
            "maxWidth": 960
          },
          "slots": [
            {
              "slotId": "countdown-heading",
              "purpose": "section-heading",
              "accepts": ["text"],
              "required": false,
              "constraints": { "textRole": "heading-2" },
              "contentBinding": null            // user-editable, no auto-bind
            },
            {
              "slotId": "countdown-timer",
              "purpose": "countdown-display",
              "accepts": ["countdown"],
              "required": true,
              "constraints": {},
              "contentBinding": "$.event.dateISO"
            }
          ]
        }
        // ... additional sections: story, gallery, rsvp, guestbook, footer
      ]
    }
    // ... additional pages: rsvp, gallery, our-story
  ],

  "globalSlots": {
    "navigation": {
      "type": "navigation",
      "position": "fixed-top",
      "slots": [
        { "slotId": "nav-logo", "accepts": ["image", "text"], "contentBinding": "$.couple.monogram" },
        { "slotId": "nav-links", "accepts": ["nav-links"], "autogenerate": true }
      ]
    },
    "musicPlayer": {
      "type": "music-player",
      "position": "fixed-bottom-right",
      "slots": [
        { "slotId": "music-track", "accepts": ["audio"], "contentBinding": "$.music.trackUrl" }
      ]
    },
    "footer": {
      "type": "footer",
      "slots": [
        { "slotId": "footer-branding", "accepts": ["text", "image"], "systemManaged": true }
      ]
    }
  }
}
```

### 1.2 Layer 2 — Theme Layer (Design Tokens)

Themes are self-contained token sets that can be swapped without touching structure or content. A template ships with a default theme but can declare compatibility with other themes.

```jsonc
{
  "$schema": "elove/theme/v1",
  "themeId": "bloom-rose",
  "name": "Rose Garden",
  "compatibleWith": ["eternal-bloom", "garden-party", "soft-petals"],  // template IDs
  "variant": "default",          // default | dark | autumn | custom

  "tokens": {
    "color": {
      "primary":        "#C4918A",
      "primaryLight":   "#E8CFC8",
      "primaryDark":    "#8B5E57",
      "secondary":      "#4A6741",
      "secondaryLight": "#8BA888",
      "accent":         "#D4AF37",
      "background":     "#FDF8F5",
      "backgroundAlt":  "#F5EDE8",
      "surface":        "#FFFFFF",
      "text":           "#2C1810",
      "textMuted":      "#6B5B54",
      "textOnPrimary":  "#FFFFFF",
      "border":         "#E8D5CE",
      "overlay":        "rgba(44, 24, 16, 0.4)",
      "gradient": {
        "hero":         "linear-gradient(180deg, rgba(44,24,16,0.3) 0%, rgba(44,24,16,0.6) 100%)",
        "section":      "linear-gradient(180deg, var(--color-background) 0%, var(--color-backgroundAlt) 100%)"
      }
    },

    "typography": {
      "fontFamilies": {
        "heading":    { "family": "Playfair Display", "fallback": "Georgia, serif", "source": "google" },
        "body":       { "family": "Lato", "fallback": "Helvetica, sans-serif", "source": "google" },
        "accent":     { "family": "Great Vibes", "fallback": "cursive", "source": "google" },
        "monospace":  { "family": "JetBrains Mono", "fallback": "monospace", "source": "google" }
      },
      "scale": {
        "heading-1":    { "family": "accent",  "size": 64, "weight": 400, "lineHeight": 1.1, "letterSpacing": -0.02, "textTransform": "none" },
        "heading-2":    { "family": "heading", "size": 40, "weight": 700, "lineHeight": 1.2, "letterSpacing": -0.01, "textTransform": "none" },
        "heading-3":    { "family": "heading", "size": 28, "weight": 600, "lineHeight": 1.3, "letterSpacing": 0, "textTransform": "none" },
        "body-large":   { "family": "body",    "size": 20, "weight": 400, "lineHeight": 1.6, "letterSpacing": 0.01, "textTransform": "none" },
        "body":         { "family": "body",    "size": 16, "weight": 400, "lineHeight": 1.6, "letterSpacing": 0, "textTransform": "none" },
        "body-small":   { "family": "body",    "size": 14, "weight": 400, "lineHeight": 1.5, "letterSpacing": 0.01, "textTransform": "none" },
        "label":        { "family": "body",    "size": 12, "weight": 600, "lineHeight": 1.4, "letterSpacing": 0.08, "textTransform": "uppercase" },
        "button":       { "family": "body",    "size": 16, "weight": 600, "lineHeight": 1.0, "letterSpacing": 0.04, "textTransform": "uppercase" }
      },
      "responsiveScale": {
        "mobile": {
          "heading-1":  { "size": 40 },
          "heading-2":  { "size": 28 },
          "heading-3":  { "size": 22 },
          "body-large": { "size": 18 }
        }
      }
    },

    "spacing": {
      "unit": 8,
      "sectionPaddingY": 80,
      "sectionPaddingX": 40,
      "cardPadding": 24,
      "elementGap": 16,
      "responsiveOverrides": {
        "mobile": {
          "sectionPaddingY": 48,
          "sectionPaddingX": 20
        }
      }
    },

    "shape": {
      "borderRadius": {
        "none": 0,
        "small": 4,
        "medium": 8,
        "large": 16,
        "pill": 9999
      },
      "buttonRadius": "pill",
      "cardRadius": "medium",
      "imageRadius": "small"
    },

    "elevation": {
      "none":   "none",
      "low":    "0 2px 8px rgba(44, 24, 16, 0.08)",
      "medium": "0 4px 16px rgba(44, 24, 16, 0.12)",
      "high":   "0 8px 32px rgba(44, 24, 16, 0.16)"
    },

    "motion": {
      "duration": {
        "instant":  100,
        "fast":     200,
        "normal":   400,
        "slow":     800,
        "dramatic": 1200
      },
      "easing": {
        "default":    "cubic-bezier(0.4, 0, 0.2, 1)",
        "entrance":   "cubic-bezier(0.0, 0, 0.2, 1)",
        "exit":       "cubic-bezier(0.4, 0, 1, 1)",
        "spring":     "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        "elegant":    "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
      },
      "prefersReducedMotion": {
        "strategy": "reduce-to-fade",      // reduce-to-fade | disable-all | respect-system
        "maxDuration": 300
      }
    },

    "decorative": {
      "divider": {
        "type": "svg-ornament",
        "asset": "dividers/floral-vine.svg",
        "color": "var(--color-primary)",
        "height": 32
      },
      "backgroundPattern": {
        "type": "svg-tile",
        "asset": "patterns/subtle-leaves.svg",
        "opacity": 0.04,
        "scale": 1.0
      },
      "sectionTransition": "soft-curve"    // soft-curve | diagonal | wave | none
    }
  }
}
```

### 1.3 Layer 3 — Content Layer (User Data + Bindings)

This is what the user edits. It's separated from structure so templates can be swapped under the same content, and AI can inject content without mutating layout.

```jsonc
{
  "$schema": "elove/content/v1",
  "projectId": "proj_abc123",

  "data": {
    "couple": {
      "partner1": { "firstName": "Sarah", "lastName": "Chen" },
      "partner2": { "firstName": "James", "lastName": "Nakamura" },
      "displayNames": "Sarah & James",
      "monogram": "S&J"
    },
    "event": {
      "dateISO": "2026-09-15T16:00:00-07:00",
      "dateFormatted": "September 15, 2026",
      "timeFormatted": "4:00 PM",
      "venueName": "Sunstone Winery",
      "venueAddress": "125 N Refugio Rd, Santa Ynez, CA 93460",
      "venueCoords": { "lat": 34.6123, "lng": -119.9456 },
      "events": [
        { "name": "Ceremony", "time": "4:00 PM", "location": "Garden Terrace" },
        { "name": "Cocktail Hour", "time": "5:00 PM", "location": "Olive Grove" },
        { "name": "Reception", "time": "6:30 PM", "location": "Barrel Room" }
      ]
    },
    "story": {
      "howWeMet": { "title": "How We Met", "body": "...", "date": "March 2019", "image": "media_001" },
      "proposal": { "title": "The Proposal", "body": "...", "date": "December 2025", "image": "media_002" }
    },
    "gallery": {
      "images": ["media_003", "media_004", "media_005", "media_006"]
    },
    "rsvp": {
      "deadline": "2026-08-15",
      "maxPartySize": 4,
      "mealOptions": ["Filet Mignon", "Salmon", "Vegetarian Risotto"],
      "customQuestions": [
        { "id": "song", "label": "Song request?", "type": "text", "required": false }
      ]
    },
    "music": {
      "trackUrl": "media_010",
      "autoplay": true
    }
  },

  "slotContent": {
    "hero-background": {
      "elementType": "image",
      "props": {
        "src": "media_020",
        "alt": "Sarah and James at the vineyard",
        "objectFit": "cover",
        "focalPoint": { "x": 0.5, "y": 0.35 }
      }
    },
    "hero-overlay": {
      "elementType": "gradient",
      "props": {
        "value": "token:color.gradient.hero"     // references theme token
      }
    },
    "hero-couple-names": {
      "elementType": "text",
      "props": {
        "html": "<span>Sarah</span> <em>&</em> <span>James</span>",
        "binding": "$.couple.displayNames"
      }
    },
    "hero-cta": {
      "elementType": "button",
      "props": {
        "label": "RSVP Now",
        "action": { "type": "scrollTo", "target": "#rsvp" }
      }
    }
    // ... every slot gets a content entry
  },

  "customSections": [
    // User-added sections outside the template structure
    {
      "afterSection": "gallery",
      "sectionDefinition": {
        // Full section structure (same format as template sections)
        // These are "escape hatches" — free-form sections the user builds
      }
    }
  ]
}
```

### 1.4 Layer 4 — Behavior Layer (Animation + Interaction)

Separated from structure so behavior can be A/B tested, themed differently, and reduced for accessibility without touching any other layer.

```jsonc
{
  "$schema": "elove/behavior/v1",
  "behaviorSetId": "bloom-dramatic",
  "compatibleWith": ["eternal-bloom"],

  "sectionBehaviors": {
    "hero": {
      "entrance": {
        "stagger": true,
        "staggerDelay": 200,
        "slotSequence": ["hero-background", "hero-overlay", "hero-couple-names", "hero-date", "hero-venue", "hero-cta"],
        "slotAnimations": {
          "hero-background":    { "type": "kenBurns", "duration": 20000, "scale": [1.0, 1.15] },
          "hero-couple-names":  { "type": "fadeUp", "duration": 1000, "delay": 400, "easing": "token:motion.easing.elegant" },
          "hero-date":          { "type": "fadeUp", "duration": 800, "delay": 600, "easing": "token:motion.easing.elegant" },
          "hero-venue":         { "type": "fadeIn", "duration": 600, "delay": 800 },
          "hero-cta":           { "type": "fadeIn", "duration": 400, "delay": 1200 }
        }
      },
      "scroll": {
        "hero-background": { "type": "parallax", "speed": -0.3 },
        "hero-couple-names": { "type": "fadeOutOnScroll", "start": 0.3, "end": 0.7 }
      }
    },
    "countdown": {
      "entrance": {
        "trigger": "inView",
        "triggerOffset": 0.2,
        "slotAnimations": {
          "countdown-heading": { "type": "fadeUp", "duration": 600 },
          "countdown-timer":   { "type": "flipIn", "duration": 800, "delay": 300 }
        }
      }
    }
    // ... per-section behavior definitions
  },

  "pageTransitions": {
    "type": "crossfade",            // crossfade | slide | morph | none
    "duration": 500
  },

  "globalBehaviors": {
    "smoothScroll": true,
    "scrollSnap": false,
    "cursorEffect": "none",         // none | trail | spotlight
    "loadingAnimation": {
      "type": "logo-reveal",
      "duration": 1500,
      "asset": "loading/bloom-petals.json"   // Lottie file
    }
  },

  "accessibilityFallback": {
    "prefersReducedMotion": {
      "allEntrances": { "type": "fadeIn", "duration": 200 },
      "allScroll": { "type": "none" },
      "pageTransitions": { "type": "none" },
      "kenBurns": { "type": "static" }
    }
  }
}
```

### 1.5 A/B Variant Schema

Variants are lightweight overlays on any layer. They don't duplicate the full template — they express *diffs*.

```jsonc
{
  "$schema": "elove/variant/v1",
  "variantId": "bloom-minimal-hero",
  "baseTemplateId": "eternal-bloom",
  "baseTemplateVersion": 3,
  "targetLayer": "structure",            // structure | theme | content | behavior
  "description": "Minimal hero — no overlay, centered text, no CTA",

  "patches": [
    { "op": "remove", "path": "/pages/0/sections/0/slots/1" },           // remove hero-overlay
    { "op": "remove", "path": "/pages/0/sections/0/slots/5" },           // remove hero-cta
    { "op": "replace", "path": "/pages/0/sections/0/layoutConfig/gap", "value": 32 },
    { "op": "add", "path": "/pages/0/sections/0/slots/2/constraints/textRole", "value": "heading-2" }
  ],

  "metrics": {
    "trackingId": "ab_bloom_hero_minimal",
    "conversionEvent": "rsvp_submitted",
    "impressionEvent": "hero_viewed"
  }
}
```

Variants use **JSON Patch (RFC 6902)** format. This means no data duplication — a variant is typically 200-500 bytes regardless of template size.

---

## 2. Component Registry Design

The component registry is the bridge between the JSON schema and actual rendered output. It maps element types to renderers, validates props, and enforces security boundaries.

### 2.1 Registry Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   COMPONENT REGISTRY                         │
│                                                             │
│  ┌───────────────┐    ┌───────────────┐                    │
│  │  ELEMENT       │    │  SECTION       │                    │
│  │  REGISTRY      │    │  LAYOUT        │                    │
│  │                │    │  REGISTRY      │                    │
│  │  text ────────▶│    │                │                    │
│  │  image ───────▶│    │  stack ───────▶│                    │
│  │  video ───────▶│    │  free ────────▶│                    │
│  │  shape ───────▶│    │  grid ────────▶│                    │
│  │  countdown ───▶│    │  masonry ────▶│                    │
│  │  lottie ──────▶│    │                │                    │
│  │  map ─────────▶│    └───────┬───────┘                    │
│  │  gallery ─────▶│            │                            │
│  │  rsvp_form ───▶│            │                            │
│  │  guestbook ───▶│    ┌───────▼───────┐                    │
│  │  button ──────▶│    │  WIDGET        │                    │
│  │  icon ────────▶│    │  REGISTRY      │                    │
│  │  divider ─────▶│    │                │                    │
│  │  audio ───────▶│    │  navigation ──▶│                    │
│  │  embed ───────▶│    │  music-player ▶│                    │
│  │               │    │  cookie-banner▶│                    │
│  └───────┬───────┘    │  loading ─────▶│                    │
│          │            └───────┬───────┘                    │
│          │                    │                            │
│          ▼                    ▼                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                 RENDERER INTERFACE                    │  │
│  │                                                     │  │
│  │  For each registered component:                     │  │
│  │                                                     │  │
│  │  ┌─────────────────────────────────────────────┐   │  │
│  │  │  ComponentDefinition {                       │   │  │
│  │  │    type: string                              │   │  │
│  │  │    category: 'element' | 'layout' | 'widget' │   │  │
│  │  │    version: number                           │   │  │
│  │  │    propsSchema: JSONSchema                   │   │  │
│  │  │    defaultProps: object                      │   │  │
│  │  │    acceptsChildren: boolean                  │   │  │
│  │  │    capabilities: string[]                    │   │  │
│  │  │                                              │   │  │
│  │  │    // Multiple render targets:               │   │  │
│  │  │    renderers: {                              │   │  │
│  │  │      editor:   EditorRenderer     // canvas  │   │  │
│  │  │      static:   StaticRenderer     // HTML    │   │  │
│  │  │      ssr:      SSRRenderer        // Node    │   │  │
│  │  │      preview:  PreviewRenderer    // thumb   │   │  │
│  │  │    }                                         │   │  │
│  │  │                                              │   │  │
│  │  │    // Validation + security:                 │   │  │
│  │  │    sanitize(props): SanitizedProps           │   │  │
│  │  │    validate(props): ValidationResult         │   │  │
│  │  │    estimateWeight(): PerformanceBudget       │   │  │
│  │  │  }                                           │   │  │
│  │  └─────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Component Registration Table

| Type | Category | Render Targets | Accepts Children | Dynamic | Security Level |
|------|----------|---------------|-----------------|---------|----------------|
| `text` | element | editor, static, ssr, preview | No | No | Safe (HTML sanitized) |
| `image` | element | editor, static, ssr, preview | No | No | Safe (src validated) |
| `video` | element | editor, static, preview | No | No | Safe (src validated) |
| `shape` | element | editor, static, ssr, preview | No | No | Safe (SVG sanitized) |
| `lottie` | element | editor, static, preview | No | No | Medium (JSON validated) |
| `countdown` | element | editor, static, ssr | No | Yes (time-based) | Safe |
| `map` | element | editor, static | No | Yes (API call) | Medium (API key scoped) |
| `gallery` | element | editor, static, ssr | Yes (images) | No | Safe |
| `rsvp_form` | element | editor, static | Yes (fields) | Yes (submit) | High (form handling) |
| `guestbook` | element | editor, static | No | Yes (load + submit) | High (UGC) |
| `button` | element | editor, static, ssr, preview | No | No | Safe |
| `icon` | element | editor, static, ssr, preview | No | No | Safe (allowlisted) |
| `divider` | element | editor, static, ssr, preview | No | No | Safe |
| `audio` | element | editor, static | No | Yes (playback) | Medium |
| `embed` | element | static | No | Yes (iframe) | High (sandboxed) |
| `stack` | layout | editor, static, ssr | Yes | No | Safe |
| `free` | layout | editor, static, ssr | Yes | No | Safe |
| `grid` | layout | editor, static, ssr | Yes | No | Safe |
| `navigation` | widget | editor, static, ssr | Yes (links) | No | Safe |
| `music-player` | widget | editor, static | No | Yes (playback) | Medium |

### 2.3 Multi-Renderer Pattern

Each component defines how it renders in four distinct contexts. This is critical for the editor/static/SSR split.

```
RENDER CONTEXT       PURPOSE                     OUTPUT FORMAT
─────────────────────────────────────────────────────────────
editor               Live editing canvas          Konva nodes (canvas) or
                                                  React components with
                                                  drag/resize handles

static               Published site build         HTML string + CSS rules +
                                                  JS initialization snippets

ssr                  Server-rendered preview       HTML string (no JS, no
                                                  animation, placeholder
                                                  images for dynamic)

preview              Thumbnail generation          Simplified HTML for
                                                  headless screenshot
```

**Why four renderers matter:**

The editor renderer must support Konva canvas manipulation (drag handles, selection, snapping). The static renderer produces optimized production HTML with GSAP animation initialization. The SSR renderer produces a dehydrated version for OG image generation and SEO crawlers — no JavaScript, no animations, static images. The preview renderer is a stripped-down version for marketplace thumbnails.

A component that only defines `static` and `editor` is valid — SSR and preview fall back to a generic "render static, strip JS" approach.

### 2.4 Props Schema Enforcement

Every component declares a JSON Schema for its props. This serves three purposes:

1. **Editor UI generation** — The property panel auto-generates controls from the schema (color picker for `color` type, slider for `number` with min/max, dropdown for `enum`).

2. **Validation gate** — Before render, all props are validated. Invalid props are replaced with `defaultProps`. This prevents marketplace templates from injecting unexpected data.

3. **Migration path** — When a component's schema changes across versions, a migration function transforms old props to new props. The schema version is the source of truth for which migration to apply.

```
Props Flow:

  User edits in editor
        │
        ▼
  slotContent[slotId].props (raw user input)
        │
        ▼
  ComponentDefinition.sanitize(props)     ← strip HTML, validate URLs
        │
        ▼
  ComponentDefinition.validate(props)     ← check against propsSchema
        │                                   replace invalid with defaults
        ▼
  Renderer receives validated props
        │
        ▼
  Output (HTML / Canvas / etc.)
```

---

## 3. Rendering Pipeline — 15 Steps

This is the complete pipeline from "user clicks Publish" to "visitor sees the site." Every step is explicit so that any step can be cached, parallelized, or replaced independently.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FULL RENDER PIPELINE                             │
│                                                                         │
│  PHASE A: RESOLVE (steps 1-5)                                          │
│  ──────────────────────────────                                        │
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ 1.SNAPSHOT│→│ 2.MERGE  │→│ 3.BIND   │→│ 4.RESOLVE│→│ 5.THEME │ │
│  │          │  │ LAYERS   │  │ CONTENT  │  │ ASSETS   │  │ COMPILE │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                                         │
│  PHASE B: COMPILE (steps 6-10)                                         │
│  ─────────────────────────────                                         │
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ 6.SECTION│→│ 7.ELEMENT│→│ 8.ANIMATE│→│ 9.RESPOND│→│10.DYNAMIC│ │
│  │ LAYOUT   │  │ RENDER   │  │ COMPILE  │  │ -IVE     │  │ ISLANDS │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                                         │
│  PHASE C: OPTIMIZE + PACKAGE (steps 11-15)                             │
│  ──────────────────────────────────────────                            │
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │11.CSS    │→│12.JS     │→│13.HTML   │→│14.ASSET  │→│15.UPLOAD │ │
│  │ EXTRACT  │  │ BUNDLE   │  │ ASSEMBLE │  │ HASH     │  │ + ROUTE │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Detail

**Step 1 — SNAPSHOT**
Freeze the current state. Copy all four layers (structure, theme, content, behavior) into an immutable build context. This snapshot is stored as the `published_versions` record. If any A/B variant is active, apply the JSON Patch to the base layer first, producing a resolved snapshot per variant.

**Step 2 — MERGE LAYERS**
Merge the four layers into a single resolved document. For each section and each slot: take the structural definition, apply the theme tokens as CSS custom properties, inject the content bindings, and attach the behavior definitions. The output is a "resolved template" — a single JSON tree where every slot has its final type, content, styles, and animations.

**Step 3 — BIND CONTENT**
Walk every slot with a `contentBinding` path (e.g., `$.couple.displayNames`). Resolve the path against the content layer's `data` object. For slots without a binding (user-edited directly), use the `slotContent` entry. Apply text formatting rules (date formatting, character limits, fallback values for empty fields).

**Step 4 — RESOLVE ASSETS**
For every media reference (media IDs like `media_020`), resolve to CDN URLs. Generate responsive variants: `srcset` with widths [320, 640, 960, 1280, 1920]. For each image, include the blurhash for placeholder. For fonts, generate the Google Fonts URL with only the weights and character subsets actually used (scan all text content for character ranges). For Lottie files, resolve to CDN URLs. Output: a media manifest mapping every `media_xxx` to its resolved URLs.

**Step 5 — THEME COMPILE**
Convert theme tokens into CSS custom properties. Generate a `:root` block with all token values. Generate responsive overrides as `@media` blocks. Pre-compute derived values (e.g., `primaryRgb` from `primary` hex for use in `rgba()` contexts). Generate `@font-face` declarations from `fontFamilies`. Output: a `theme.css` string.

**Step 6 — SECTION LAYOUT**
For each section, invoke the layout registry. `stack` layout → CSS flexbox with direction/alignment/gap. `free` layout → CSS absolute positioning with z-index stacking. `grid` layout → CSS grid with template columns/rows. Apply section-level spacing from theme tokens (`sectionPaddingY`, `sectionPaddingX`). Apply responsive overrides. Output: per-section CSS rules and a wrapper HTML structure.

**Step 7 — ELEMENT RENDER**
For each slot in each section, look up the element type in the component registry. Invoke the `static` renderer with the sanitized, validated props. Each renderer outputs an HTML fragment and optional CSS rules. Text elements produce `<div>` with sanitized inner HTML. Image elements produce `<picture>` with `<source>` for WebP and fallback `<img>`. Countdown elements produce a `<div data-countdown="ISO">` with a JS initialization marker. This step runs in parallel across sections.

**Step 8 — ANIMATION COMPILE**
Read the behavior layer for each section. For each slot animation, generate the corresponding output:

```
Animation Type        →  Compiled Output
───────────────────────────────────────────────────────
fadeIn / fadeUp        →  CSS @keyframes + class with animation property
                         + data-animate attribute for IntersectionObserver trigger
kenBurns              →  CSS @keyframes with transform: scale() over long duration
                         Applied directly (no scroll trigger)
parallax              →  data-parallax="speed" attribute
                         + JS parallax controller (shared)
flipIn                →  CSS @keyframes with perspective + rotateX
                         + IO trigger
stagger               →  CSS animation-delay calculated from sequence order
                         per-slot: delay = baseDelay + (index × staggerDelay)
scrollFadeOut         →  data-scroll-fade="start,end" attribute
                         + JS scroll handler (shared)
```

For `prefersReducedMotion`: generate a second set of `@keyframes` inside `@media (prefers-reduced-motion: reduce)` that replaces all animations with simple opacity fades ≤300ms or disables them entirely, per the theme's `prefersReducedMotion.strategy`.

**Step 9 — RESPONSIVE COMPILE**
Generate breakpoint-specific CSS. Walk the structure layer's `responsiveOverrides` for each section and slot. Walk the theme's `responsiveScale` for typography. Walk the behavior layer for any responsive animation changes (e.g., disable parallax on mobile). All mobile overrides go inside `@media (max-width: 768px)`. Desktop-first approach: base CSS is desktop, mobile is the override.

**Step 10 — DYNAMIC ISLANDS**
Identify all components marked as `dynamic: true` (countdown, map, rsvp_form, guestbook, music-player). These cannot be fully static — they need JavaScript at runtime. For each, generate a minimal "island" script: a self-contained JS module that hydrates only that element. The static HTML includes the placeholder markup and a `<script type="module">` tag that loads only that island. This is the "islands architecture" — the page is 95% static HTML with tiny JS islands for interactive elements.

Island manifest output:
```
islands/
  countdown.js      → 2.1KB (reads data-countdown, starts timer)
  rsvp-form.js      → 4.8KB (validation, submission to edge function)
  guestbook.js      → 3.2KB (load entries, submit new)
  music-player.js   → 1.9KB (play/pause, volume)
  map.js            → 0.8KB (lazy-load Google Maps SDK)
  gallery.js        → 3.5KB (lightbox, swipe)
  parallax.js       → 1.2KB (scroll-driven transform)
  scroll-animate.js → 1.8KB (IntersectionObserver triggers)
```

**Step 11 — CSS EXTRACT**
Collect all CSS: theme.css + per-section layout CSS + per-element style CSS + animation keyframes + responsive overrides. Deduplicate identical rules. Split into critical CSS (above-the-fold: hero section only) and deferred CSS (everything else). Critical CSS will be inlined in `<head>`. Deferred CSS becomes `style.[hash].css` with `<link rel="preload">`.

**Step 12 — JS BUNDLE**
Collect all island scripts. Tree-shake: if no countdown element exists, exclude `countdown.js`. Bundle shared utilities (IntersectionObserver setup, scroll handler) into `shared.[hash].js`. Each island becomes a separate chunk: `countdown.[hash].js`, `rsvp.[hash].js`, etc. All scripts are `type="module"` with `defer`. GSAP core is a shared dependency, loaded from CDN with SRI hash. Total JS budget target: <25KB gzipped for a typical template.

**Step 13 — HTML ASSEMBLE**
Build the final HTML document for each page:

```
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- SEO meta from content layer -->
  <title>{couple.displayNames} Wedding</title>
  <meta name="description" content="...">
  <meta property="og:image" content="...">
  <!-- Preload critical assets -->
  <link rel="preload" href="fonts/playfair.woff2" as="font" crossorigin>
  <link rel="preload" href="hero.webp" as="image">
  <!-- Critical CSS inlined -->
  <style>{criticalCSS}</style>
  <!-- Deferred CSS -->
  <link rel="stylesheet" href="style.abc123.css" media="print" onload="this.media='all'">
  <!-- Theme custom properties -->
  <style>:root { --color-primary: #C4918A; ... }</style>
</head>
<body>
  <!-- Navigation widget -->
  <nav>...</nav>

  <!-- Sections in order -->
  <section id="hero" class="section section--hero" data-section="hero">
    {hero HTML with elements, animations attributes}
  </section>
  <section id="countdown" class="section section--countdown" data-section="countdown">
    {countdown HTML}
  </section>
  <!-- ... more sections -->

  <!-- Music player widget -->
  <div id="music-player">...</div>

  <!-- Island scripts (deferred, module) -->
  <script type="module" src="shared.def456.js"></script>
  <script type="module" src="countdown.ghi789.js"></script>
  <script type="module" src="scroll-animate.jkl012.js"></script>
  <!-- GSAP from CDN -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12/gsap.min.js"
          integrity="sha384-..." crossorigin></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12/ScrollTrigger.min.js"
          integrity="sha384-..." crossorigin></script>
</body>
</html>
```

**Step 14 — ASSET HASH**
Hash every output file (CSS, JS, images, fonts) using content-based hashing (SHA-256, truncated to 8 chars). Rename files to include hash: `style.abc12345.css`. Update all references in HTML. This enables immutable caching — assets with hashes get `Cache-Control: public, max-age=31536000, immutable`. Only `index.html` gets a short cache (`max-age=60, s-maxage=3600`) and is the only file that needs CDN purge on republish.

**Step 15 — UPLOAD + ROUTE**
Upload all files to R2 at prefix `published/{project_id}/{version}/`. Upload is parallelized (up to 50 concurrent PUTs). Once all files are uploaded, atomically update the KV routing table: `slug → { r2Prefix, buildHash, version }`. Purge CDN cache for `index.html` only. Update `published_versions` status to `live`. Send WebSocket notification to editor client.

---

## 4. Template Versioning Strategy

### 4.1 Version Model

```
Template "Eternal Bloom"
│
├── Version 1 (schema_version: 1)     ← Initial release
│   └── Full snapshot of structure + default theme + default behavior
│
├── Version 2 (schema_version: 1)     ← New gallery section option
│   └── Diff from v1 + full snapshot for new installs
│
├── Version 3 (schema_version: 2)     ← Schema migration (slot format changed)
│   └── Full snapshot + migration script from schema v1 → v2
│
└── Version 4 (schema_version: 2)     ← Bug fix in mobile layout
    └── Diff from v3 + full snapshot
```

### 4.2 Three Versioning Scopes

| Scope | What Changes | Impact | Migration |
|-------|-------------|--------|-----------|
| **Template version** (v1, v2, v3...) | Structure, default theme, default behavior. New sections, slot changes, layout improvements. | Projects using this template can *opt-in* to update. Never forced. | Diff-based. New slots get default content. Removed slots preserve user content in `customSections`. |
| **Schema version** (schema v1, v2...) | The shape of the JSON itself. Field renames, type changes, structural reorganization. | All templates and projects on old schema need migration before next render. | Migration functions: `migrateV1toV2(document)`. Registered in engine, run lazily on read. |
| **Component version** (per-component) | A specific component's props schema or render output. E.g., `countdown` v1 → v2 adds `showSeconds` prop. | Projects using that component get auto-migrated on next edit/publish. | Component-level `migrate(oldProps, oldVersion): newProps`. Missing new props filled from `defaultProps`. |

### 4.3 Project-Template Relationship

```
When user installs a template:
  1. project.template_version_id = template_versions.id (pinned to exact version)
  2. Template structure is COPIED into project's pages/sections/scene_graphs
  3. From this point, project is independent — template is the "seed"

When template author releases new version:
  4. User sees "Update available" badge in dashboard
  5. User can PREVIEW the update (side-by-side diff view)
  6. User chooses "Apply update" → merge algorithm runs:
     a. Identify unchanged structure (slots user hasn't modified)
     b. Update unchanged slots to new template version
     c. Preserve all user modifications (content, custom sections)
     d. Flag conflicts: "Template removed a slot you customized"
     e. User resolves conflicts manually

This is the "fork + optional rebase" model from Git.
```

### 4.4 Schema Migration Registry

```
MIGRATION REGISTRY
─────────────────────────────
Schema v1 → v2:
  - Rename "animation_config" → moved into behavior layer
  - Add "responsiveOverrides" to section level
  - Migrate element "style" flat properties into nested "style" object
  - Add "slotId" to all elements (auto-generate from type + index)

Schema v2 → v3 (future):
  - Add "variants" support to structure layer
  - Add "contentBinding" to slots
  - Migrate inline content to content layer separation

Migration runs lazily:
  - On project open in editor: check schema_version, migrate if needed
  - On publish: migrate before render
  - Never migrate in DB proactively (too many projects)
  - Cache migrated result in Redis for 1 hour
```

---

## 5. Multi-Theme Support Per Template

### 5.1 Theme Architecture

```
Template "Eternal Bloom"
│
├── Theme: "Rose Garden" (default)
│   └── Warm pinks, serif fonts, floral ornaments
│
├── Theme: "Midnight Bloom" (dark variant)
│   └── Deep navy, gold accents, same structure
│
├── Theme: "Winter Bloom" (seasonal)
│   └── Cool blues, silver accents, snowflake ornaments
│
└── Theme: "Mono Bloom" (minimal)
    └── Black/white, modern sans-serif, no ornaments
```

### 5.2 Theme Compatibility Model

Themes are NOT universally compatible. Each theme declares which templates it works with via `compatibleWith`. Why? Because:

1. Templates have decorative slots (dividers, ornaments, patterns) that reference theme-specific assets. A floral divider SVG makes no sense in a geometric minimal theme.

2. Templates may assume certain font optical sizes. A heading designed for a narrow condensed font breaks with a wide display font.

3. Color contrast requirements vary. A theme designed for light backgrounds breaks if the template has a photo background section.

**Compatibility enforcement:**

```
User selects theme "Midnight Bloom" for template "Eternal Bloom"
         │
         ▼
  1. Check: theme.compatibleWith.includes(template.templateId)?
     YES → proceed
     NO  → block with "This theme isn't designed for this template"
         │
         ▼
  2. Validate decorative assets:
     For each slot where theme provides a decorative asset
     (divider, pattern, section transition SVG):
     - Does the asset exist in the theme bundle?
     - Is the asset the correct format?
     If missing → fall back to default theme's asset
         │
         ▼
  3. Validate contrast:
     For sections with image/video backgrounds:
     - Is theme.tokens.color.overlay defined?
     - Does text color meet WCAG AA against overlay?
     If not → auto-adjust overlay opacity
         │
         ▼
  4. Apply theme:
     Replace all token references with new theme's values
     CSS custom properties swap automatically
     Decorative assets swap to theme bundle versions
     Typography scales recalculate for new fonts
```

### 5.3 Theme Inheritance + Overrides

Users can customize a theme without creating a new one. Customizations are stored as overrides in the content layer:

```jsonc
// In content layer:
{
  "themeOverrides": {
    "color": {
      "primary": "#B8860B"          // user changed primary from pink to gold
    },
    "typography": {
      "fontFamilies": {
        "heading": {
          "family": "Cormorant Garamond",
          "source": "google"
        }
      }
    }
  }
}
```

The resolve order is: **base theme → template-specific theme adjustments → user overrides**. This three-level cascade means the user never loses the ability to customize, but the template author's intent is preserved as the default.

### 5.4 Theme Switching at Render Time

Because themes are pure token sets compiled to CSS custom properties, theme switching is a CSS-only operation at publish time. The render pipeline (Step 5: THEME COMPILE) simply reads a different theme JSON and outputs different `:root` values. No structural changes. No element re-rendering. This means theme preview in the editor is near-instant — swap the CSS custom properties on the canvas, and the entire design updates live.

---

## 6. Template Deduplication Strategy

### 6.1 The Problem

Without dedup, a template installed by 50,000 users means 50,000 copies of the same structure, theme, and behavior layers in the database. And when users make zero modifications (common for the first few days), those copies are identical bytes.

### 6.2 Copy-on-Write Architecture

```
INSTALLATION (no copy):

  project.template_version_id → template_versions.id
  project.content_layer → user's content (unique per project)
  project.theme_overrides → {} (empty = use template default)
  project.structure_overrides → null (null = use template as-is)
  project.behavior_overrides → null

FIRST EDIT TO STRUCTURE:

  User drags a new section → triggers "detach from template"
  1. Copy template's structure into project.structure_overrides (JSONB)
  2. Apply user's edit to the copy
  3. project.is_detached_structure = true
  4. Template reference retained for update notifications

RENDERING:

  if project.structure_overrides is null:
    → use template_version.pages_data directly (shared, cached)
  else:
    → use project.structure_overrides (per-project)
```

**Savings estimate:** If 70% of users don't modify structure (they only change content + theme colors), we avoid storing structure for 70% of projects. At 100k projects with an average structure size of 50KB, that's 3.5GB of JSONB avoided.

### 6.3 Asset Dedup

Template assets (decorative SVGs, default images, Lottie files) are stored once in R2 at a template-scoped path:

```
templates/{templateId}/v{version}/assets/
  dividers/floral-vine.svg
  patterns/subtle-leaves.svg
  loading/bloom-petals.json
  defaults/hero-placeholder.webp
```

User-uploaded media goes to a separate path:

```
media/{tenantId}/{mediaId}/
  original.jpg
  thumb.webp
  medium.webp
  large.webp
```

Published sites reference template assets by the shared CDN path. 50,000 projects using the same template all serve the same `floral-vine.svg` from the same CDN cache entry. Zero duplication in storage or cache.

### 6.4 Published Output Dedup

For the static HTML output, dedup at the asset level is inherent (content-addressed hashes). But the HTML itself is unique per project (different names, dates, photos). However, the JS islands and GSAP library are identical across all projects using the same template. These shared scripts are stored at:

```
published/shared/islands/{hash}/
  countdown.abc123.js
  scroll-animate.def456.js

published/shared/vendor/
  gsap.3.12.min.js
  gsap.scrolltrigger.3.12.min.js
```

Published site HTML references these shared paths. CDN serves them from the same cache entry regardless of which project requested them.

---

## 7. Marketplace Template Safety

### 7.1 Threat Model

| Threat | Vector | Impact |
|--------|--------|--------|
| **XSS injection** | Malicious text in slot default content containing `<script>` or event handlers | Steal visitor cookies, redirect to phishing |
| **CSS injection** | Malicious CSS in theme tokens (e.g., `background: url(https://evil.com/track)`) | Visitor tracking, UI spoofing |
| **SVG bomb** | Deeply nested SVG in decorative assets causing browser hang | DoS for visitors |
| **Lottie payload** | Lottie JSON with embedded expressions executing arbitrary JS | Code execution on visitor device |
| **Data exfiltration** | RSVP form with hidden fields posting to external endpoint | Steal guest information |
| **Resource exhaustion** | Template with 500 sections, 100 Lottie files, 50MB of assets | Slow render, high storage cost |

### 7.2 Safety Pipeline

```
MARKETPLACE TEMPLATE SUBMISSION
         │
         ▼
┌────────────────────────────────┐
│  STAGE 1: AUTOMATED SCAN       │
│  (runs immediately on upload)  │
│                                │
│  Structure validation:         │
│  ✓ JSON schema validation      │
│  ✓ Max 20 pages                │
│  ✓ Max 30 sections per page    │
│  ✓ Max 50 slots per section    │
│  ✓ Max 200 elements total      │
│  ✓ No unknown element types    │
│  ✓ No custom renderers         │
│                                │
│  Content sanitization:         │
│  ✓ All text HTML: DOMPurify    │
│    strip all tags except       │
│    <b><i><em><strong><span>    │
│    <br><a href=""> (rel=noopener) │
│  ✓ All URLs: must be relative  │
│    or match allowlisted domains│
│  ✓ No inline event handlers    │
│  ✓ No javascript: URLs         │
│                                │
│  Theme validation:             │
│  ✓ All color values: hex/rgb/  │
│    hsl only (no url())         │
│  ✓ All font sources: google    │
│    or bundled (no remote @font)│
│  ✓ No CSS expressions          │
│  ✓ No @import statements       │
│                                │
│  Asset validation:             │
│  ✓ SVGs: sanitize with         │
│    svg-sanitize (strip scripts,│
│    event handlers, foreignObj) │
│  ✓ SVG complexity: max 10k     │
│    nodes per file              │
│  ✓ Lottie: parse, strip all    │
│    expression fields, validate │
│    against lottie-schema       │
│  ✓ Images: re-encode through   │
│    Sharp (strips EXIF,         │
│    validates format)           │
│  ✓ Total asset size: max 5MB   │
│                                │
│  Behavior validation:          │
│  ✓ All animation types must    │
│    be in allowlist             │
│  ✓ No custom JS in behavior    │
│  ✓ Max animation duration:     │
│    30s (prevents infinite      │
│    resource consumption)       │
│  ✓ Parallax speed: -1 to 1    │
│                                │
│  If any check fails → REJECT   │
│  with specific error message   │
└──────────────┬─────────────────┘
               │ PASS
               ▼
┌────────────────────────────────┐
│  STAGE 2: SANDBOXED BUILD      │
│  (runs in isolated container)  │
│                                │
│  1. Run full render pipeline   │
│     in sandboxed environment   │
│  2. Measure build time         │
│     (must be <30 seconds)      │
│  3. Measure output size        │
│     (must be <2MB HTML+CSS+JS) │
│  4. Run Lighthouse on output:  │
│     Performance ≥ 85           │
│     Accessibility ≥ 90         │
│     Best Practices ≥ 90        │
│  5. Verify CSP compliance:     │
│     no inline scripts,         │
│     no eval, no external       │
│     resources except allowlist │
│  6. Screenshot desktop + mobile│
│     for marketplace display    │
│                                │
│  If any check fails → REJECT   │
└──────────────┬─────────────────┘
               │ PASS
               ▼
┌────────────────────────────────┐
│  STAGE 3: HUMAN REVIEW         │
│  (manual, for marketplace)     │
│                                │
│  Reviewer checks:              │
│  ✓ Visual quality meets bar    │
│  ✓ Responsive behavior correct │
│  ✓ No copyrighted assets       │
│  ✓ No offensive content        │
│  ✓ Template metadata accurate  │
│  ✓ Preview matches actual      │
│                                │
│  Approve → status: 'published' │
│  Reject → status: 'rejected'   │
│           with feedback         │
└────────────────────────────────┘
```

### 7.3 Runtime Safety (Published Sites)

Even after marketplace approval, every published site gets these runtime protections:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://cdnjs.cloudflare.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' https://cdn.elove.me data: blob:;
  connect-src 'self' https://api.elove.me https://maps.googleapis.com;
  frame-src https://www.google.com/maps;
  media-src 'self' https://cdn.elove.me;
  object-src 'none';
  base-uri 'self';
```

This CSP blocks any injected scripts, external resource loading, or iframe embedding that wasn't explicitly allowlisted. The `style-src 'unsafe-inline'` is required for theme custom properties and critical CSS inlining — this is the one acceptable trade-off, mitigated by the theme validation in Stage 1.

---

## 8. Performance Strategy

### 8.1 Performance Budgets

```
METRIC                     TARGET          ENFORCEMENT POINT
──────────────────────────────────────────────────────────────
Total HTML size            < 50KB          Step 13 (HTML Assemble)
Total CSS size             < 30KB          Step 11 (CSS Extract)
Total JS size (gzipped)    < 25KB          Step 12 (JS Bundle)
Critical CSS (inlined)     < 14KB          Step 11 (below TCP initial window)
Largest Contentful Paint   < 2.5s          Lighthouse in Stage 2
First Input Delay          < 100ms         Lighthouse in Stage 2
Cumulative Layout Shift    < 0.1           Lighthouse in Stage 2
Time to Interactive        < 3.5s          Lighthouse in Stage 2
Total page weight          < 1.5MB         Step 14 (Asset Hash)
  (excluding user photos)
Number of HTTP requests    < 15            Step 14
Font files                 ≤ 3             Step 5 (Theme Compile)
```

### 8.2 Optimization Techniques by Pipeline Step

| Technique | Where Applied | Impact |
|-----------|--------------|--------|
| **Critical CSS inlining** | Step 11 | Eliminates render-blocking CSS. Hero section paints on first TCP round-trip. |
| **Content-addressed assets** | Step 14 | Immutable cache headers (1 year). Repeat visitors load zero assets on unchanged pages. |
| **Image srcset + WebP/AVIF** | Step 4, Step 7 | 40-60% smaller images. Browser picks optimal size for viewport. |
| **Blurhash placeholders** | Step 7 | Instant low-res placeholder while image loads. Eliminates CLS for images. |
| **Font subsetting** | Step 4 | Only load Unicode ranges actually used. Typical savings: 70% of font file size. |
| **Font display: swap** | Step 5 | Text visible immediately with fallback font. No FOIT (flash of invisible text). |
| **JS islands architecture** | Step 10 | 95% of page is static HTML. JS only loads for interactive elements. No framework runtime. |
| **GSAP from CDN** | Step 12 | Shared across all wedding sites globally. Likely cached in visitor's browser from other sites. |
| **Deferred CSS loading** | Step 13 | Non-critical CSS loads without blocking render. `media="print"` trick with onload swap. |
| **Preload hints** | Step 13 | `<link rel="preload">` for hero image, primary font. Browser fetches them early in the waterfall. |
| **Module scripts with defer** | Step 13 | `<script type="module">` is deferred by default. Doesn't block HTML parsing. |
| **R2 serving via Workers** | Step 15 | Zero egress cost. Edge-served with Cloudflare's global network. Sub-50ms TTFB. |
| **Stale-while-revalidate** | CDN config | Visitors always get a response from cache. Fresh content served in background. |

### 8.3 Render Worker Performance

```
BUILD TIME BUDGET (p99 target: < 30 seconds)
─────────────────────────────────────────────
Step 1-2: Snapshot + Merge         ~200ms    (DB read + JSON merge)
Step 3:   Bind Content             ~50ms     (path resolution)
Step 4:   Resolve Assets           ~500ms    (media URL lookups, font subset)
Step 5:   Theme Compile            ~100ms    (token → CSS)
Step 6:   Section Layout           ~200ms    (CSS generation)
Step 7:   Element Render           ~2-5s     (parallelized across sections)
Step 8:   Animation Compile        ~300ms    (keyframe generation)
Step 9:   Responsive Compile       ~200ms    (breakpoint CSS)
Step 10:  Dynamic Islands          ~100ms    (script selection)
Step 11:  CSS Extract + Optimize   ~500ms    (dedup, critical split)
Step 12:  JS Bundle                ~1-2s     (tree-shake, chunk)
Step 13:  HTML Assemble            ~200ms    (template string)
Step 14:  Asset Hash               ~300ms    (SHA-256 all files)
Step 15:  Upload + Route           ~2-5s     (parallel R2 PUT)
──────────────────────────────────────────────
TOTAL                              ~8-15s    (typical)
                                   <30s      (worst case, complex template)
```

### 8.4 Caching Layers

```
LAYER           WHAT IS CACHED                TTL              INVALIDATION
──────────────────────────────────────────────────────────────────────────────
Browser         Hashed assets (CSS/JS/img)    1 year           Never (new hash = new URL)
                index.html                    60s client       Republish triggers CDN purge
CDN (CF)        All published files           1 year hashed    Purge API for index.html only
                                              1hr index.html
KV (Edge)       Routing table (slug→prefix)   No TTL           Updated on publish (atomic)
                Plan/quota cache              5 min            Updated on subscription change
Redis           Template structures           1 hour           Invalidate on template update
                Resolved media manifests      30 min           Invalidate on media change
                Compiled theme CSS            1 hour           Invalidate on theme change
                Schema-migrated documents     1 hour           Invalidate on edit
PostgreSQL      Query plan cache              Auto             Auto (PostgreSQL internal)
```

---

## 9. AI Content Injection Capability

### 9.1 Architecture for AI Integration

The four-layer architecture makes AI integration surgical. AI operates on the **content layer only** — it never touches structure, theme, or behavior. This is the key safety property.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI INTEGRATION ARCHITECTURE                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  AI CONTEXT BUILDER                                          │  │
│  │                                                              │  │
│  │  Inputs to LLM:                                              │  │
│  │  1. Template structure (slot purposes, constraints)          │  │
│  │  2. Content data schema (what fields exist)                  │  │
│  │  3. Current content (what user has already entered)          │  │
│  │  4. Theme personality (elegant? modern? playful?)            │  │
│  │  5. User prompt ("write our love story")                     │  │
│  │                                                              │  │
│  │  The scene graph IS the structured prompt.                   │  │
│  │  Slots with purpose labels (e.g., "primary-text",           │  │
│  │  "section-heading") tell the AI what kind of text            │  │
│  │  to generate for each position.                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  AI CAPABILITIES                                             │  │
│  │                                                              │  │
│  │  TEXT GENERATION                                             │  │
│  │  ├─ "Write our story" → fills story section slots            │  │
│  │  ├─ "Write RSVP copy" → fills RSVP heading + instructions   │  │
│  │  ├─ "Suggest section headings" → fills all heading slots     │  │
│  │  └─ "Translate to Spanish" → replaces all text content       │  │
│  │                                                              │  │
│  │  IMAGE ENHANCEMENT (future)                                  │  │
│  │  ├─ Background removal (for couple photos)                   │  │
│  │  ├─ Upscaling (enhance low-res uploads)                     │  │
│  │  ├─ Style transfer (match photo mood to theme)              │  │
│  │  └─ Crop suggestion (optimal focal point for slot aspect)   │  │
│  │                                                              │  │
│  │  LAYOUT SUGGESTION (future)                                  │  │
│  │  ├─ "Add more sections" → suggests section types + order     │  │
│  │  ├─ "Make it longer" → suggests content for empty slots      │  │
│  │  └─ "Gallery layout" → suggests grid config for image count  │  │
│  │                                                              │  │
│  │  THEME SUGGESTION (future)                                   │  │
│  │  ├─ "Match these colors" → generates theme from photo        │  │
│  │  ├─ "More elegant" → adjusts theme tokens                   │  │
│  │  └─ "Like this reference" → extracts tokens from image      │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  AI OUTPUT CONTRACT                                          │  │
│  │                                                              │  │
│  │  AI ALWAYS outputs a partial content layer update:           │  │
│  │                                                              │  │
│  │  {                                                           │  │
│  │    "contentPatches": [                                       │  │
│  │      {                                                       │  │
│  │        "slotId": "story-how-we-met-body",                   │  │
│  │        "field": "props.html",                               │  │
│  │        "value": "<p>It was a rainy Tuesday...</p>"          │  │
│  │      },                                                      │  │
│  │      {                                                       │  │
│  │        "slotId": "story-proposal-body",                     │  │
│  │        "field": "props.html",                               │  │
│  │        "value": "<p>Under the old oak tree...</p>"          │  │
│  │      }                                                       │  │
│  │    ],                                                        │  │
│  │    "dataPatches": [                                          │  │
│  │      {                                                       │  │
│  │        "path": "$.story.howWeMet.body",                     │  │
│  │        "value": "It was a rainy Tuesday..."                 │  │
│  │      }                                                       │  │
│  │    ]                                                         │  │
│  │  }                                                           │  │
│  │                                                              │  │
│  │  These patches are PREVIEWED in the editor before applying. │  │
│  │  User can accept all, accept per-slot, or reject.           │  │
│  │  AI never directly mutates the content layer.               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 AI Context Construction (How the Scene Graph Becomes a Prompt)

The scene graph's slot definitions provide structured context that dramatically improves AI output quality compared to a blank text box:

```
PROMPT CONSTRUCTION:

  System: You are writing content for a wedding invitation website.
          The template style is "elegant" with "serif" fonts and "floral" decorative elements.
          The couple's names are Sarah Chen and James Nakamura.
          Their wedding date is September 15, 2026 at Sunstone Winery.

  For each slot the AI needs to fill:

    Slot: hero-couple-names
    Purpose: primary-text (the most prominent text on the page)
    Constraints: max 60 characters, heading style
    Current value: "Sarah & James"
    → AI understands this is the headline, keeps it short and impactful

    Slot: story-how-we-met-body
    Purpose: narrative-text (storytelling content)
    Constraints: max 500 characters, body text style
    User input: "We met at a coffee shop in SF in 2019"
    → AI expands the user's brief input into polished prose

    Slot: rsvp-heading
    Purpose: section-heading (introduces the RSVP section)
    Constraints: max 40 characters, heading-2 style
    Current value: "" (empty)
    → AI generates something like "Join Us in Celebration"
```

### 9.3 AI Safety Constraints

```
AI OUTPUT RULES:
1. AI-generated text is sanitized through the same DOMPurify pipeline
   as all other content. No script injection possible.

2. AI cannot modify structure, theme, or behavior layers.
   It can only produce content patches.

3. All AI output is previewed in the editor before being applied.
   There is no "auto-apply" mode.

4. AI-generated content is flagged in the content layer:
   { "slotId": "...", "aiGenerated": true, "aiModel": "claude-3.5", "generatedAt": "..." }
   This enables future analytics on AI adoption and quality.

5. AI text generation respects the slot's maxCharacters constraint.
   The prompt includes the limit, and the output is truncated if exceeded.

6. AI image operations (future) go through the same media processing
   pipeline as user uploads — re-encoded, EXIF-stripped, virus-scanned.
```

### 9.4 Future AI Roadmap

```
PHASE 1 (Q2 post-launch): Text Generation
  - "Write our story" from bullet points
  - Section heading suggestions
  - RSVP instruction copy
  - Guestbook prompt suggestions
  - Multi-language translation of all text

PHASE 2 (Q3): Image Intelligence
  - Focal point detection (auto set focalPoint for hero images)
  - Background removal for photo cutouts
  - Image quality scoring ("this photo is low resolution, want to enhance?")
  - Color palette extraction from photos → theme suggestion

PHASE 3 (Q4): Layout Intelligence
  - "Make it more elegant" → adjusts theme tokens
  - "Add a timeline section" → suggests section structure from content data
  - Gallery auto-layout from image orientation/count
  - Smart content ordering based on wedding date proximity

PHASE 4 (2027): Generative
  - AI-generated decorative elements (custom floral borders from prompt)
  - AI-generated music selection (mood-matched to theme)
  - Full invitation draft from minimal input:
    "Sarah + James, Sept 15, Sunstone Winery, elegant style"
    → complete populated template ready for review
```

---

## Appendix: Template Engine Decision Log

| Decision | Chosen | Alternative | Why |
|----------|--------|-------------|-----|
| Four-layer separation | Structure / Theme / Content / Behavior as independent JSON documents | Single monolithic scene graph (v1 architecture) | Enables theme swapping, AI injection, A/B testing, and dedup without any of these features knowing about each other. Higher upfront complexity but exponential leverage for every feature built on top. |
| JSON Patch for variants | RFC 6902 JSON Patch | Full template copy per variant | Variants are typically 200 bytes vs 50KB for a full copy. Enables hundreds of A/B variants without storage cost. Patches compose — multiple variants can stack. |
| Copy-on-write for projects | Null overrides = shared template reference | Always copy template into project | 70% storage savings for unmodified templates. Simplifies "update available" flow since we know exactly which projects are using the canonical template structure. |
| Islands architecture for JS | Self-contained module per interactive element | Full SPA framework (React/Preact hydration) | Wedding sites are 95% static content. A React runtime adds 40KB+ for no benefit. Islands keep JS budget under 25KB for typical sites. Each island is independently loadable and cacheable. |
| Slot-based structure | Named slots with purpose labels and type constraints | Free-form element placement (v1 scene graph) | Slots enable template updates, AI understanding, accessibility improvements, and theme compatibility. Free-form is still available via `layoutMode: "free"` for custom sections. Slots are the "guided" experience; free-form is the "expert" escape hatch. |
| Theme as design tokens | Centralized token set compiled to CSS custom properties | Inline styles per element | Tokens enable instant theme switching, theme marketplace, and consistent design language. CSS custom properties mean the browser handles cascade + inheritance — no JS needed for theme application. |
| GSAP for animation | GSAP (ScrollTrigger + core) | CSS-only animations, Framer Motion, anime.js | GSAP is the industry standard for scroll-driven and sequenced animations. ScrollTrigger handles parallax, reveal, and scrub natively. License cost ($199/yr business) is trivial. CSS-only can't handle staggered sequences or scroll scrubbing. Framer Motion requires React runtime (violates islands architecture). |
| Component registry with multi-renderer | Each component defines editor + static + SSR + preview renderers | Single renderer with output conversion | The editor needs Konva canvas nodes. Published sites need optimized HTML strings. OG images need zero-JS HTML. These are fundamentally different output formats — a single renderer with post-processing would produce suboptimal output for every target. |

---

*End of Template Engine Design Document*
