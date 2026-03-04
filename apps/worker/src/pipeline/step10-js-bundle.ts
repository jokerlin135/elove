export async function step10JsBundle(
  islandScripts: Record<string, string>,
): Promise<{ jsBundleContent: string }> {
  const scripts = Object.values(islandScripts).join("\n\n");
  return {
    jsBundleContent: scripts ? `/* ELove Islands Bundle */\n${scripts}` : "",
  };
}
