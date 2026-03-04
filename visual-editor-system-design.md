# ELove Visual Editor — System Design

**Version:** 1.0
**Date:** March 3, 2026
**Scope:** The client-side editing system that allows users to visually modify wedding invitation templates within the constraints of the four-layer template engine.
**Prerequisites:** `architecture-saas-wedding-platform.md` (system context), `template-engine-deep-dive.md` (four-layer schema, slot system, component registry)

---

## Table of Contents

1. Editor Architecture
2. State Management Strategy
3. Block System Design
4. Validation Layer
5. Conflict Resolution Strategy
6. Autosave Design
7. Version Control Strategy
8. Security Concerns
9. Future Collaboration Mode Support

---

## 1. Editor Architecture

### 1.1 Architectural Principles

The editor's design follows one core axiom: **the editor manipulates the four-layer JSON document, never the rendered output directly.** The user sees a visual canvas, but every interaction (drag, type, click) produces a JSON operation against one of the four layers (structure, theme, content, behavior). The canvas is a projection of the JSON state — never the source of truth.

This is the Webflow/Framer pattern, not the Google Docs pattern. The distinction matters: Google Docs edits the DOM and derives data from it. We edit the data and derive the DOM from it. This guarantees that the editor output and the publish output are structurally identical, because they come from the same JSON through different renderers.

### 1.2 System Topology

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         EDITOR CLIENT                                     │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      SHELL (React)                                   │ │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │ │
│  │  │  Toolbar     │ │  Page Tree   │ │  Section     │ │  Property  │ │ │
│  │  │  (top bar)   │ │  (left)      │ │  Navigator   │ │  Panel     │ │ │
│  │  │              │ │              │ │  (left)      │ │  (right)   │ │ │
│  │  │  Undo/Redo   │ │  Page CRUD   │ │              │ │            │ │ │
│  │  │  Preview     │ │  Page Order  │ │  Section     │ │  Slot      │ │ │
│  │  │  Publish     │ │  Page Enable │ │  Reorder     │ │  Content   │ │ │
│  │  │  Device      │ │              │ │  Add/Remove  │ │  Style     │ │ │
│  │  │  Toggle      │ │              │ │  Expand      │ │  Animation │ │ │
│  │  └─────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │ │
│  │                                                                     │ │
│  │  ┌─────────────────────────────────────────────────────────────┐   │ │
│  │  │                     CANVAS VIEWPORT                          │   │ │
│  │  │                                                             │   │ │
│  │  │  ┌───────────────────────────────────────────────────────┐ │   │ │
│  │  │  │            RENDER SURFACE                              │ │   │ │
│  │  │  │                                                       │ │   │ │
│  │  │  │  Mode A: DOM Renderer (default)                       │ │   │ │
│  │  │  │  Live HTML/CSS rendering of sections                  │ │   │ │
│  │  │  │  with overlay interaction layer                       │ │   │ │
│  │  │  │                                                       │ │   │ │
│  │  │  │  Mode B: Canvas Renderer (free-layout sections)       │ │   │ │
│  │  │  │  Konva.js for absolute-positioned elements            │ │   │ │
│  │  │  │  with pixel-precise manipulation                      │ │   │ │
│  │  │  │                                                       │ │   │ │
│  │  │  └───────────────────────────────────────────────────────┘ │   │ │
│  │  │                                                             │   │ │
│  │  │  ┌───────────────────────────────────────────────────────┐ │   │ │
│  │  │  │            INTERACTION OVERLAY                         │ │   │ │
│  │  │  │                                                       │ │   │ │
│  │  │  │  Selection outlines · Drag handles · Drop zones       │ │   │ │
│  │  │  │  Resize grips · Snap guides · Spacing indicators      │ │   │ │
│  │  │  │  Section boundaries · Slot highlights                 │ │   │ │
│  │  │  │                                                       │ │   │ │
│  │  │  └───────────────────────────────────────────────────────┘ │   │ │
│  │  └─────────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      ENGINE LAYER                                    │ │
│  │                                                                     │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ │ │
│  │  │  Document   │ │  Command    │ │  Validation  │ │  Sync        │ │ │
│  │  │  Store      │ │  Processor  │ │  Engine      │ │  Manager     │ │ │
│  │  │             │ │             │ │              │ │              │ │ │
│  │  │  4-layer    │ │  Executes   │ │  Checks      │ │  Autosave    │ │ │
│  │  │  JSON state │ │  mutations  │ │  constraints │ │  Persistence │ │ │
│  │  │  Immutable  │ │  Undo/Redo  │ │  Slot rules  │ │  Conflict    │ │ │
│  │  │  snapshots  │ │  Batch ops  │ │  Quota       │ │  detection   │ │ │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬───────┘ │ │
│  │         │               │               │               │         │ │
│  │         └───────────────┴───────────────┴───────────────┘         │ │
│  │                              │                                     │ │
│  │                    ┌─────────▼─────────┐                          │ │
│  │                    │  Event Bus         │                          │ │
│  │                    │  (typed events)    │                          │ │
│  │                    └───────────────────┘                          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
          │                                           │
          ▼                                           ▼
┌───────────────────┐                     ┌───────────────────────┐
│  API Server        │                     │  Media Service         │
│                    │                     │                        │
│  PATCH /sections   │                     │  POST /media/upload    │
│  PATCH /content    │                     │  (presigned URL)       │
│  GET /project      │                     │  POST /media/confirm   │
│  POST /publish     │                     │                        │
└───────────────────┘                     └───────────────────────┘
```

### 1.3 Dual Renderer Strategy

The editor uses two rendering modes depending on the section's `layoutMode`. This is a critical architectural decision.

```
SECTION layoutMode    →  RENDERER        →  RATIONALE
──────────────────────────────────────────────────────────────────
"stack"               →  DOM Renderer     →  CSS flexbox handles layout natively.
                                             Text editing uses contentEditable.
                                             Reflows on resize are correct by default.
                                             No coordinate math needed.

"grid"                →  DOM Renderer     →  CSS grid handles layout natively.
                                             Same benefits as stack.

"free"                →  Canvas Renderer  →  Absolute positioning requires pixel-
                         (Konva.js)          precise control. Drag/drop needs
                                             coordinate math. Snap guides need
                                             spatial queries. Canvas handles this
                                             natively. DOM absolute positioning
                                             fights the browser's layout engine.
