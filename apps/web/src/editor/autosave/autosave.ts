import { sha256 } from "../../utils/hash";
import type { ProjectDocument, Theme } from "@elove/shared";

interface AutosaveConfig {
  r2Put: (key: string, body: string) => Promise<unknown>;
  patchRevision: (projectId: string, revision: number) => Promise<unknown>;
}

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export class AutosaveManager {
  private lastSavedHash = "";
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private forcedSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly config: AutosaveConfig) {}

  /**
   * Schedule a debounced autosave.
   * Uses 5s debounce while typing, 2s otherwise.
   * Forces a save within 30s regardless of debounce.
   */
  schedule(
    doc: ProjectDocument,
    theme: Theme,
    tenantId: string,
    projectId: string,
    editRevision: number,
    isTyping = false,
  ): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const delay = isTyping ? 5000 : 2000;
    this.debounceTimer = setTimeout(
      () => void this.save(doc, theme, tenantId, projectId, editRevision),
      delay,
    );

    // Forced save: guarantee save within 30s no matter how frequently user types
    if (!this.forcedSaveTimer) {
      this.forcedSaveTimer = setTimeout(() => {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.forcedSaveTimer = null;
        void this.save(doc, theme, tenantId, projectId, editRevision);
      }, 30_000);
    }
  }

  /**
   * Immediately save if document has changed.
   * Returns without saving if hash is unchanged (deduplication).
   * Throws on persistent R2 failure — caller must block publish per AD-01.
   */
  async save(
    doc: ProjectDocument,
    theme: Theme,
    tenantId: string,
    projectId: string,
    editRevision: number,
  ): Promise<void> {
    const currentHash = sha256(JSON.stringify(doc));
    if (currentHash === this.lastSavedHash) return;

    const docKey = `projects/${tenantId}/${projectId}/document.json`;
    const themeKey = `projects/${tenantId}/${projectId}/theme.json`;
    const docJson = JSON.stringify(doc);
    const themeJson = JSON.stringify(theme);

    // Step 1: Buffer to IndexedDB for crash recovery (non-fatal if unavailable)
    await this.writeToIndexedDB(projectId, docJson, themeJson);

    // Step 2: Write to R2 with up to 3 retries; throws on persistent failure
    await withRetry(() =>
      Promise.all([
        this.config.r2Put(docKey, docJson),
        this.config.r2Put(themeKey, themeJson),
      ]),
    );

    // Step 3: Commit new revision to database
    const newRevision = editRevision + 1;
    await this.config.patchRevision(projectId, newRevision);

    // Only update hash after full pipeline success
    this.lastSavedHash = currentHash;
  }

  /**
   * Reads buffered document from IndexedDB for crash recovery on page reload.
   * Returns null when IndexedDB is unavailable (e.g., Node.js/SSR context).
   */
  async readFromIndexedDB(projectId: string): Promise<{ doc: string; theme: string } | null> {
    if (typeof indexedDB === "undefined") return null;
    try {
      const db = await openIdb();
      const tx = db.transaction("autosave", "readonly");
      const record = (await tx.objectStore("autosave").get(projectId)) as
        | { doc: string; theme: string }
        | undefined;
      return record ?? null;
    } catch {
      return null;
    }
  }

  private async writeToIndexedDB(
    projectId: string,
    doc: string,
    theme: string,
  ): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    try {
      const db = await openIdb();
      const tx = db.transaction("autosave", "readwrite");
      tx.objectStore("autosave").put(
        { projectId, doc, theme, savedAt: Date.now() },
        projectId,
      );
      await tx.done;
    } catch {
      // IndexedDB failure is non-fatal — proceed to R2 write
    }
  }
}

async function openIdb() {
  const { openDB } = await import("idb");
  return openDB("elove-autosave", 1, {
    upgrade(db) {
      db.createObjectStore("autosave");
    },
  });
}
