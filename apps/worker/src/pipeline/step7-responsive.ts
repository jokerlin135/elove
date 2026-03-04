export async function step7Responsive(
  _sectionCss: string,
): Promise<{ responsiveCss: string }> {
  const responsiveCss = `
/* Mobile-first responsive (AD-06: CSS transform scale for free-layout) */
@media (max-width: 768px) {
  .elove-section--stack { padding: 1rem; }
  .elove-section--grid { grid-template-columns: 1fr !important; }
  .elove-section--free { transform: scale(0.9); transform-origin: top center; }
}
@media (prefers-reduced-motion: reduce) {
  .elove-section { animation: none; }
}
`;
  return { responsiveCss };
}