```

**DOM Renderer** (for stack/grid sections): Renders actual HTML/CSS matching the published output. Wraps each slot in an interaction proxy `<div>` that provides selection, drag handles, and click interception. Text editing uses a controlled `contentEditable` overlay that captures keystrokes and produces text commands, never raw DOM mutations.

**Canvas Renderer** (for free-layout sections): Renders via Konva.js on an HTML5 Canvas. Each element is a Konva node with transform handles. Mouse/touch events map directly to position/size commands. Text editing switches to an HTML overlay positioned over the canvas element, with the Konva node hidden during edit.

Both renderers read from the same Document Store and produce commands through the same Command Processor. The canvas is never the source of truth.

### 1.4 Viewport Abstraction

```
┌─────────────────────────────────────────────────┐
│  EDITOR VIEWPORT                                 │
│                                                  │
│  viewport.mode:                                  │
│    "desktop"  → width: 1440px, scale: fit-width │
│    "tablet"   → width: 768px,  scale: fit-width │
│    "mobile"   → width: 375px,  scale: fit-width │
│                                                  │
│  viewport.zoom: 0.25 – 2.0 (pinch or slider)   │
│                                                  │
│  viewport.scroll: vertical offset in document   │
│                                                  │
│  The viewport wraps the render surface in a      │
│  CSS transform: scale(zoom) container.           │
│  All interaction coordinates are transformed     │
│  from screen-space to document-space before      │
│  being sent to the Command Processor.            │
│                                                  │
│  Mobile preview does NOT just scale down.        │
│  It re-resolves the document with mobile         │
│  responsive overrides applied:                   │
│  - Structure layer: responsiveOverrides.mobile   │
│  - Theme layer: typography.responsiveScale       │
│  - Theme layer: spacing.responsiveOverrides      │
│  - Behavior layer: slot.hidden on mobile         │
│                                                  │
│  This means mobile preview shows the ACTUAL      │
│  mobile experience, not a scaled desktop.        │
└─────────────────────────────────────────────────┘
```

---

## 2. State Management Strategy

### 2.1 The Document Store

The Document Store is the single source of truth for the entire editor. It holds the four-layer JSON document plus transient editor state. It is designed as an **immutable snapshot store** with structural sharing.

```
┌─────────────────────────────────────────────────────────────────────┐
│                       DOCUMENT STORE                                 │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  PERSISTENT STATE (synced to server)                          │ │
│  │                                                               │ │
│  │  document: {                                                  │ │
│  │    structure:  Layer1 | null     // null = using template     │ │
│  │    theme:      Layer2            // resolved theme + overrides│ │
│  │    content:    Layer3            // user data + slot content  │ │
│  │    behavior:   Layer4 | null     // null = using template     │ │
│  │  }                                                            │ │
│  │                                                               │ │
│  │  meta: {                                                      │ │
│  │    projectId:          string                                 │ │
│  │    templateVersionId:  string                                 │ │
│  │    schemaVersion:      number                                 │ │
│  │    lastSavedAt:        timestamp                              │ │
│  │    lastSavedHash:      string    // SHA-256 of document       │ │
│  │    serverVersion:      number    // optimistic lock counter   │ │
│  │  }                                                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  TRANSIENT STATE (client-only, never persisted)               │ │
│  │                                                               │ │
│  │  editor: {                                                    │ │
│  │    selectedPageId:     string | null                          │ │
│  │    selectedSectionId:  string | null                          │ │
│  │    selectedSlotId:     string | null                          │ │
│  │    hoveredSlotId:      string | null                          │ │
│  │    viewportMode:       "desktop" | "tablet" | "mobile"        │ │
│  │    viewportZoom:       number                                 │ │
│  │    viewportScroll:     number                                 │ │
│  │    panelStates:        { left: open|closed, right: open|... } │ │
│  │    dragState:          DragContext | null                      │ │
│  │    textEditState:      TextEditContext | null                  │ │
│  │    clipboardSlot:      SlotContent | null                     │ │
│  │  }                                                            │ │
│  │                                                               │ │
│  │  sync: {                                                      │ │
│  │    status:             "idle" | "saving" | "error" | "conflict"│ │
│  │    pendingCommands:    Command[]  // not yet persisted         │ │
│  │    lastSyncAt:         timestamp                              │ │
│  │    retryCount:         number                                 │ │
│  │  }                                                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  HISTORY (undo/redo)                                          │ │
│  │                                                               │ │
│  │  undoStack:   DocumentSnapshot[]    // max 100 entries        │ │
│  │  redoStack:   DocumentSnapshot[]    // cleared on new command │ │
│  │                                                               │ │
│  │  Each snapshot stores a STRUCTURAL SHARE of the document.     │ │
│  │  Only the changed layer subtree is copied; unchanged layers   │ │
│  │  share references with the previous snapshot.                 │ │
│  │                                                               │ │
│  │  Memory budget: ~50MB for 100 undo steps.                    │ │
│  │  At 500KB average document, structural sharing reduces this   │ │
│  │  to ~5-10MB actual (since most undos change a single slot).  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Immutability Model

Every state transition produces a new immutable snapshot. This enables three critical capabilities simultaneously:

1. **Undo/Redo** — Previous snapshots are retained on the undo stack. Undo pops the stack and restores the previous snapshot. No reverse-computation needed.

2. **Dirty detection** — Compare `document` hash against `lastSavedHash`. If different, there are unsaved changes. Structural sharing means comparison is O(1) for unchanged layers.

3. **Render optimization** — React components receive the immutable snapshot. Because layers are structurally shared, `Object.is()` equality on unchanged layers skips re-rendering of unaffected panels. The property panel only re-renders when the selected slot's data changes, not when an unrelated section changes.

```
State Transition Flow:

  User drags section "gallery" above "countdown"
        │
        ▼
  Interaction Layer captures drop event
        │
        ▼
  Produces Command:
  {
    type: "REORDER_SECTION",
    pageId: "home",
    sectionId: "gallery",
    targetIndex: 1              // move to position 1 (before countdown at 2)
  }
        │
        ▼
  Command Processor:
  1. Validate command (is this section moveable? is target valid?)
  2. Push current document to undoStack
  3. Clear redoStack
  4. Produce new document snapshot:
     - Clone structure layer (shallow copy pages array)
     - Splice section to new position
     - All other layers unchanged (same reference)
  5. Set new document as current state
  6. Emit "document:changed" event
  7. Queue for autosave
        │
        ▼
  Render Surface re-renders
  (only sections affected by reorder re-render,
   thanks to structural sharing)
```

### 2.3 Command Catalog

Every user action maps to exactly one Command type. Commands are the audit log, the undo unit, and the sync payload.

```
LAYER        COMMAND TYPE                  PAYLOAD
───────────────────────────────────────────────────────────────────────

STRUCTURE    REORDER_SECTION              { pageId, sectionId, targetIndex }
             ADD_SECTION                  { pageId, afterSectionId, sectionType, templateDefaults }
             REMOVE_SECTION              { pageId, sectionId }
             ADD_PAGE                     { pageSlug, title, templateDefaults }
             REMOVE_PAGE                  { pageId }
             REORDER_PAGE                 { pageId, targetIndex }
             TOGGLE_PAGE                  { pageId, enabled: boolean }
             UPDATE_LAYOUT_CONFIG         { sectionId, patch: Partial<LayoutConfig> }
             ADD_SLOT                     { sectionId, afterSlotId, slotDefinition }
             REMOVE_SLOT                  { sectionId, slotId }
             REORDER_SLOT                 { sectionId, slotId, targetIndex }

THEME        UPDATE_TOKEN                 { tokenPath, value }
             SWITCH_THEME                 { themeId }
             RESET_TOKEN                  { tokenPath }  // back to theme default

CONTENT      UPDATE_SLOT_CONTENT          { slotId, patch: Partial<SlotContent> }
             UPDATE_TEXT                   { slotId, html: string }
             UPDATE_IMAGE                  { slotId, mediaId, focalPoint? }
             UPDATE_DATA                   { dataPath, value }
             BULK_UPDATE_CONTENT           { patches: SlotContentPatch[] }

BEHAVIOR     UPDATE_SLOT_ANIMATION        { sectionId, slotId, animationType, config }
             UPDATE_SECTION_ENTRANCE       { sectionId, entranceConfig }
             UPDATE_PAGE_TRANSITION        { transitionConfig }
             UPDATE_GLOBAL_BEHAVIOR        { behaviorKey, value }

META         UPDATE_SEO                   { field, value }
             UPDATE_SETTINGS              { settingKey, value }
             UPDATE_MUSIC                  { trackMediaId?, autoplay?, volume? }

COMPOSITE    APPLY_TEMPLATE_UPDATE        { newVersion, mergeStrategy }
             APPLY_AI_CONTENT             { contentPatches[] }
             DUPLICATE_SECTION            { pageId, sectionId }
             SWAP_SLOT_TYPE               { slotId, newElementType, defaultProps }
```

