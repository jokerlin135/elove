import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StackSection } from "../StackSection";

describe("StackSection", () => {
  it("renders text slot content", () => {
    const section = {
      id: "s1", type: "hero", layoutMode: "stack" as const,
      slots: [{ id: "sl1", componentType: "text" as const, props: { content: "Minh & Lan", variant: "heading" } }]
    };
    render(<StackSection section={section} tokens={{ "--color-text": "#333" }} />);
    expect(screen.getByText("Minh & Lan")).toBeInTheDocument();
  });

  it("renders multiple slots vertically", () => {
    const section = {
      id: "s2", type: "content", layoutMode: "stack" as const,
      slots: [
        { id: "sl1", componentType: "text" as const, props: { content: "Title", variant: "heading" } },
        { id: "sl2", componentType: "text" as const, props: { content: "Body", variant: "body" } },
      ]
    };
    const { container } = render(<StackSection section={section} tokens={{}} />);
    const slots = container.querySelectorAll(".elove-slot");
    expect(slots.length).toBe(2);
  });
});
