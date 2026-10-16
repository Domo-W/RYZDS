import type { CanvasOp } from "../canvas/ops";
import type { CanvasApplier } from "../canvas/apply";

export type StreamEvent =
  | { t: "text"; text: string }
  | { t: "thinking"; text: string }
  | { t: "meta"; model: string; label: string }
  | { t: "error"; message: string }
  | { t: "done"; stop_reason?: string | null; usage?: Record<string, unknown> };

export type HistoryMessage = { role: "user" | "assistant"; content: string };

export async function streamCanvas(
  body: { history: HistoryMessage[]; prompt: string; canvas: unknown; image: string | null; paper?: { name: string; data: string } | null },
  onEvent: (ev: StreamEvent) => void,
  signal: AbortSignal,
) {
  const res = await fetch("/api/canvas", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal,
  });
  if (!res.ok || !res.body) throw new Error(`Server error ${res.status}: ${await res.text().catch(() => "")}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) { try { onEvent(JSON.parse(line)); } catch { /* ignore */ } }
    }
  }
}

/** Turns Claude's streamed NDJSON text into ops and runs them sequentially. */
export class OpQueue {
  private buf = "";
  private q: CanvasOp[] = [];
  private running: Promise<void> | null = null;
  count = 0;

  constructor(private applier: CanvasApplier) {}

  feed(text: string) {
    this.buf += text;
    let i: number;
    while ((i = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, i);
      this.buf = this.buf.slice(i + 1);
      this.pushLine(line);
    }
  }

  flush() {
    if (this.buf.trim()) this.pushLine(this.buf);
    this.buf = "";
  }

  private pushLine(line: string) {
    const l = line.trim();
    if (!l || l.startsWith("```")) return;
    try {
      const op = JSON.parse(l);
      if (op && typeof op.op === "string") { this.q.push(op); this.count++; this.kick(); }
    } catch { console.warn("[vizai] skipped non-JSON line:", l); }
  }

  private kick() {
    if (this.running) return;
    this.running = (async () => {
      while (this.q.length) {
        const op = this.q.shift()!;
        try { await this.applier.apply(op); } catch (e) { console.error("[vizai] op failed", op, e); }
      }
      this.running = null;
    })();
  }

  /** Drop everything not yet applied (the op in flight still finishes). */
  cancel() { this.q.length = 0; this.buf = ""; }

  async drain() { while (this.running) await this.running; }
}
