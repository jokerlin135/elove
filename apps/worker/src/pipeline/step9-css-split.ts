export async function step9CssSplit(
  fullCss: string,
): Promise<{ criticalCss: string; deferredCss: string }> {
  // Heuristic: :root variables + first 20 lines are critical inline CSS.
  // The rest is deferred via <link rel="preload">.
  const lines = fullCss.split("\n");
  const rootEnd = lines.findIndex((l) => l.trim() === "}") + 1;
  const splitPoint = Math.max(rootEnd, 20);
  const criticalLines = lines.slice(0, splitPoint);
  const deferredLines = lines.slice(splitPoint);

  return {
    criticalCss: criticalLines.join("\n"),
    deferredCss: deferredLines.join("\n"),
  };
}
