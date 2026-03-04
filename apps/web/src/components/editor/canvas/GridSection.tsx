"use client";
import React from "react";
import { ComponentRegistry } from "@elove/shared";
import type { Section } from "@elove/shared";
import { SlotWrapper } from "./SlotWrapper";

interface GridSectionProps {
  section: Section;
  tokens: Record<string, string>;
  /** Number of columns. Defaults to auto-fill with 200px minimum. */
  columns?: number;
}

/**
 * Renders a section with CSS grid layout.
 * Uses auto-responsive columns by default (auto-fill, minmax 200px).
 * An explicit `columns` prop locks the grid to a fixed column count.
 */
export function GridSection({ section, tokens, columns }: GridSectionProps) {
  const gridTemplateColumns = columns
    ? `repeat(${columns}, 1fr)`
    : "repeat(auto-fill, minmax(200px, 1fr))";

  return (
    <div
      className="elove-section elove-section--grid"
      style={{ display: "grid", gridTemplateColumns, gap: "0.5rem" }}
      data-section-id={section.id}
    >
      {section.slots.map((slot) => {
        const comp = ComponentRegistry.get(slot.componentType);
        if (!comp) return null;

        const html = comp.renderDOM(slot.props, tokens);

        return (
          <SlotWrapper
            key={slot.id}
            slotId={slot.id}
            sectionId={section.id}
          >
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </SlotWrapper>
        );
      })}
    </div>
  );
}
