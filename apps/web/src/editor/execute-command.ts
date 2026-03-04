import { produce } from "immer";
import type { ProjectDocument, Theme } from "@elove/shared";

// ========== Types ==========

export type Command =
  | { type: "UPDATE_CONTENT"; payload: { path: string; value: unknown } }
  | {
      type: "UPDATE_THEME_TOKEN";
      payload: { tokenPath: string; value: string };
    }
  | { type: "SWITCH_THEME"; payload: { themeId: string } }
  | {
      type: "ADD_SECTION";
      payload: {
        pageId: string;
        afterSectionId: string | null;
        sectionType: string;
      };
    }
  | { type: "REMOVE_SECTION"; payload: { pageId: string; sectionId: string } }
  | {
      type: "REORDER_SECTION";
      payload: { pageId: string; sectionId: string; targetIndex: number };
    }
  | { type: "ADD_PAGE"; payload: { slug: string; title: string } }
  | { type: "REMOVE_PAGE"; payload: { pageId: string } }
  | { type: "REORDER_PAGE"; payload: { pageId: string; targetIndex: number } }
  | {
      type: "UPDATE_LAYOUT";
      payload: { sectionId: string; layoutMode: "stack" | "grid" | "free" };
    }
  | {
      type: "UPDATE_ANIMATION";
      payload: { sectionId: string; config: Record<string, unknown> };
    }
  | {
      type: "UPDATE_META";
      payload: {
        field: keyof ProjectDocument["content"]["data"]["couple"];
        value: string;
      };
    };

export interface CommandState {
  document: ProjectDocument;
  theme: Theme;
  undoStack: ProjectDocument[];
  redoStack: ProjectDocument[];
  dirty: boolean;
}

// ========== Path helpers ==========

/**
 * Set a value at a nested dot-separated path within a plain object.
 * Returns a new object — does not mutate the original.
 * Uses immer internally so nested objects are structurally shared.
 */
function setNestedPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const parts = path.split(".");
  return produce(obj, (draft) => {
    let current: Record<string, unknown> = draft as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (
        current[key] === undefined ||
        typeof current[key] !== "object" ||
        current[key] === null
      ) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  });
}

