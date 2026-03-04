"use client";
import React from "react";
import { useEditorStore } from "../../../store/editor-context";

interface SlotWrapperProps {
  slotId: string;
  sectionId: string;
  children: React.ReactNode;
}

/**
 * Wraps each slot in the editor canvas. Handles click-to-select behavior
 * and visually highlights the slot when it is the active selection.
 */
export function SlotWrapper({ slotId, sectionId, children }: SlotWrapperProps) {
  const setSelection = useEditorStore((s) => s.setSelection);
  const selectedSlotId = useEditorStore((s) => s.selection.slotId);
  const isSelected = selectedSlotId === slotId;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setSelection({ slotId, sectionId });
  }

  return (
    <div
      className={[
        "elove-slot",
        "cursor-pointer",
        "rounded",
        isSelected
          ? "ring-2 ring-blue-500"
          : "hover:ring-2 hover:ring-blue-400",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      data-slot-id={slotId}
      data-section-id={sectionId}
    >
      {children}
    </div>
  );
}
