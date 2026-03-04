import type { ProjectDocument } from "@elove/shared";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function step11HtmlAssemble(
  document: ProjectDocument,
  pageHtmlFragments: Record<string, string>,
  criticalCss: string,
  deferredCss: string,
  jsBundleContent: string,
): Promise<{ htmlFiles: Record<string, string> }> {
  const { couple } = document.content.data;
  const htmlFiles: Record<string, string> = {};

  const deferredCssTag = deferredCss
    ? `<link rel="preload" as="style" href="/style.css" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="/style.css"></noscript>`
    : "";

  const jsTag = jsBundleContent
    ? `<script src="/shared.js" defer></script>`
    : "";

  for (const page of document.structure.pages) {
    const isHome = page.slug === "home" || page.slug === "index";
    const fileName = isHome ? "index.html" : `${page.slug}.html`;
    const title = `${couple.partner1} & ${couple.partner2} — ${page.title}`;
    const pageContent = pageHtmlFragments[page.slug] ?? "";

    htmlFiles[fileName] = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${criticalCss}</style>
  ${deferredCssTag}
</head>
<body>
${pageContent}
${jsTag}
</body>
</html>`;
  }

  return { htmlFiles };
}
