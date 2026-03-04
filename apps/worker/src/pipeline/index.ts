import { step1Snapshot } from "./step1-snapshot.js";
import { step2BindContent } from "./step2-bind-content.js";
import { step3ResolveAssets } from "./step3-resolve-assets.js";
import { step4CompileTheme } from "./step4-compile-theme.js";
import { step5RenderLayout } from "./step5-render-layout.js";
import { step6Animation } from "./step6-animation.js";
import { step7Responsive } from "./step7-responsive.js";
import { step8Islands } from "./step8-islands.js";
import { step9CssSplit } from "./step9-css-split.js";
import { step10JsBundle } from "./step10-js-bundle.js";
import { step11HtmlAssemble } from "./step11-html-assemble.js";
import { step12Upload } from "./step12-upload.js";
import type { BuildJob, PipelineDeps, PipelineResult } from "./types.js";

export type { BuildJob, PipelineDeps, PipelineResult };

export async function runPipeline(
  job: BuildJob,
  deps: PipelineDeps,
): Promise<PipelineResult> {
  const start = Date.now();

  // ── RESOLVE phase ────────────────────────────────────────────────────────
  const { document, theme } = await step1Snapshot(job, deps);
  const { boundDocument } = await step2BindContent(document);
  const { assetMap } = await step3ResolveAssets(boundDocument, deps);
  const { cssTokens, fontDeclarations } = await step4CompileTheme(theme);

  // ── COMPILE phase ────────────────────────────────────────────────────────
  const { pageHtmlFragments, sectionCss } = await step5RenderLayout(
    boundDocument,
    assetMap,
    cssTokens,
  );
  const { animationCss, animatedFragments } = await step6Animation(
    pageHtmlFragments,
    boundDocument.behavior,
  );
  const { responsiveCss } = await step7Responsive(sectionCss);
  const { islandScripts } = await step8Islands(boundDocument);

  // ── PACKAGE phase ────────────────────────────────────────────────────────
  const fullCss = fontDeclarations + sectionCss + animationCss + responsiveCss;
  const { criticalCss, deferredCss } = await step9CssSplit(fullCss);
  const { jsBundleContent } = await step10JsBundle(islandScripts);
  const { htmlFiles } = await step11HtmlAssemble(
    boundDocument,
    animatedFragments,
    criticalCss,
    deferredCss,
    jsBundleContent,
  );
  await step12Upload(
    job,
    htmlFiles,
    deferredCss,
    jsBundleContent,
    islandScripts,
    deps,
  );

  return { htmlFiles, durationMs: Date.now() - start };
}
