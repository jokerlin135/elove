import type { ProjectDocument } from "@elove/shared";
import { ComponentRegistry } from "@elove/shared";

export async function step5RenderLayout(
  document: ProjectDocument,
  _assetMap: Record<string, string>,
  cssTokens: Record<string, string>,
): Promise<{ pageHtmlFragments: Record<string, string>; sectionCss: string }> {
  const pageHtmlFragments: Record<string, string> = {};

  for (const page of document.structure.pages) {
    const sectionsHtml = page.sections.map((section) => {
      const slotsHtml = section.slots
        .map((slot) => {
          const comp = ComponentRegistry.get(slot.componentType);
          if (!comp) return "";
          return `<div class="elove-slot">${comp.renderStatic(
            slot.props as Record<string, unknown>,
            cssTokens,
          )}</div>`;
        })
        .join("\n");

      return `<section class="elove-section elove-section--${section.layoutMode}" id="${section.id}">\n${slotsHtml}\n</section>`;
    });

    pageHtmlFragments[page.slug] = sectionsHtml.join("\n");
  }

  // Generate CSS custom properties block from token map
  const tokensCss = `:root {\n${Object.entries(cssTokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n")}\n}`;

  return { pageHtmlFragments, sectionCss: tokensCss };
}