### 2.4 Command Properties

Every command carries metadata beyond its payload:

```
Command {
  id:           string          // nanoid, unique per command
  type:         CommandType     // from catalog above
  targetLayer:  Layer           // structure | theme | content | behavior | meta
  payload:      object          // type-specific data
  timestamp:    number          // Date.now()
  source:       "user" | "ai" | "system" | "collaboration"
  batchId:      string | null   // groups related commands for undo-as-one
  undoable:     boolean         // false for meta commands like SELECT

  // Populated by Command Processor:
  previousValue: object | null  // for precise undo (not snapshot-based)
  validationResult: ValidationResult
}
```

**Batch commands:** Some user actions produce multiple commands that should undo as one unit. Example: "Duplicate section" creates ADD_SECTION + N × UPDATE_SLOT_CONTENT. These share a `batchId`. Undo pops all commands in the batch atomically.

---

## 3. Block System Design

The block system defines how sections, slots, and elements compose to form the editable document. It bridges the template engine's four-layer schema with the editor's interactive capabilities.

### 3.1 Block Hierarchy

```
PROJECT
  │
  ├── PAGE BLOCK (page)
  │     │
  │     ├── SECTION BLOCK (section)
  │     │     │
  │     │     ├── SLOT BLOCK (slot)
  │     │     │     │
  │     │     │     └── ELEMENT (leaf node: text, image, countdown, etc.)
  │     │     │
  │     │     ├── SLOT BLOCK
  │     │     │     └── ELEMENT
  │     │     │
  │     │     └── SLOT BLOCK
  │     │           └── ELEMENT
  │     │
  │     ├── SECTION BLOCK
  │     │     └── ... slots ...
  │     │
  │     └── [CUSTOM SECTION BLOCK]     // user-added, outside template structure
  │           └── ... free-form slots ...
  │
  ├── GLOBAL: NAVIGATION BLOCK
  │     └── SLOT: nav-logo, nav-links
  │
  ├── GLOBAL: MUSIC PLAYER BLOCK
  │     └── SLOT: music-track
  │
  └── GLOBAL: FOOTER BLOCK
        └── SLOT: footer-branding
```

### 3.2 Block Capabilities Matrix

Each block level has explicit capabilities that the editor enforces. This matrix is the contract between the template author and the editor.

```
CAPABILITY              PAGE    SECTION    SLOT      ELEMENT
──────────────────────────────────────────────────────────────
Can reorder             ✓       ✓          Limited*  ✗
Can add                 ✓       ✓          Limited*  ✗
Can remove              If !req  If !req   If !req   ✗
Can duplicate           ✓       ✓          ✗         ✗
Can rename              ✓       ✗          ✗         ✗
Can enable/disable      ✓       ✗          ✗         ✗
Can edit content        ✗       ✗          ✗         ✓
Can edit style          ✗       ✓ layout   ✗         ✓ (theme-bound)
Can edit animation      ✗       ✓          ✗         ✓ (via behavior)
Can change type         ✗       ✗          Limited** ✗
Can drag-drop           ✗       ✓ (reorder)✗         ✓ (in free layout)
Can resize              ✗       ✗          ✗         ✓ (in free layout)
Can rotate              ✗       ✗          ✗         ✓ (in free layout)

*  "Limited" = only in custom sections or where template allows
** "Limited" = only within slot's "accepts" list
```

### 3.3 Section Block Types

```
SECTION TYPE      LAYOUT    FIXED SLOTS?    USER CAN ADD SLOTS?    DESCRIPTION
──────────────────────────────────────────────────────────────────────────────
hero              stack     Yes             No (guided)            Full-screen hero with
                                                                   background + text overlay

countdown         stack     Yes             No                     Countdown timer + heading

story             stack     Partial         Yes (story entries)    Timeline of story entries
                                                                   each with title + body + image

gallery           grid      No              Yes (images)           Image grid with lightbox

rsvp              stack     Yes             Limited (custom fields) RSVP form with configurable
                                                                   questions

guestbook         stack     Yes             No                     Message wall with moderation

schedule          stack     Partial         Yes (events)           Multi-event timeline

map               stack     Yes             No                     Venue map + details

footer            stack     Yes             No                     Copyright + links

custom            free      No              Yes (any element)      User's free-form section
                  or stack                                         (escape hatch from templates)
```

### 3.4 Section Insertion Rules

When a user wants to add a section, the editor presents a section picker. The available sections are determined by:

```
SECTION INSERTION LOGIC:

  1. Load available section types from component registry
  2. Filter by plan tier:
     - Free: hero, countdown, story, gallery, rsvp, footer (max 6 sections)
     - Starter: all standard types (max 12 sections)
     - Pro: all types + custom (max 30 sections)
     - Business: unlimited
  3. Filter by template compatibility:
     - Template declares supportedFeatures (e.g., ["rsvp", "guestbook", "countdown"])
     - Only sections matching supportedFeatures appear in picker
     - "custom" type is always available for Pro+
  4. Filter by uniqueness constraints:
     - hero: max 1 per page
     - rsvp: max 1 per project
     - guestbook: max 1 per project
     - footer: max 1 per page
     - All others: no limit
  5. Present filtered list with template-provided thumbnails
  6. On selection: INSERT command with template defaults for that section type
     - Defaults come from template_version.pages_data section definitions
     - If section type has no template default (e.g., "custom"), use system defaults
```

### 3.5 Slot Binding Model

Slots bridge structure and content. The editor must understand three slot content modes:

```
MODE 1: DATA-BOUND SLOT
  Slot has contentBinding: "$.couple.displayNames"

  Editor behavior:
  - Text is auto-populated from content.data
  - User can EDIT the bound value (edits flow back to data layer)
  - If user clears the field, fallback to binding default
  - Property panel shows "Connected to: Couple Names" indicator
  - Changing couple name in data form updates this slot everywhere

MODE 2: DIRECT-CONTENT SLOT
  Slot has no contentBinding, content stored in slotContent[slotId]

  Editor behavior:
  - User edits content freely
  - Content stored directly in content layer slotContent
  - No data binding indicator
  - This is the most common mode for decorative elements

MODE 3: SYSTEM-MANAGED SLOT
  Slot has systemManaged: true

  Editor behavior:
  - Slot is visible but NOT editable by user
  - Content is controlled by the platform (e.g., "Made with ELove" badge)
  - Property panel shows "Managed by ELove" with plan upgrade prompt
  - On paid plan: badge can be hidden (remove_branding feature flag)
```

---

## 4. Validation Layer

The validation layer prevents the user from producing an invalid document. It operates at three levels: command-time (before execution), continuous (background checks), and publish-gate (before build).

