import type { ProjectDocument } from "@elove/shared";

export async function step8Islands(
  document: ProjectDocument,
): Promise<{ islandScripts: Record<string, string> }> {
  const islandScripts: Record<string, string> = {};

  // RSVP island — inject only if there's a button with action=rsvp
  const hasRsvp = document.structure.pages.some((p) =>
    p.sections.some((s) =>
      s.slots.some(
        (sl) =>
          sl.componentType === "button" &&
          (sl.props as Record<string, string>).action === "rsvp",
      ),
    ),
  );

  if (hasRsvp) {
    islandScripts["rsvp"] = `
(function() {
  var form = document.querySelector('#rsvp-form');
  if (!form) return;
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var data = Object.fromEntries(new FormData(form));
    var res = await fetch('/__rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    var json = await res.json();
    if (json.success) { form.innerHTML = '<p>Cam on ban da xac nhan!</p>'; }
  });
})();`;
  }

  return { islandScripts };
}
