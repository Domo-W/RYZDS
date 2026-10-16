import {
  AssetRecordType, Box, Editor, createBindingId, createShapeId, toRichText,
  type TLGeoShapeGeoStyle, type TLShapeId, type TLShapePartial,
} from "tldraw";
import { GEO_KINDS, type CanvasOp } from "./ops";
import type { ClaudePresence } from "./presence";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Applies Claude's ops to the tldraw editor, one at a time, with cursor + camera choreography. */
export class CanvasApplier {
  private created = new Set<TLShapeId>();
  private lastCameraMove = 0;
  private focusedExplicitly = false;
  /** When true, ops wait (demo pause). */
  paused = false;

  constructor(private editor: Editor, private presence: ClaudePresence, private onSay: (t: string) => void) {}

  idFor(raw: unknown): TLShapeId {
    return createShapeId(String(raw ?? "x").replace(/^shape:/, "").replace(/[^A-Za-z0-9_-]/g, "_"));
  }

  beginTurn() {
    this.created.clear();
    this.focusedExplicitly = false;
  }

  async finishTurn() {
    const ed = this.editor;
    if (this.created.size && !this.focusedExplicitly) {
      const boxes = [...this.created].map((id) => ed.getShapePageBounds(id)).filter((b): b is Box => !!b);
      if (boxes.length) ed.zoomToBounds(Box.Common(boxes), { inset: 96, targetZoom: 1, animation: { duration: 800 } });
    }
    setTimeout(() => this.presence.hide(), 8000);
  }

  async apply(op: CanvasOp) {
    while (this.paused) await sleep(120);
    const ed = this.editor;
    switch (op.op) {
      case "say":
        this.onSay(String(op.text ?? ""));
        this.presence.say(String(op.text ?? ""));
        await sleep(250);
        return;
      case "wait":
        await sleep(Math.max(0, Math.min(3000, num(op.ms, 500))));
        return;
      case "clear":
        ed.deleteShapes([...ed.getCurrentPageShapeIds()]);
        return;
      case "delete":
        ed.deleteShapes((op.ids ?? []).map((i) => this.idFor(i)).filter((id) => ed.getShape(id)));
        await sleep(120);
        return;
      case "focus": {
        let box: Box | null = null;
        if (op.ids?.length) {
          const boxes = op.ids.map((i) => ed.getShapePageBounds(this.idFor(i))).filter((b): b is Box => !!b);
          if (boxes.length) box = Box.Common(boxes);
        } else if (typeof op.w === "number" && typeof op.h === "number") {
          box = new Box(num(op.x), num(op.y), op.w, op.h);
        }
        if (box) {
          this.focusedExplicitly = true;
          this.lastCameraMove = Date.now();
          ed.zoomToBounds(box, { inset: 96, targetZoom: op.zoom ?? 1, animation: { duration: 700 } });
          this.presence.moveTo(box.midX, box.midY, 600);
          await sleep(750);
        }
        return;
      }
      case "update": {
        const id = this.idFor(op.id);
        const shape = ed.getShape(id);
        if (!shape) return;
        const partial: TLShapePartial = { id, type: shape.type };
        if (typeof op.x === "number") partial.x = op.x;
        if (typeof op.y === "number") partial.y = op.y;
        const props: Record<string, unknown> = {};
        const text = op.text ?? op.label;
        if (typeof text === "string" && "richText" in shape.props) props.richText = toRichText(text);
        else if (typeof text === "string" && "text" in shape.props) props.text = text;
        if (typeof op.name === "string" && "name" in shape.props) props.name = op.name;
        if (typeof op.color === "string" && "color" in shape.props) props.color = op.color;
        if (typeof op.w === "number" && "w" in shape.props) props.w = op.w;
        if (typeof op.h === "number" && "h" in shape.props) props.h = op.h;
        if (shape.type === "text" && typeof op.w === "number") props.autoSize = false;
        (partial as { props?: unknown }).props = props;
        ed.updateShape(partial);
        await this.afterTouch(id);
        return;
      }
      case "text": case "note": case "shape": case "frame": case "svg": case "image": case "arrow":
        await this.create(op);
        return;
      default:
        console.warn("unknown op", op);
    }
  }

