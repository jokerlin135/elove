import type { ProjectDocument } from "@elove/shared";

export async function step6Animation(
  pageHtmlFragments: Record<string, string>,
  behavior: ProjectDocument["behavior"],
): Promise<{
  animationCss: string;
  animatedFragments: Record<string, string>;
}> {
  const { duration, easing } = behavior.pageTransitions;
  // duration is a number (milliseconds) in the schema — convert to CSS string
  const durationCss =
    typeof duration === "number" ? `${duration}ms` : String(duration);

  const animationCss = `
.elove-section {
  animation: elove-fade-in ${durationCss} ${easing} both;
  animation-timeline: view();
  animation-range: entry 0% entry 20%;
}
@keyframes elove-fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

  return { animationCss, animatedFragments: pageHtmlFragments };
}
