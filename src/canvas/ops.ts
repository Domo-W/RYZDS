// The visual "language" Claude speaks. One JSON object per line (NDJSON).
export type Color =
  | "black" | "grey" | "light-violet" | "violet" | "blue" | "light-blue"
  | "yellow" | "orange" | "green" | "light-green" | "light-red" | "red" | "white";
export type Size = "s" | "m" | "l" | "xl";
export type Fill = "none" | "semi" | "solid" | "pattern";
export type Dash = "draw" | "solid" | "dashed" | "dotted";
export type Font = "draw" | "sans" | "serif" | "mono";

export type CanvasOp =
  | { op: "say"; text: string }
  | { op: "wait"; ms: number }
  | { op: "text"; id: string; x: number; y: number; text: string; size?: Size; w?: number; color?: Color; font?: Font; align?: "start" | "middle" | "end" }
  | { op: "note"; id: string; x: number; y: number; text: string; color?: Color }
  | { op: "shape"; id: string; kind?: string; x: number; y: number; w: number; h: number; label?: string; color?: Color; fill?: Fill; dash?: Dash; size?: Size }
  | { op: "arrow"; id: string; from?: string; to?: string; start?: { x: number; y: number }; end?: { x: number; y: number }; label?: string; color?: Color; dash?: Dash; bend?: number }
  | { op: "frame"; id: string; x: number; y: number; w: number; h: number; name?: string }
  | { op: "svg"; id: string; x: number; y: number; w: number; h: number; svg: string }
  | { op: "image"; id: string; x: number; y: number; w: number; h: number; url: string }
  | { op: "update"; id: string; text?: string; x?: number; y?: number; w?: number; h?: number; color?: Color; label?: string; name?: string }
  | { op: "delete"; ids: string[] }
  | { op: "focus"; ids?: string[]; x?: number; y?: number; w?: number; h?: number; zoom?: number }
  | { op: "clear" };

export const GEO_KINDS = new Set([
  "rectangle", "ellipse", "triangle", "diamond", "pentagon", "hexagon", "octagon", "star",
  "rhombus", "rhombus-2", "oval", "trapezoid", "arrow-right", "arrow-left", "arrow-up",
  "arrow-down", "x-box", "check-box", "heart", "cloud",
]);
