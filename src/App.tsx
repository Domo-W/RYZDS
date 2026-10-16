import React, { useCallback, useEffect, useRef, useState } from "react";
import { Tldraw, type Editor, type TLComponents } from "tldraw";
import { CanvasApplier } from "./canvas/apply";
import { ClaudePresence } from "./canvas/presence";
import { describeCanvas, exportCanvasPng } from "./canvas/snapshot";
import { OpQueue, streamCanvas, type HistoryMessage } from "./lib/stream";
import mascot from "./Icon-Mascot.png";
import { CURSOR_PAPER_DEMO, DEMOS, EXPERIMENT_DEMO, PAGE_EXCERPTS, PAPER_DEMO, type Demo } from "./demos";
import { PaperPanel, type Paper } from "./ui/PaperPanel";
import type { CanvasOp } from "./canvas/ops";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Status = "idle" | "thinking" | "drawing";
type LogItem = { role: "user" | "claude"; text: string; id: number };

type Ping =
  | { mode: "arm" }
  | { mode: "wheel"; sx: number; sy: number; px: number; py: number; near: string[] };

const PING_OPTIONS = [
  { label: "Explain", prompt: "Explain what is here in more depth" },
  { label: "Expand", prompt: "Expand on this with more detail" },
  { label: "Example", prompt: "Give a concrete example of this, drawn right next to it" },
  { label: "Simplify", prompt: "Simplify this: redraw it in a clearer, simpler way" },
  { label: "Label it", prompt: "Label and annotate what is here" },
  { label: "Why?", prompt: "Explain why this works and why it matters" },
];

// Keep the canvas calm: only the bottom toolbar from tldraw's UI.
const TL_COMPONENTS: TLComponents = {
  MenuPanel: null, StylePanel: null, HelpMenu: null, NavigationPanel: null, PageMenu: null,
  DebugPanel: null, DebugMenu: null, SharePanel: null, TopPanel: null,
};

