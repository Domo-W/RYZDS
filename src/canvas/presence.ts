import { Editor, InstancePresenceRecordType, type TLInstancePresence } from "tldraw";

/** A fake collaborator cursor named "Claude" that glides to wherever Claude is drawing. */
export class ClaudePresence {
  private id = InstancePresenceRecordType.createId();
  private pos = { x: 0, y: 0 };
  private raf = 0;
  private sayTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private editor: Editor) {}

  private put(partial: Partial<TLInstancePresence>) {
    const existing = this.editor.store.get(this.id) as TLInstancePresence | undefined;
    const base =
      existing ??
      InstancePresenceRecordType.create({
        id: this.id,
        currentPageId: this.editor.getCurrentPageId(),
        userId: "user:claude" as TLInstancePresence["userId"],
        userName: "✦ Claude",
        color: "#D97757",
        cursor: { x: this.pos.x, y: this.pos.y, type: "default", rotation: 0 },
        chatMessage: "",
        lastActivityTimestamp: Date.now(),
      });
    this.editor.store.put([
      { ...base, ...partial, currentPageId: this.editor.getCurrentPageId(), lastActivityTimestamp: Date.now() },
    ]);
  }

  /** Glide the cursor to a page-space point. */
  moveTo(x: number, y: number, duration = 350) {
    cancelAnimationFrame(this.raf);
    const from = { ...this.pos };
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      this.pos = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
      this.put({ cursor: { x: this.pos.x, y: this.pos.y, type: "default", rotation: 0 } });
      if (t < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  say(text: string) {
    this.put({ chatMessage: text });
    if (this.sayTimer) clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => this.put({ chatMessage: "" }), 7000);
  }

  hide() {
    cancelAnimationFrame(this.raf);
    if (this.editor.store.has(this.id)) this.editor.store.remove([this.id]);
  }
}