function generateId(): string {
  // Use crypto.randomUUID when available (Node 19+ / modern browsers), otherwise fallback
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Simple fallback UUID-like id
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ========== Main function ==========

/**
 * Pure function — receives CommandState and a Command, returns a new CommandState.
 * Does NOT mutate any input. All mutations go through immer's produce().
 */
export function executeCommand(
  state: CommandState,
  command: Command,
): CommandState {
  // Snapshot current document into undo stack (deep clone via JSON round-trip for safety)
  const snapshot: ProjectDocument = JSON.parse(
    JSON.stringify(state.document),
  ) as ProjectDocument;
  const undoStack = [...state.undoStack, snapshot];
  // Cap undo history at 100 entries
  if (undoStack.length > 100) undoStack.shift();

  let nextDoc = state.document;
  let nextTheme = state.theme;

  switch (command.type) {
    case "UPDATE_CONTENT": {
      nextDoc = produce(state.document, (draft) => {
        // Navigate the path inside draft.content directly
        const parts = command.payload.path.split(".");
        let current: Record<string, unknown> =
          draft.content as unknown as Record<string, unknown>;
        for (let i = 0; i < parts.length - 1; i++) {
          const key = parts[i];
          if (
            current[key] === undefined ||
            typeof current[key] !== "object" ||
            current[key] === null
          ) {
            current[key] = {};
          }
          current = current[key] as Record<string, unknown>;
        }
        current[parts[parts.length - 1]] = command.payload.value;
      });
      break;
    }

    case "UPDATE_THEME_TOKEN": {
      const parts = command.payload.tokenPath.split(".");
      nextTheme = produce(state.theme, (draft) => {
        if (!draft.overrides) {
          draft.overrides = {};
        }
        const overrides = draft.overrides as Record<string, unknown>;
        if (parts.length === 2) {
          const [group, key] = parts;
          if (!overrides[group] || typeof overrides[group] !== "object") {
            overrides[group] = {};
          }
          (overrides[group] as Record<string, string>)[key] =
            command.payload.value;
        } else {
          overrides[command.payload.tokenPath] = command.payload.value;
        }
      });
      break;
    }

    case "SWITCH_THEME": {
      nextTheme = produce(state.theme, (draft) => {
        draft.baseThemeId = command.payload.themeId;
        draft.overrides = {};
      });
      break;
    }

    case "ADD_SECTION": {
      nextDoc = produce(state.document, (draft) => {
        const page = draft.structure.pages.find(
          (p) => p.id === command.payload.pageId,
        );
        if (!page) return;
        const newSection = {
          id: generateId(),
          type: command.payload.sectionType,
          layoutMode: "stack" as const,
          slots: [],
        };
        if (!command.payload.afterSectionId) {
          page.sections.push(newSection);
        } else {
          const idx = page.sections.findIndex(
            (s) => s.id === command.payload.afterSectionId,
          );
          page.sections.splice(idx + 1, 0, newSection);
        }
      });
      break;
    }

    case "REMOVE_SECTION": {
      nextDoc = produce(state.document, (draft) => {
        const page = draft.structure.pages.find(
          (p) => p.id === command.payload.pageId,
        );
        if (!page) return;
        page.sections = page.sections.filter(
          (s) => s.id !== command.payload.sectionId,
        );
      });
      break;
    }

    case "REORDER_SECTION": {
      nextDoc = produce(state.document, (draft) => {
        const page = draft.structure.pages.find(
          (p) => p.id === command.payload.pageId,
        );
        if (!page) return;
        const idx = page.sections.findIndex(
          (s) => s.id === command.payload.sectionId,
        );
        if (idx < 0) return;
        const [section] = page.sections.splice(idx, 1);
        page.sections.splice(command.payload.targetIndex, 0, section);
      });
      break;
    }

    case "ADD_PAGE": {
      nextDoc = produce(state.document, (draft) => {
        draft.structure.pages.push({
          id: generateId(),
          slug: command.payload.slug,
          title: command.payload.title,
          sections: [],
        });
      });
      break;
    }

    case "REMOVE_PAGE": {
      nextDoc = produce(state.document, (draft) => {
        draft.structure.pages = draft.structure.pages.filter(
          (p) => p.id !== command.payload.pageId,
        );
      });
      break;
    }

    case "REORDER_PAGE": {
      nextDoc = produce(state.document, (draft) => {
        const idx = draft.structure.pages.findIndex(
          (p) => p.id === command.payload.pageId,
        );
        if (idx < 0) return;
        const [page] = draft.structure.pages.splice(idx, 1);
        draft.structure.pages.splice(command.payload.targetIndex, 0, page);
      });
      break;
    }

    case "UPDATE_LAYOUT": {
      nextDoc = produce(state.document, (draft) => {
        for (const page of draft.structure.pages) {
          const section = page.sections.find(
            (s) => s.id === command.payload.sectionId,
          );
          if (section) {
            section.layoutMode = command.payload.layoutMode;
            break;
          }
        }
      });
      break;
    }

    case "UPDATE_ANIMATION": {
      nextDoc = produce(state.document, (draft) => {
        const behaviors = draft.behavior.sectionBehaviors as Record<
          string,
          Record<string, unknown>
        >;
        if (!behaviors[command.payload.sectionId]) {
          behaviors[command.payload.sectionId] = {};
        }
        Object.assign(
          behaviors[command.payload.sectionId],
          command.payload.config,
        );
      });
      break;
    }

    case "UPDATE_META": {
      nextDoc = produce(state.document, (draft) => {
        (draft.content.data.couple as Record<string, unknown>)[
          command.payload.field
        ] = command.payload.value;
      });
      break;
    }
  }

  return {
    ...state,
    document: nextDoc,
    theme: nextTheme,
    dirty: true,
    undoStack,
    redoStack: [],
  };
}
