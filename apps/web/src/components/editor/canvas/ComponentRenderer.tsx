"use client";
import React from "react";
import type { Section } from "@elove/shared";
import { StackSection } from "./StackSection";
import { GridSection } from "./GridSection";

interface ComponentRendererProps {
  section: Section;
  tokens: Record<string, string>;
}

/**
 * Selects the correct layout renderer for a section based on its `layoutMode`.
 * - "stack" → StackSection (vertical flex column)
 * - "grid"  → GridSection (CSS grid, auto-responsive)
 * - "free"  → Falls back to StackSection until a FreeSection renderer is added
 */
export function ComponentRenderer({ section, tokens }: ComponentRendererProps) {
  switch (section.layoutMode) {
    case "grid":
      return <GridSection section={section} tokens={tokens} />;
    case "stack":
    case "free":
    default:
      return <StackSection section={section} tokens={tokens} />;
  }
}
