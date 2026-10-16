import { Box, Editor, renderPlaintextFromRichText, type TLShapeId } from "tldraw";

const r = (n: number) => Math.round(n);
const strip = (id: string) => id.replace(/^shape:/, "");

/** Compact JSON description of the canvas that Claude reads before every turn. */
export function describeCanvas(editor: Editor) {
  const pageShapes = editor.getCurrentPageShapes();
  const shapes = pageShapes.map((s) => {
    const b = editor.getShapePageBounds(s) ?? new Box(s.x, s.y, 0, 0);
    const d: Record<string, unknown> = { id: strip(s.id), type: s.type, x: r(b.x), y: r(b.y), w: r(b.w), h: r(b.h) };
    const p = s.props as Record<string, unknown>;
    if (p.richText) {
      const t = renderPlaintextFromRichText(editor, p.richText as never);
      if (t) d.text = t.slice(0, 240);
    }
    if (typeof p.name === "string" && p.name) d.name = p.name;
    if (typeof p.geo === "string") d.kind = p.geo;
    if (typeof p.color === "string") d.color = p.color;
    if (s.type === "arrow") {
      for (const bnd of editor.getBindingsFromShape(s, "arrow")) {
        const props = bnd.props as { terminal: "start" | "end" };
        d[props.terminal === "start" ? "from" : "to"] = strip(bnd.toId);
      }
    }
    return d;
  });
  const vp = editor.getViewportPageBounds();
  const boxes = pageShapes.map((s) => editor.getShapePageBounds(s)).filter((b): b is Box => !!b);
  const all = boxes.length ? Box.Common(boxes) : null;
  const suggested_origin = all
    ? { x: r(all.maxX + 160), y: r(all.minY) }
    : { x: r(vp.x + vp.w / 2 - 450), y: r(vp.y + 80) };
  return {
    viewport: { x: r(vp.x), y: r(vp.y), w: r(vp.w), h: r(vp.h), zoom: +editor.getZoomLevel().toFixed(2) },
    suggested_origin,
    selected: editor.getSelectedShapeIds().map(strip),
    shapes,
  };
}

/** PNG screenshot of everything on the canvas (base64, no data: prefix). */
export async function exportCanvasPng(editor: Editor): Promise<string | null> {
  const ids = [...editor.getCurrentPageShapeIds()] as TLShapeId[];
  if (!ids.length) return null;
  const bounds = Box.Common(ids.map((id) => editor.getShapePageBounds(id)).filter((b): b is Box => !!b));
  const scale = Math.min(0.6, 1600 / Math.max(bounds.w, bounds.h, 1));
  const { blob } = await editor.toImage(ids, { format: "png", scale, background: true, padding: 32 });
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
  return dataUrl.split(",")[1] ?? null;
}