### 4.1 Validation Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      VALIDATION ENGINE                                   │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  LEVEL 1: COMMAND VALIDATION (synchronous, pre-execution)         │ │
│  │                                                                   │ │
│  │  Runs BEFORE every command is applied to the document.            │ │
│  │  If validation fails, the command is REJECTED and the             │ │
│  │  document is not modified. User sees inline error feedback.       │ │
│  │                                                                   │ │
│  │  Validators:                                                      │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  SLOT TYPE VALIDATOR                                        │ │ │
│  │  │  When: SWAP_SLOT_TYPE, ADD_SLOT                             │ │ │
│  │  │  Check: new element type ∈ slot.accepts[]                   │ │ │
│  │  │  Fail: "This slot only accepts: image, video, gradient"     │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  REQUIRED SLOT VALIDATOR                                    │ │ │
│  │  │  When: REMOVE_SLOT, REMOVE_SECTION                          │ │ │
│  │  │  Check: slot.required === false, section is not required     │ │ │
│  │  │  Fail: "This element is required by the template"           │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  QUOTA VALIDATOR                                            │ │ │
│  │  │  When: ADD_SECTION, ADD_PAGE, ADD_SLOT, UPDATE_IMAGE        │ │ │
│  │  │  Check: operation within plan limits (section count,         │ │ │
│  │  │         page count, media storage)                           │ │ │
│  │  │  Fail: "Upgrade to Pro for more sections" (with CTA)        │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  TEXT CONSTRAINT VALIDATOR                                  │ │ │
│  │  │  When: UPDATE_TEXT                                          │ │ │
│  │  │  Check: text.length ≤ slot.constraints.maxCharacters        │ │ │
│  │  │  Behavior: soft limit — allow typing but show counter       │ │ │
│  │  │            turning red. Block only at 2x limit.             │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  UNIQUENESS VALIDATOR                                       │ │ │
│  │  │  When: ADD_SECTION                                          │ │ │
│  │  │  Check: not exceeding section type limits (1 hero, 1 rsvp)  │ │ │
│  │  │  Fail: "Only one RSVP section allowed per project"          │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  STRUCTURE INTEGRITY VALIDATOR                              │ │ │
│  │  │  When: REMOVE_PAGE, REORDER_PAGE                            │ │ │
│  │  │  Check: page.isRequired === false for removal               │ │ │
│  │  │         at least one page remains after removal              │ │ │
│  │  │         navigation links remain valid after reorder          │ │ │
│  │  │  Fail: "The Home page cannot be removed"                    │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  MEDIA VALIDATOR                                            │ │ │
│  │  │  When: UPDATE_IMAGE                                         │ │ │
│  │  │  Check: media exists, media type compatible with slot,       │ │ │
│  │  │         media dimensions meet minimum for slot purpose       │ │ │
│  │  │  Warn: "Image is 200×200 but this slot displays at 1920px.  │ │ │
│  │  │         Consider using a higher resolution image."           │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  LEVEL 2: CONTINUOUS VALIDATION (async, background)               │ │
│  │                                                                   │ │
│  │  Runs in a debounced background task (500ms after last command).  │ │
│  │  Produces warnings, not blocking errors. Results shown in a       │ │
│  │  "Health" panel accessible from the toolbar.                      │ │
│  │                                                                   │ │
│  │  Checks:                                                          │ │
│  │  ├── Empty required slots (content bound but data field blank)    │ │
│  │  ├── Broken media references (media deleted but still referenced) │ │
│  │  ├── Accessibility: text contrast against background              │ │
│  │  ├── Accessibility: image alt text missing                        │ │
│  │  ├── Performance estimate: total media weight projection          │ │
│  │  ├── SEO: og:title and og:image present                          │ │
│  │  ├── Mobile issues: text overflow, element overlap (heuristic)    │ │
│  │  └── RSVP deadline in the past                                    │ │
│  │                                                                   │ │
│  │  Output: HealthReport {                                           │ │
│  │    errors:   Issue[]    // must fix before publish                 │ │
│  │    warnings: Issue[]    // recommended fixes                      │ │
│  │    info:     Issue[]    // informational                          │ │
│  │  }                                                                │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  LEVEL 3: PUBLISH GATE (server-side, blocking)                    │ │
│  │                                                                   │ │
│  │  Runs on the server when user clicks "Publish."                   │ │
│  │  This is the final safety net. Even if client validation was      │ │
│  │  bypassed (tampered client, race condition), the server catches   │ │
│  │  invalid states.                                                  │ │
│  │                                                                   │ │
│  │  Server-side checks:                                              │ │
│  │  ├── Subscription active (not past_due, not canceled)             │ │
│  │  ├── All required slots populated                                 │ │
│  │  ├── All media references resolve to existing media records       │ │
│  │  ├── Slot content matches slot.accepts constraints                │ │
│  │  ├── Section count within plan limits                             │ │
│  │  ├── Page count within plan limits                                │ │
│  │  ├── Total media size within plan limits                          │ │
│  │  ├── Text content HTML sanitized (re-sanitize on server)          │ │
│  │  ├── No self-referencing navigation links                         │ │
│  │  └── Scene graph schema version compatible with render engine     │ │
│  │                                                                   │ │
│  │  If any check fails: return 422 with specific error details.      │ │
│  │  Client displays the publish error modal with actionable fixes.   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Layout Break Prevention

The most critical validation concern: preventing users from creating layouts that look broken on their screen or (worse) on their guests' devices.

```
LAYOUT BREAK PREVENTION STRATEGIES:

1. CONSTRAINED EDITING (primary defense)
   Template slots have constraints (minHeight, maxWidth, textRole, position type).
   The editor enforces these constraints through the interaction layer:
   - Text slots with textRole cannot have arbitrary font sizes (bound to theme scale)
   - Flow-positioned slots cannot be dragged to absolute positions
   - Section minHeight prevents collapsing to zero
   - Section maxWidth prevents overflow

2. OVERFLOW DETECTION (background check)
   After each command, a lightweight layout simulation checks:
   - Text overflow: does the text content exceed the slot's rendered box?
     → Warn: "Text may be cut off on smaller screens"
   - Image overflow: does the image aspect ratio cause visible clipping?
     → Auto-suggest focalPoint adjustment
   - Section overflow: do stacked children exceed section height?
     → Auto-expand section (stack layout) or warn (fixed-height)

3. MOBILE BREAKPOINT VERIFICATION (on viewport toggle)
   When user switches to mobile preview:
   - Re-resolve document with mobile overrides
   - Run overlap detection (are any absolute-positioned elements overlapping?)
   - Check text readability (font size ≥ 14px on mobile)
   - Verify touch targets ≥ 44px for interactive elements
   - Show warnings overlay on canvas for issues found

4. SNAP SYSTEM (for free-layout sections)
   When dragging elements in free-layout:
   - Snap to section boundaries (can't drag outside section bounds)
   - Snap to other elements (alignment guides)
   - Snap to grid (8px unit from theme.spacing.unit)
   - Snap to center lines (horizontal + vertical center of section)
   Element position is clamped to section bounds on drag-end,
   preventing off-screen elements.

5. RESPONSIVE GUARD RAILS
   When editing in desktop mode:
   - If element's mobile override doesn't exist, warn that the element
     will be auto-positioned on mobile (centered, stacked)
   - If element is wider than 375px (mobile viewport), suggest a
     mobile-specific width
   These are warnings, not blocks — the user maintains control.
```

---

## 5. Conflict Resolution Strategy

