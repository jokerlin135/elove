import type { ProjectDocument } from "@elove/shared";

export async function step3ResolveAssets(
  document: ProjectDocument,
  _deps: unknown,
): Promise<{ assetMap: Record<string, string> }> {
  // Collect all mediaId references from slots across all pages/sections
  const assetMap: Record<string, string> = {};

  for (const page of document.structure.pages) {
    for (const section of page.sections) {
      for (const slot of section.slots) {
        if (slot.componentType === "image" && slot.props.mediaId) {
          const mediaId = slot.props.mediaId as string;
          assetMap[mediaId] = `/__media/${mediaId}/original`;
        }
      }
    }
  }

  return { assetMap };
}
