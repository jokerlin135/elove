// Document types for ELove Platform
export type LayoutMode = "stack" | "grid" | "free";
export type ComponentType = "text" | "image" | "video" | "shape" | "button" | "icon" | "divider";

export interface SlotPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
}

export interface Slot {
  id: string;
  componentType: ComponentType;
  props: Record<string, unknown>;
  position?: SlotPosition;
}

export interface Section {
  id: string;
  type: string;
  layoutMode: LayoutMode;
  slots: Slot[];
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  sections: Section[];
}

export interface CoupleData {
  partner1: string;
  partner2: string;
  weddingDate: string;
  venue: string;
  story: string;
}