  private async create(op: Extract<CanvasOp, { id: string; op: "text" | "note" | "shape" | "frame" | "svg" | "image" | "arrow" }>) {
    const ed = this.editor;
    const id = this.idFor(op.id);
    if (ed.getShape(id)) {
      // Re-using an id means "update it".
      const text = "text" in op ? op.text : "label" in op ? op.label : undefined;
      await this.apply({ op: "update", id: op.id, text, x: "x" in op ? op.x : undefined, y: "y" in op ? op.y : undefined,
        w: "w" in op ? op.w : undefined, h: "h" in op ? op.h : undefined, color: "color" in op ? op.color : undefined });
      return;
    }
    switch (op.op) {
      case "text":
        ed.createShape({ id, type: "text", x: num(op.x), y: num(op.y), props: {
          richText: toRichText(String(op.text ?? "")), size: op.size ?? "m", font: op.font ?? "sans",
          color: op.color ?? "black", textAlign: op.align ?? "start",
          ...(op.w ? { w: op.w, autoSize: false } : { autoSize: true }),
        } });
        break;
      case "note":
        ed.createShape({ id, type: "note", x: num(op.x), y: num(op.y), props: { richText: toRichText(String(op.text ?? "")), color: op.color ?? "yellow" } });
        break;
      case "shape":
        ed.createShape({ id, type: "geo", x: num(op.x), y: num(op.y), props: {
          geo: (GEO_KINDS.has(op.kind ?? "") ? op.kind : "rectangle") as TLGeoShapeGeoStyle, w: num(op.w, 200), h: num(op.h, 120),
          richText: toRichText(String(op.label ?? "")), color: op.color ?? "black", fill: op.fill ?? "semi",
          dash: op.dash ?? "draw", size: op.size ?? "m",
        } });
        break;
      case "frame":
        ed.createShape({ id, type: "frame", x: num(op.x), y: num(op.y), props: { w: num(op.w, 900), h: num(op.h, 600), name: String(op.name ?? "") } });
        break;
      case "svg": case "image": {
        const w = num(op.w, 300), h = num(op.h, 200);
        const src = op.op === "svg"
          ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(ensureSvgNs(String(op.svg ?? "")))
          : String(op.url ?? "");
        const assetId = AssetRecordType.createId();
        ed.createAssets([{ id: assetId, typeName: "asset", type: "image", meta: {},
          props: { name: op.id, src, w, h, mimeType: op.op === "svg" ? "image/svg+xml" : "image/png", isAnimated: false } }]);
        ed.createShape({ id, type: "image", x: num(op.x), y: num(op.y), props: { assetId, w, h } });
        break;
      }
      case "arrow": {
        const a = op.from ? ed.getShapePageBounds(this.idFor(op.from)) : null;
        const b = op.to ? ed.getShapePageBounds(this.idFor(op.to)) : null;
        const start = op.start ?? (a ? { x: a.midX, y: a.midY } : { x: 0, y: 0 });
        const end = op.end ?? (b ? { x: b.midX, y: b.midY } : { x: start.x + 200, y: start.y });
        ed.createShape({ id, type: "arrow", x: 0, y: 0, props: {
          start, end, color: op.color ?? "black", dash: op.dash ?? "draw", bend: num(op.bend, 0),
          text: String(op.label ?? ""), arrowheadStart: "none", arrowheadEnd: "arrow",
        } });
        const bindings: Parameters<Editor["createBindings"]>[0] = [];
        for (const [terminal, box, target] of [["start", a, op.from], ["end", b, op.to]] as const) {
          if (box && target) bindings.push({ id: createBindingId(), type: "arrow" as const, fromId: id, toId: this.idFor(target),
            props: { terminal, normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false, snap: "none" as const } });
        }
        if (bindings.length) ed.createBindings(bindings);
        break;
      }
    }
    this.created.add(id);
    await this.afterTouch(id);
  }

  private async afterTouch(id: TLShapeId) {
    const ed = this.editor;
    const b = ed.getShapePageBounds(id);
    if (!b) return;
    this.presence.moveTo(b.maxX, b.maxY, 350);
    const vp = ed.getViewportPageBounds();
    if (!Box.Contains(vp, b) && Date.now() - this.lastCameraMove > 900) {
      this.lastCameraMove = Date.now();
      ed.zoomToBounds(Box.Expand(vp, b), { inset: 48, animation: { duration: 500 } });
    }
    await sleep(160);
  }
}

function ensureSvgNs(svg: string) {
  const s = svg.trim();
  if (s.startsWith("<svg") && !s.includes("xmlns=")) return s.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return s;
}