### 5.1 Conflict Scenarios

```
SCENARIO                          LIKELIHOOD    SEVERITY
─────────────────────────────────────────────────────────────────
Same user, two browser tabs       Medium        Low
User edits while autosave fails   Medium        Medium
User edits while server updates   Low           Medium
  (e.g., Stripe webhook changes
   subscription, affecting quotas)
Two users editing same project    Low (no       High
  (future collaboration)          collab yet)
Stale cache serves old document   Low           Low
```

### 5.2 Optimistic Concurrency Control

The primary conflict resolution mechanism is **version-vector optimistic locking**.

```
CONFLICT DETECTION FLOW:

  Client loads document:
    GET /projects/:id
    → Response includes: serverVersion: 42

  Client stores: meta.serverVersion = 42

  Client edits locally (commands modify document, serverVersion unchanged)

  Autosave triggers:
    PATCH /projects/:id
    Body: { document, expectedVersion: 42 }

    Server checks: current version == 42?

    CASE A: YES (no conflict)
      → Server applies patch
      → Increments version to 43
      → Returns: { serverVersion: 43 }
      → Client updates: meta.serverVersion = 43

    CASE B: NO (conflict — version is now 44)
      → Server returns: 409 Conflict
      → Body: { currentVersion: 44, currentDocument: {...} }
      → Client enters CONFLICT RESOLUTION mode
```

### 5.3 Conflict Resolution Modes

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONFLICT RESOLUTION                               │
│                                                                     │
│  On receiving 409 Conflict:                                         │
│                                                                     │
│  1. DETERMINE CONFLICT SCOPE                                        │
│     Compare local document layers against server document layers:   │
│     - Which layers have local changes?                              │
│     - Which layers have server changes?                             │
│     - Do any layers have BOTH local AND server changes?             │
│                                                                     │
│  2. AUTO-MERGE (if possible)                                        │
│     If local and server changes are in DIFFERENT layers:            │
│     - Local changed content layer, server changed nothing           │
│       → Just retry with new serverVersion (fast path)               │
│     - Local changed content, server changed theme                   │
│       → Merge: apply local content on top of server theme           │
│       → No user intervention needed                                 │
│     - Local changed structure, server changed content               │
│       → Merge: apply server content on top of local structure       │
│       → Flag for user review (structure changes may invalidate      │
│         server content)                                             │
│                                                                     │
│  3. MANUAL RESOLVE (if auto-merge impossible)                       │
│     If same layer modified on both sides:                           │
│     - Show diff dialog:                                             │
│       "Your changes conflict with changes from another session"     │
│     - Options:                                                      │
│       [Keep mine] → Force-push local version (server version lost)  │
│       [Keep server] → Discard local changes, reload from server     │
│       [Review] → Side-by-side diff showing changed slots            │
│                                                                     │
│  4. EDGE CASE: Server-initiated changes                             │
│     If conflict is from a system event (webhook, quota change):     │
│     - The server change is always authoritative for meta/billing    │
│     - Merge strategy: apply server meta + local document            │
│     - If quota reduced below current usage: show warning,           │
│       don't auto-delete sections                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.4 Two-Tab Protection

```
SAME-USER, TWO-TABS SCENARIO:

  Prevention (preferred):
  - On editor load, acquire a LOCK via API:
    POST /projects/:id/lock
    → Returns: { lockId, expiresAt }  (5-minute rolling lease)
  - If lock is held by another session:
    → Show: "This project is open in another window.
             Open in read-only mode or take over editing?"
    [Read-only] → Load editor with all mutations disabled
    [Take over] → Force-acquire lock (previous tab gets notified via WebSocket)
  - Lock is refreshed every 2 minutes via heartbeat
  - Lock is released on tab close (beforeunload) or timeout

  Detection (fallback):
  - If two tabs bypass lock (browser doesn't fire beforeunload):
    → Optimistic versioning catches the conflict on save
    → Resolution per §5.3

  Cross-tab communication:
  - BroadcastChannel API used to detect same-project-open-in-another-tab
  - If detected, immediately show the lock dialog
  - No server round-trip needed for same-browser detection
```

---

## 6. Autosave Design

### 6.1 Autosave Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AUTOSAVE PIPELINE                             │
│                                                                     │
│  Command executed                                                   │
│        │                                                            │
│        ▼                                                            │
│  ┌──────────────┐                                                   │
│  │  DIRTY FLAG   │  Set sync.status = "dirty"                       │
│  │  (immediate)  │  Add command to sync.pendingCommands              │
│  └──────┬───────┘                                                   │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────┐                                                   │
│  │  DEBOUNCE     │  Wait 2 seconds of inactivity                    │
│  │  TIMER        │  (reset on each new command)                      │
│  │               │                                                   │
│  │  Exception:   │  If user is typing (textEditState active),       │
│  │               │  extend debounce to 5 seconds to avoid           │
│  │               │  saving mid-sentence.                             │
│  │               │                                                   │
│  │  Force save:  │  After 30 seconds regardless of activity          │
│  │               │  (prevents data loss on long editing sessions)    │
│  └──────┬───────┘                                                   │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────┐                                                   │
│  │  DIFF COMPUTE │  Compare current document hash against            │
│  │               │  meta.lastSavedHash.                              │
│  │               │  If identical → skip save (no actual changes)     │
│  │               │  If different → proceed                          │
│  └──────┬───────┘                                                   │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────┐                                                   │
│  │  PAYLOAD      │  Compute delta between lastSaved and current:    │
│  │  PREPARE      │                                                   │
│  │               │  Strategy: LAYER-LEVEL DELTA                     │
│  │               │  For each layer (structure, theme, content,       │
│  │               │  behavior):                                       │
│  │               │    if layer reference === lastSaved reference    │
│  │               │      → skip (unchanged, structural sharing)      │
│  │               │    else                                          │
│  │               │      → include full layer in payload             │
│  │               │                                                   │
│  │               │  Typical save: only content layer changed        │
│  │               │  → payload is ~2-10KB (just slotContent changes) │
│  │               │  Rare save: structure changed                    │
│  │               │  → payload is ~50-100KB (full structure layer)   │
│  └──────┬───────┘                                                   │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────┐                                                   │
│  │  NETWORK      │  PATCH /projects/:id                             │
│  │  SEND         │  Body: { layers: changedLayers,                  │
│  │               │          expectedVersion: meta.serverVersion,    │
│  │               │          commandIds: pendingCommandIds }         │
│  │               │                                                   │
│  │  Set sync.status = "saving"                                      │
│  └──────┬───────┘                                                   │
│         │                                                            │
│    ┌────┴────┐                                                      │
│    ▼         ▼                                                      │
│  SUCCESS   FAILURE                                                  │
│    │         │                                                      │
│    ▼         ▼                                                      │
│  ┌─────┐  ┌──────────────┐                                         │
│  │ OK  │  │  RETRY LOGIC  │                                         │
│  │     │  │               │                                         │
│  │ Set │  │  Network err: │                                         │
│  │ last│  │  retry 3x     │                                         │
│  │ Save│  │  with backoff │                                         │
│  │ Hash│  │  (1s, 3s, 9s) │                                         │
│  │     │  │               │                                         │
│  │ Set │  │  409 Conflict:│                                         │
│  │ ver │  │  enter        │                                         │
│  │ +1  │  │  conflict     │                                         │
│  │     │  │  resolution   │                                         │
│  │ Set │  │  (§5.3)       │                                         │
│  │ idle│  │               │                                         │
│  │     │  │  422 Invalid: │                                         │
│  │ Clear  │  show error,  │                                         │
│  │ pend│  │  don't retry  │                                         │
│  │ ing │  │  (data issue) │                                         │
│  │     │  │               │                                         │
│  │     │  │  After 3      │                                         │
│  │     │  │  failures:    │                                         │
│  │     │  │  status=error │                                         │
│  │     │  │  show banner  │                                         │
│  │     │  │  "Saving      │                                         │
│  │     │  │  failed.      │                                         │
│  │     │  │  Changes are  │                                         │
│  │     │  │  preserved    │                                         │
│  │     │  │  locally."    │                                         │
│  └─────┘  └──────────────┘                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Offline Resilience