const SUGGESTIONS = [
  "Explain how a neural network learns, visually",
  "Draw how HTTPS works, step by step",
];

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const applierRef = useRef<CanvasApplier | null>(null);
  const historyRef = useRef<HistoryMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [thought, setThought] = useState("");
  const [modelLabel, setModelLabel] = useState("");
  const [ping, setPing] = useState<Ping | null>(null);
  const [demoStage, setDemoStage] = useState<number | null>(null);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [paperOpen, setPaperOpen] = useState(false);
  const [paperPage, setPaperPage] = useState(1);
  const [reading, setReading] = useState(false);
  const skipRef = useRef<(() => void) | null>(null);
  const skipFlag = useRef(false);
  const demoAbort = useRef(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const togglePause = () => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); if (applierRef.current) applierRef.current.paused = pausedRef.current; };
  const [log, setLog] = useState<LogItem[]>([]);
  const [prompt, setPrompt] = useState("");
  const [seeCanvas, setSeeCanvas] = useState(true);
  const [health, setHealth] = useState<{ hasKey: boolean; model: string } | null>(null);
  const logId = useRef(0);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({ hasKey: false, model: "?" }));
  }, []);

  // Load the sample paper so the panel is ready for the demo.
  useEffect(() => {
    fetch("/sample.pdf").then((r) => r.blob()).then((blob) => new Promise<string>((res, rej) => {
      const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(blob);
    })).then((dataUrl) => {
      setPaper({ name: "Reading with Local Explanations.pdf", url: "/sample.pdf", data: dataUrl.split(",")[1] ?? "" });
      setPaperOpen(true);
    }).catch(() => {});
  }, []);

  const loadPaperFile = useCallback((file: File) => {
    const fr = new FileReader();
    fr.onload = () => {
      setPaper({ name: file.name, url: URL.createObjectURL(file), data: String(fr.result).split(",")[1] ?? "" });
      setPaperOpen(true); setPaperPage(1);
    };
    fr.readAsDataURL(file);
  }, []);

  const pushLog = useCallback((role: LogItem["role"], text: string) => {
    setLog((l) => [...l.slice(-30), { role, text, id: ++logId.current }]);
  }, []);

  const onMount = useCallback((ed: Editor) => {
    setEditor(ed);
    applierRef.current = new CanvasApplier(ed, new ClaudePresence(ed), (t) => pushLog("claude", t));
  }, [pushLog]);

  const send = useCallback(async (text: string) => {
    const applier = applierRef.current;
    if (!editor || !applier || status !== "idle" || !text.trim()) return;
    setPrompt("");
    pushLog("user", text);
    setStatus("thinking");
    setThought("");
    setModelLabel("");
    const withPaper = paperOpen && !!paper;
    setReading(withPaper);
    const canvas = describeCanvas(editor);
    let image: string | null = null;
    if (seeCanvas) { try { image = await exportCanvasPng(editor); } catch (e) { console.warn("export failed", e); } }
    const ac = new AbortController();
    abortRef.current = ac;
    const queue = new OpQueue(applier);
    let raw = "", thinking = "", drawing = false;
    applier.beginTurn();
    try {
      await streamCanvas({ history: historyRef.current, prompt: text, canvas, image, paper: withPaper ? { name: paper.name, data: paper.data } : null }, (ev) => {
        if (ev.t === "meta") setModelLabel(ev.label);
        else if (ev.t === "thinking") { thinking += ev.text; setThought(thinking.slice(-140)); }
        else if (ev.t === "text") { if (!drawing) { drawing = true; setStatus("drawing"); setReading(false); } raw += ev.text; queue.feed(ev.text); }
        else if (ev.t === "error") pushLog("claude", "⚠️ " + ev.message);
      }, ac.signal);
      queue.flush();
      await queue.drain();
      historyRef.current.push({ role: "user", content: text }, { role: "assistant", content: raw.trim() || '{"op":"say","text":"(no output)"}' });
    } catch (e) {
      if (!ac.signal.aborted) pushLog("claude", "⚠️ " + (e instanceof Error ? e.message : String(e)));
    } finally {
      await applier.finishTurn();
      setStatus("idle");
      setThought("");
      setReading(false);
      abortRef.current = null;
    }
  }, [editor, status, seeCanvas, pushLog, paper, paperOpen]);

  /** Plays a pre-recorded explanation through the same choreography, no API needed. */
  const runDemo = useCallback(async (demo: Demo) => {
    const applier = applierRef.current;
    if (!editor || !applier || status !== "idle") return;
    pushLog("user", demo.title);
    setStatus("drawing");
    setModelLabel("Demo");
    const queue = new OpQueue(applier);
    applier.beginTurn();
    try {
      for (const op of demo.ops) queue.feed(JSON.stringify(op) + "\n");
      await queue.drain();
      historyRef.current.push({ role: "user", content: demo.title }, { role: "assistant", content: demo.ops.map((o) => JSON.stringify(o)).join("\n") });
    } finally {
      await applier.finishTurn();
      setStatus("idle");
    }
  }, [editor, status, pushLog]);

  /** Plays ops through the live choreography; resolves early when Skip is pressed. */
  const playOps = useCallback(async (ops: CanvasOp[]) => {
    const applier = applierRef.current!;
    const queue = new OpQueue(applier);
    applier.beginTurn();
    skipFlag.current = false;
    const skipped = new Promise<void>((resolve) => { skipRef.current = () => { skipFlag.current = true; queue.cancel(); resolve(); }; });
    for (const op of ops) queue.feed(JSON.stringify(op) + "\n");
    await Promise.race([queue.drain(), skipped]);
    skipRef.current = null;
    await applier.finishTurn();
  }, []);

  const skippableSleep = async (ms: number) => {
    let left = ms;
    while (left > 0 && !skipFlag.current && !demoAbort.current) { await sleep(100); if (!pausedRef.current) left -= 100; }
  };
  const skip = () => { skipFlag.current = true; skipRef.current?.(); };

  /** Types a prompt into the box so the audience sees what is being asked. */
  const typePrompt = async (text: string) => {
    for (let i = 1; i <= text.length && !skipFlag.current && !demoAbort.current; i++) { setPrompt(text.slice(0, i)); await sleep(22); }
    await sleep(500);
    setPrompt("");
  };

  /** The 3-stage presentation demo: two drawings, then the cursor ping. No API calls. */
  const runStagedDemo = useCallback(async () => {
    const ed = editor;
    const applier = applierRef.current;
    if (!ed || !applier || status !== "idle") return;
    setStatus("drawing");
    setModelLabel("Demo");
    demoAbort.current = false;
    try {
      // Stage 1: read the paper on the left, then explain it.
      setDemoStage(0); pushLog("user", "Explain this research paper to me");
      setPaperOpen(true);
      await typePrompt("Explain this research paper to me");
      setReading(true); skipFlag.current = false;
      await playOps([{ op: "clear" }]);
      for (const pg of [1, 2, 3]) {
        setPaperPage(pg); await skippableSleep(1200);
        if (skipFlag.current || demoAbort.current) break;
        await playOps(PAGE_EXCERPTS[pg - 1]);
        await skippableSleep(500);
        if (skipFlag.current || demoAbort.current) break;
      }
      setReading(false); setPaperPage(1);
      if (!demoAbort.current) await playOps(PAPER_DEMO);
      if (demoAbort.current) return;
      // Stage 2: draw the experiment design from the paper.
      setDemoStage(1); pushLog("user", "Draw how the experiment was run, step by step");
      await typePrompt("Draw how the experiment was run, step by step");
      await playOps(EXPERIMENT_DEMO);
      if (demoAbort.current) return;
      // Stage 3: ping the flaw and ask why.
      setDemoStage(2); pushLog("user", "⌖ Ping the “fixed order” note → Explain");
      skipFlag.current = false;
      const target = ed.getShapePageBounds(applier.idFor("ex_n1"));
      if (target) {
        ed.zoomToBounds(target, { inset: 260, targetZoom: 1.2, animation: { duration: 800 } });
        await skippableSleep(1000);
        const scr = ed.pageToScreen({ x: target.midX, y: target.midY });
        const crect = ed.getContainer().getBoundingClientRect();
        if (!skipFlag.current) setPing({ mode: "wheel", sx: scr.x - crect.left, sy: scr.y - crect.top, px: Math.round(target.midX), py: Math.round(target.midY), near: ["ex_n1"] });
        await skippableSleep(2200);
        setPing(null);
      }
      if (!demoAbort.current) await playOps(CURSOR_PAPER_DEMO);
    } finally {
      setDemoStage(null);
      setPing(null);
      setReading(false);
      pausedRef.current = false; setPaused(false); if (applierRef.current) applierRef.current.paused = false;
      setStatus("idle");
    }
  }, [editor, status, pushLog, playOps]);

  const stop = () => { if (demoStage !== null) { demoAbort.current = true; skip(); } else abortRef.current?.abort(); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPing(null);
      if (e.key.toLowerCase() === "p" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setPing((p) => (p ? null : { mode: "arm" })); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onPingClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor) return;
    const page = editor.screenToPage({ x: e.clientX, y: e.clientY });
    const near = editor.getShapesAtPoint(page, { hitInside: true, margin: 48 }).map((s) => s.id.replace(/^shape:/, ""));
    const rect = e.currentTarget.getBoundingClientRect();
    setPing({ mode: "wheel", sx: e.clientX - rect.left, sy: e.clientY - rect.top, px: Math.round(page.x), py: Math.round(page.y), near });
  };

  const firePing = (prompt: string) => {
    if (!ping || ping.mode !== "wheel") return;
    const target = ping.near.length ? `these shapes: ${ping.near.join(", ")}` : `the empty area around canvas point (${ping.px}, ${ping.py})`;
    setPing(null);
    void send(`${prompt}. Target: ${target}. Keep new content near that spot.`);
  };
  const empty = log.length === 0;
  const chips = paperOpen && paper ? ["Explain this research paper to me", ...SUGGESTIONS] : SUGGESTIONS;

  return (
    <div className="app">
      {paperOpen && (
        <PaperPanel paper={paper} page={paperPage} reading={reading} onLoad={loadPaperFile} onClose={() => setPaperOpen(false)} />
      )}
      <div className="stage">
      <Tldraw onMount={onMount} components={TL_COMPONENTS} />
      <div className="overlay">
        {health && !health.hasKey && (
          <div className="banner">Demo mode — add ANTHROPIC_API_KEY to go live</div>
        )}
        <form className={`promptbar glass ${status !== "idle" ? "busy" : ""}`} onSubmit={(e) => { e.preventDefault(); void send(prompt); }}>
          <img className="mascot" src={mascot} alt="" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={status === "idle" ? "Ask anything — Marg will explain it on the canvas…" : "Marg is on the canvas…"}
            disabled={status !== "idle"}
            autoFocus
          />
          <button type="button" className={`icon-btn ${paperOpen ? "on" : ""}`} title="Show / hide the research paper" onClick={() => setPaperOpen((v) => !v)}>📄</button>
          {demoStage !== null && (
            <>
              <button type="button" className={`icon-btn ${paused ? "on" : ""}`} onClick={togglePause} title={paused ? "Resume demo" : "Pause demo"}>{paused ? "▶" : "⏸"}</button>
              <button type="button" className="icon-btn" onClick={skip} title="Skip to next stage">⏭</button>
            </>
          )}
          {status === "idle"
            ? <button type="submit" className="go" disabled={!prompt.trim()} aria-label="Send">↑</button>
            : <button type="button" className="stop" onClick={stop} aria-label="Stop">■</button>}
        </form>
        {ping?.mode === "arm" && status === "idle" && (
          <div className="status glass arm"><span className="dot" /><span className="txt">Click a spot on the canvas to ask about it · Esc to cancel</span></div>
        )}
        {ping && (status === "idle" || demoStage !== null) && (
          <div className="ping-capture" onClick={ping.mode === "arm" ? onPingClick : () => setPing(null)}>
            {ping.mode === "wheel" && (
              <div className="wheel" style={{ left: ping.sx, top: ping.sy }} onClick={(e) => e.stopPropagation()}>
                <span className="center" />
                {PING_OPTIONS.map((o, i) => {
                  const a = (i / PING_OPTIONS.length) * Math.PI * 2 - Math.PI / 2;
                  return (
                    <button key={o.label} className="glass" style={{ left: Math.cos(a) * 84, top: Math.sin(a) * 84, animationDelay: `${i * 35}ms` }}
                      onClick={() => firePing(o.prompt)}>{o.label}</button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {status !== "idle" && (
          <div className={`status glass ${status}`}>
            <span className="dot" />
            <span className="txt">{reading && paper ? `Marg is reading ${paper.name}…` : status === "thinking" ? `Marg${modelLabel ? ` · ${modelLabel}` : ""} is thinking…${thought ? ` ${thought}` : ""}` : `Marg${modelLabel ? ` · ${modelLabel}` : ""} is drawing…`}</span>
          </div>
        )}
        {empty && status === "idle" && (
          <div className="suggestions">
            <img className="mascot-hero" src={mascot} alt="Marg" />
            <h1>Ask. Watch it explain.</h1>
            <p>Meet Marg — an AI that thinks on a canvas instead of a chat box.</p>
            <div className="chips demos">
              <button className="glass demo big" onClick={() => void runStagedDemo()}>▶ Play the demo</button>
            </div>
            <div className="chips">
              {chips.map((s) => <button key={s} className="glass" onClick={() => void send(s)}>{s}</button>)}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
