"use client";
import React from "react";
import { ComponentRegistry } from "@elove/shared";
import type { Section } from "@elove/shared";
import { SlotWrapper } from "./SlotWrapper";

interface StackSectionProps {
  section: Section;
  tokens: Record<string, string>;
}

/**
 * Renders a section with stack (vertical flex) layout.
 * Each slot is rendered as an interactive SlotWrapper with dangerouslySetInnerHTML
 * using the component's renderDOM output.
 */
export function StackSection({ section, tokens }: StackSectionProps) {
  return (
    <div
      className="elove-section elove-section--stack flex flex-col gap-2"
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