```
OFFLINE HANDLING:

  1. IndexedDB backup:
     After each command, write the full document to IndexedDB.
     Key: "project:{projectId}:draft"
     This is the disaster-recovery layer.

  2. On editor load:
     Check IndexedDB for a draft newer than the server version.
     If found:
       → Compare against server document
       → If different: "You have unsaved changes from a previous session. Restore?"
       → [Restore] → Load IndexedDB draft, mark all as pending sync
       → [Discard] → Delete IndexedDB draft, load server version

  3. During editing, if network goes offline:
     → sync.status = "offline"
     → Commands continue to accumulate in pendingCommands
     → IndexedDB continues to be updated
     → Show "Offline — changes saved locally" indicator

  4. When network returns:
     → Attempt autosave with accumulated delta
     → If conflict → conflict resolution (§5.3)
     → If success → clear pending, status = "idle"
```

### 6.3 Save Indicators

```
sync.status        INDICATOR                          BEHAVIOR
──────────────────────────────────────────────────────────────────
"idle"             Subtle checkmark: "All changes     Steady state.
                   saved"                             No action.

"dirty"            No indicator change yet            Debounce timer running.
                   (within debounce window)

"saving"           Subtle spinner: "Saving..."        Network request in flight.

"error"            Warning icon: "Save failed.        Link to retry.
                   Your work is preserved locally."   Changes in IndexedDB.

"conflict"         Alert banner: "Conflict detected.  Blocks further editing
                   Another session modified this      until resolved.
                   project."

"offline"          Info icon: "Offline. Changes       Resumes auto when
                   saved locally."                    network returns.
```

---

## 7. Version Control Strategy

### 7.1 Version Model

The editor has three distinct version concepts. Conflating them is a common design error.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     THREE VERSION SCOPES                             │
│                                                                     │
│  1. EDIT VERSION (serverVersion counter)                            │
│     ─────────────────────────────────────                           │
│     Scope: Per-project, increments on every autosave               │
│     Stored: projects.updated_at + optimistic lock counter          │
│     Purpose: Conflict detection between concurrent sessions         │
│     Retention: Only latest version matters; counter never resets    │
│     User-visible: NO (internal mechanism)                          │
│                                                                     │
│  2. SAVE POINT (manual snapshot)                                    │
│     ─────────────────────────────                                   │
│     Scope: Per-project, created on explicit user action             │
│     Stored: project_savepoints table (full document snapshot)       │
│     Purpose: "Restore to this point" capability                     │
│     Retention: Max 20 per project, oldest auto-pruned              │
│     User-visible: YES — "Version History" panel in editor          │
│                                                                     │
│     Created automatically when:                                     │
│     - User clicks "Publish" (pre-publish savepoint)                │
│     - Template update applied                                       │
│     - AI content injected                                           │
│     - Bulk operation (more than 5 commands in single batch)        │
│                                                                     │
│     Created manually when:                                          │
│     - User clicks "Save Version" in toolbar                        │
│     - User names the savepoint (e.g., "Before changing colors")    │
│                                                                     │
│  3. PUBLISHED VERSION (immutable build artifact)                    │
│     ─────────────────────────────────────────                       │
│     Scope: Per-project, created on publish                          │
│     Stored: published_versions table + R2 static files              │
│     Purpose: The live site; rollback target                         │
│     Retention: Last 10 published versions                           │
│     User-visible: YES — "Publish History" in dashboard              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Save Point Data Model

```
TABLE: project_savepoints
─────────────────────────────────────────────
  id:               UUID
  project_id:       UUID (FK → projects)
  version_label:    TEXT (user-provided or auto: "Auto-save before publish")
  document_snapshot: JSONB (full 4-layer document, frozen)
  created_by:       UUID (FK → users)
  trigger:          TEXT (manual | pre_publish | template_update | ai_inject | bulk_op)
  created_at:       TIMESTAMPTZ
  size_bytes:       INTEGER (for quota tracking)
```

### 7.3 Restore Flow

```
User clicks "Restore" on a savepoint:

  1. Create a savepoint of the CURRENT state (so restoration is undoable)
     → label: "Auto-save before restore to '{target_label}'"
  2. Load target savepoint's document_snapshot
  3. Replace current document in store
  4. Clear undo/redo stacks (restoration is a clean slate)
  5. Trigger full re-render of canvas
  6. Trigger autosave (persist restored document to server)
  7. Show confirmation: "Restored to '{target_label}'"
```

### 7.4 Published Version Rollback

```
User clicks "Rollback" to previous published version:

  1. This does NOT modify the editor document.
  2. It switches which R2 prefix the CDN routing table points to.
  3. API call: POST /projects/:id/rollback { targetVersion: N }
  4. Server:
     a. Verify targetVersion exists and status != 'failed'
     b. Update KV routing: slug → { r2Prefix for version N }
     c. Purge CDN cache for index.html
     d. Mark current live version as 'rolled_back'
     e. Mark target version as 'live'
  5. The editor document remains at the latest edit state.
     The user can re-publish to go live with the current edits.

  Key insight: rollback is a SERVING operation, not an EDITING operation.
  It changes what visitors see, not what the editor contains.
```

---

## 8. Security Concerns

