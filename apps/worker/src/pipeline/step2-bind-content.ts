import type { ProjectDocument } from "@elove/shared";

export async function step2BindContent(
  document: ProjectDocument,
): Promise<{ boundDocument: ProjectDocument }> {
  // For MVP: document is already content-bound.
  // Future: resolve dynamic content references, slot overrides, etc.
  return { boundDocument: document };
}
