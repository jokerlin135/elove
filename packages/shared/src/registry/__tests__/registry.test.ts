import { describe, it, expect } from "vitest";
import { ComponentRegistry } from "../component-registry";

describe("ComponentRegistry", () => {
  it("has 7 required component types", () => {
    const types = ["text", "image", "video", "shape", "button", "icon", "divider"];
    for (const t of types) {
      expect(ComponentRegistry.has(t), `Missing component: ${t}`).toBe(true);
    }
  });

  it("each component has renderStatic and defaultProps", () => {
    for (const [, comp] of ComponentRegistry) {
      expect(typeof comp.renderStatic).toBe("function");
      expect(comp.defaultProps).toBeDefined();
    }
  });

  it("text renderStatic returns HTML string containing content", () => {
    const text = ComponentRegistry.get("text")!;
    const html = text.renderStatic(
      { content: "Hello Wedding", variant: "heading" },
      { "--color-text": "#333" }
    );
    expect(html).toContain("Hello Wedding");
    expect(typeof html).toBe("string");
  });

  it("image renderStatic returns placeholder when no mediaId", () => {
    const image = ComponentRegistry.get("image")!;
    const html = image.renderStatic({ mediaId: "", alt: "", fit: "cover" }, {});
    expect(html).toContain("placeholder");
  });

  it("button renderStatic generates anchor tag", () => {
    const button = ComponentRegistry.get("button")!;
    const html = button.renderStatic(
      { label: "RSVP", action: "rsvp", target: "" },
      { "--color-primary": "#FF85A1" }
    );
    expect(html).toContain("<a");
    expect(html).toContain("RSVP");
  });
});