### 8.1 Threat Model for the Editor

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EDITOR THREAT MODEL                                   │
│                                                                         │
│  THREAT 1: Cross-Tenant Data Access                                     │
│  ─────────────────────────────────────                                  │
│  Attack: User modifies API calls to reference another tenant's          │
│          project ID, media ID, or template ID                           │
│  Impact: Read or modify another user's wedding invitation data          │
│                                                                         │
│  Mitigations:                                                           │
│  ├── Server: Every API endpoint resolves tenant_id from auth token      │
│  │   and adds WHERE tenant_id = $1 to every query                      │
│  ├── Server: PostgreSQL RLS as secondary enforcement                    │
│  ├── Server: Media URLs are signed with tenant-scoped tokens            │
│  │   (presigned URLs expire in 1 hour, scoped to tenant + project)     │
│  ├── Client: Project ID is derived from the authenticated session,     │
│  │   never from URL parameters alone                                    │
│  └── Audit: Log all cross-project references that fail RLS check        │
│                                                                         │
│                                                                         │
│  THREAT 2: Content Injection (XSS via text editing)                     │
│  ──────────────────────────────────────────────────                     │
│  Attack: User enters <script>alert('xss')</script> in a text slot      │
│  Impact: Script executes on visitor's browser when viewing the site     │
│                                                                         │
│  Mitigations:                                                           │
│  ├── Client: contentEditable output sanitized through DOMPurify before  │
│  │   being written to UPDATE_TEXT command payload                       │
│  │   Allowed tags: <b>, <i>, <em>, <strong>, <span>, <br>, <a>        │
│  │   Allowed attributes: class, style (allowlisted properties only),   │
│  │   href (http/https only, rel=noopener forced)                       │
│  ├── Server: Re-sanitize all text content on save (defense in depth)   │
│  ├── Server: Re-sanitize on publish (final gate in render pipeline)    │
│  ├── Published: CSP headers block inline scripts and untrusted sources │
│  └── Published: No raw innerHTML in island scripts — all dynamic       │
│       content rendered through textContent or sanitized insertion       │
│                                                                         │
│                                                                         │
│  THREAT 3: Malicious Media Upload                                       │
│  ────────────────────────────────                                       │
│  Attack: Upload an SVG with embedded script, a polyglot image/HTML,    │
│          or an oversized file to exhaust storage quota                   │
│  Impact: XSS via SVG, resource exhaustion, malware distribution         │
│                                                                         │
│  Mitigations:                                                           │
│  ├── Upload flow: presigned URL scoped to tenant + project + MIME type │
│  ├── Post-upload: server validates MIME type against file magic bytes   │
│  │   (not just extension or Content-Type header)                       │
│  ├── Images: re-encoded through Sharp (strips EXIF, metadata, scripts) │
│  ├── SVGs: sanitized via svg-sanitize (strip script, event handlers,   │
│  │   foreignObject, use elements)                                      │
│  ├── Size limits: 10MB per file, total per project per plan tier       │
│  ├── Rate limiting: max 20 uploads per minute per tenant               │
│  └── Virus scan: ClamAV on upload (async, flag + quarantine if found)  │
│                                                                         │
│                                                                         │
│  THREAT 4: Command Tampering                                            │
│  ──────────────────────────────                                         │
│  Attack: User modifies client-side JavaScript to send crafted commands  │
│          that bypass client-side validation (e.g., add 100 sections on  │
│          free plan, modify another user's slot content)                  │
│  Impact: Quota bypass, data corruption, unauthorized modification       │
│                                                                         │
│  Mitigations:                                                           │
│  ├── Server NEVER trusts client commands directly                      │
│  │   Server receives the DOCUMENT DELTA, not the command list          │
│  │   Server validates the resulting document independently:            │
│  │   - Quota check: section count, page count, media bytes            │
│  │   - Structural integrity: required slots present, types valid       │
│  │   - Tenant isolation: all referenced IDs belong to tenant          │
│  ├── Client-side validation exists for UX (fast feedback) only        │
│  └── Rate limiting: max 60 save operations per minute per project     │
│                                                                         │
│                                                                         │
│  THREAT 5: Session Hijacking / Stale Auth                               │
│  ────────────────────────────────────────                               │
│  Attack: Use a stolen or expired JWT to access the editor               │
│  Impact: Unauthorized access to project data                            │
│                                                                         │
│  Mitigations:                                                           │
│  ├── JWT access tokens: 15-minute expiry                               │
│  ├── Refresh tokens: httpOnly cookie, 7-day expiry, rotated on use     │
│  ├── Editor: token refresh happens silently in background               │
│  │   (SyncManager refreshes token 2 minutes before expiry)             │
│  ├── On refresh failure: editor enters read-only mode,                 │
│  │   shows re-login prompt, preserves unsaved changes in IndexedDB     │
│  └── Lock system (§5.4): uses session-bound lockId invalidated on     │
│       token revocation                                                  │
│                                                                         │
│                                                                         │
│  THREAT 6: Denial of Service via Editor                                 │
│  ──────────────────────────────────────                                 │
│  Attack: Automated script sends rapid commands to exhaust server        │
│          resources (CPU for validation, DB writes, R2 uploads)          │
│  Impact: Platform degradation for all users                             │
│                                                                         │
│  Mitigations:                                                           │
│  ├── Rate limits per tenant per endpoint:                              │
│  │   - Save: 60/min                                                    │
│  │   - Publish: 10/hour                                                │
│  │   - Media upload: 20/min                                            │
│  │   - Lock heartbeat: 1/min                                           │
│  ├── Command batching: client debounces, server receives delta not     │
│  │   individual commands (1 save = potentially 50 user actions)        │
│  ├── Document size limit: 2MB max for the full 4-layer document       │
│  └── Publish queue: priority lanes by plan tier, backpressure on free  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Tenant Isolation Summary

```
ISOLATION BOUNDARY         MECHANISM                 ENFORCEMENT POINT
──────────────────────────────────────────────────────────────────────────
Database rows              RLS policy                PostgreSQL (every query)
API endpoints              tenant_id from JWT        API middleware (every request)
Media access               Presigned URLs (scoped)   R2/S3 (every fetch)
Editor state               In-memory (single SPA)    Client (not shared between users)
Published sites            Separate R2 prefixes      CDN Worker (every request)
Lock system                Tenant-scoped locks       Redis (per-project)
WebSocket channels         Tenant + project scoped   WS middleware (on connect)
```

---

## 9. Future Collaboration Mode Support

### 9.1 Collaboration Architecture (Design for, Don't Build Yet)

The current editor is single-user. But every architectural decision is made to NOT block future real-time collaboration. Here is what is already collaboration-ready and what needs to change.

```
┌─────────────────────────────────────────────────────────────────────┐
│             COLLABORATION READINESS ASSESSMENT                       │
│                                                                     │
│  ALREADY COMPATIBLE (no changes needed):                            │
│  ─────────────────────────────────────────                          │
│  ✓ Command-based mutations                                          │
│    Commands are the natural unit for CRDT/OT operations.            │
│    Each command is atomic, typed, and targets a specific path.      │
│                                                                     │
│  ✓ Four-layer separation                                            │
│    Two users can edit different layers simultaneously without       │
│    conflict (user A edits content, user B edits theme).             │
│    Layer-level merge is already designed (§5.3).                    │
│                                                                     │
│  ✓ Slot-based addressing                                            │
│    Each edit targets a specific slotId. Two users editing           │
│    different slots in the same section = no conflict.               │
│    Slot IDs are stable across the document lifetime.                │
│                                                                     │
│  ✓ Immutable snapshots                                              │
│    State transitions are functional (old state → command → new      │
│    state). This is the foundation for operation transformation.     │
│                                                                     │
│  ✓ Event bus                                                        │
│    Already decouples state changes from rendering.                  │
│    Remote operations plug into the same event flow.                 │
│                                                                     │
│  ✓ Server-side validation                                           │
│    All constraints are enforced server-side.                        │
│    Doesn't matter if the command comes from user A or user B.       │
│                                                                     │
│                                                                     │
│  NEEDS CHANGES FOR COLLABORATION:                                   │
│  ────────────────────────────────                                   │
│                                                                     │
│  ✗ Lock system → must become AWARENESS system                       │
│    Current: exclusive lock (one editor at a time)                   │
│    Future: shared presence (cursors, selections, "user B is         │
│    editing hero section")                                           │
│    Change: Replace lock with presence channel                       │
│                                                                     │
│  ✗ Autosave → must become SYNC engine                               │
│    Current: debounced PATCH with full layer delta                   │
│    Future: real-time operation broadcast via WebSocket               │
│    Change: Replace debounced-save with operation-stream              │
│                                                                     │
│  ✗ Undo/redo → must become SCOPED undo                              │
│    Current: global undo stack (undo reverses any command)            │
│    Future: per-user undo (user A's undo doesn't affect user B)      │
│    Change: Tag commands with userId, filter undo stack per user      │
│                                                                     │
│  ✗ Conflict resolution → must become REAL-TIME merge                │
│    Current: optimistic versioning with save-time conflict detect     │
│    Future: operation transformation or CRDT for real-time merge      │
│    Change: Add OT/CRDT layer between command processor and store    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 Recommended Collaboration Technology

```
APPROACH          TECHNOLOGY         FIT FOR THIS SYSTEM
───────────────────────────────────────────────────────────────────────
OT (Operational   Custom or          Poor fit. OT excels at text (Google Docs)
Transformation)   ShareDB            but is complex for structured JSON trees.
                                     Wedding templates are mostly structured
                                     data, not linear text. OT transforms for
                                     tree operations are notoriously hard.

CRDT (Conflict-   Yjs or Automerge   Good fit. Yjs has native support for:
Free Replicated                      - Y.Map (slot content)
Data Types)                          - Y.Array (section ordering)
                                     - Y.Text (rich text within slots)
                                     - Y.XmlFragment (HTML content)
                                     Eventual consistency is acceptable for
                                     wedding template editing (not financial).

Hybrid:           Yjs + custom       Best fit. Use Yjs for the real-time sync
CRDT for data,    command layer      layer (document state + awareness). Keep
commands for                         the command-based mutation model as the
business logic                       API on top. Commands produce Yjs operations
                                     under the hood. Validation runs on every
                                     remote operation before applying.
───────────────────────────────────────────────────────────────────────
RECOMMENDATION: Yjs (hybrid approach), implemented in Q3 post-launch
```

### 9.3 Collaboration Data Flow (Future State)

```
USER A (Browser)                          USER B (Browser)
     │                                         │
     │ Command: UPDATE_TEXT                     │
     │ { slotId: "hero-names",                 │
     │   html: "Sarah & James" }               │
     │                                         │
     ▼                                         │
┌──────────┐                                   │
│ Command  │                                   │
│ Processor│                                   │
│          │──▶ Yjs Y.Map.set("hero-names",   │
│          │      { html: "Sarah & James" })   │
└──────────┘                                   │
     │                                         │
     ▼                                         │
┌──────────┐    WebSocket (binary Yjs sync)    │
│ Yjs Doc  │ ──────────────────────────────▶ ┌──────────┐
│ (local)  │                                 │ Yjs Doc  │
└──────────┘                                 │ (local)  │
     │                                       └──────────┘
     │          ┌──────────────────┐              │
     └─────────▶│  Yjs Server      │◀─────────────┘
                │  (y-websocket)   │
                │                  │
                │  Persistence:    │
                │  Yjs → snapshot  │
                │  → PostgreSQL    │
                │  (every 30s)     │
                └──────────────────┘

AWARENESS CHANNEL (piggybacks on Yjs WebSocket):
  {
    userId: "usr_A",
    cursor: { pageId: "home", sectionId: "hero", slotId: "hero-names" },
    selection: { start: 0, end: 5 },
    color: "#FF6B6B",          // assigned per-user color
    name: "Sarah",
    lastActive: 1709510400000
  }
```

### 9.4 Incremental Adoption Path

```
PHASE 0 (Current): Single-user editor
  - Exclusive lock per project
  - Debounced autosave
  - Global undo/redo

PHASE 1 (Q2): View-only spectators
  - Second user can open editor in read-only mode
  - See real-time changes from the editing user (WebSocket push)
  - Foundation: WebSocket channel per project

PHASE 2 (Q3): Section-level locking
  - Multiple users can edit simultaneously
  - Each user "claims" a section when they click into it
  - Section shows lock indicator: "Sarah is editing this section"
  - Only one user per section at a time
  - This is "pessimistic collaboration" — simple but effective

PHASE 3 (Q4): Full real-time collaboration
  - Yjs integration
  - Per-slot concurrent editing
  - Live cursors and selections
  - Per-user undo
  - Presence awareness ("Sarah is viewing the RSVP page")

Each phase is independently shippable and useful.
Phase 1 costs ~1 week of engineering.
Phase 2 costs ~2-3 weeks.
Phase 3 costs ~6-8 weeks.
```

---

## Appendix: Editor Decision Log

| Decision | Chosen | Rejected | Rationale |
|----------|--------|----------|-----------|
| **Render strategy** | Dual renderer (DOM for stack/grid, Konva for free) | DOM-only, Canvas-only | DOM handles CSS layout naturally for structured sections (flex/grid). Canvas handles pixel-precise free positioning. A single approach compromises one mode. The overhead of two renderers is justified by the fact that 80% of sections use stack layout (DOM) and only custom/advanced sections use free layout (Canvas). |
| **State model** | Immutable snapshots with structural sharing | Mutable state + dirty tracking, MobX observables | Immutability gives free undo/redo (stack of snapshots), free dirty detection (reference equality), and free render optimization (skip unchanged subtrees). The cost is slightly more complex updates (produce new objects), mitigated by immer or manual spreading. |
| **Undo model** | Snapshot-based (store full document per undo step) | Command-inverse (compute reverse of each command) | Command-inverse requires every command type to define its reverse, which is error-prone for complex operations (what's the reverse of a batch section duplicate?). Snapshots with structural sharing use ~100KB per step (only changed subtrees copied). 100 steps = ~10MB, well within browser memory. |
| **Autosave granularity** | Layer-level delta (send only changed layers) | Command replay (send command list), Full document (send everything) | Command replay requires the server to understand every command type (tight coupling). Full document wastes bandwidth on unchanged layers. Layer-level delta is the sweet spot: coarse enough to be simple (just "which layers changed?"), fine enough to minimize payload (typically only content layer). |
| **Conflict resolution** | Optimistic versioning + layer-level auto-merge | Last-write-wins, Manual-only, Operational transformation | Last-write-wins loses data. Manual-only frustrates users for trivial non-conflicts. OT is overengineered for a system that currently has no real-time collaboration. Optimistic versioning with auto-merge on non-overlapping layers handles 95% of conflicts silently (different layers changed) and only surfaces the 5% that need user input. |
| **Collaboration future** | Yjs CRDT (hybrid with command layer) | ShareDB (OT), Custom OT, Liveblocks | Yjs is open-source, has proven JSON tree support, and its binary sync protocol is efficient over WebSocket. Liveblocks is a strong alternative but adds vendor lock-in and per-user pricing that doesn't scale to 100k users. Custom OT for tree structures is a multi-month engineering effort with edge cases that Yjs has already solved. |
| **Validation architecture** | Three-level (command + continuous + publish gate) | Client-only, Server-only | Client-only can be bypassed. Server-only means slow feedback (network round-trip on every keystroke). Three levels give instant feedback (command validation), background quality checks (continuous), and final safety net (publish gate). |
| **Lock model** | Exclusive lock with BroadcastChannel detection | No locking (rely on conflict resolution alone) | Without locking, two-tab editing silently diverges and creates conflicts on every save. BroadcastChannel catches same-browser multi-tab instantly. Server lock catches cross-device. The lock is a courtesy mechanism (5-minute lease, takeover option) — not a hard barrier. |

---

*End of Visual Editor System Design Document*
