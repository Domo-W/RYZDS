import React, { useCallback, useEffect, useRef, useState } from "react";
import { Tldraw, type Editor } from "tldraw";
import { CanvasApplier } from "./canvas/apply";
import { ClaudePresence } from "./canvas/presence";
import { describeCanvas, exportCanvasPng } from "./canvas/snapshot";
import { OpQueue, streamCanvas, type HistoryMessage } from "./lib/stream";

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

const SUGGESTIONS = [
  "Explain how a neural network learns, visually",
  "Plan a 3-day trip to Tokyo as a map of days",
  "Sketch the login flow for a mobile app",
  "Compare React vs Vue in a diagram",
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
  const [log, setLog] = useState<LogItem[]>([]);
  const [prompt, setPrompt] = useState("");
  const [seeCanvas, setSeeCanvas] = useState(true);
  const [health, setHealth] = useState<{ hasKey: boolean; model: string } | null>(null);
  const logId = useRef(0);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({ hasKey: false, model: "?" }));
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
    const canvas = describeCanvas(editor);
    let image: string | null = null;
    if (seeCanvas) { try { image = await exportCanvasPng(editor); } catch (e) { console.warn("export failed", e); } }
    const ac = new AbortController();
    abortRef.current = ac;
    const queue = new OpQueue(applier);
    let raw = "", thinking = "", drawing = false;
    applier.beginTurn();
    try {
      await streamCanvas({ history: historyRef.current, prompt: text, canvas, image }, (ev) => {
        if (ev.t === "meta") setModelLabel(ev.label);
        else if (ev.t === "thinking") { thinking += ev.text; setThought(thinking.slice(-140)); }
        else if (ev.t === "text") { if (!drawing) { drawing = true; setStatus("drawing"); } raw += ev.text; queue.feed(ev.text); }
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
      abortRef.current = null;
    }
  }, [editor, status, seeCanvas, pushLog]);

  const stop = () => abortRef.current?.abort();

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
    setPing({ mode: "wheel", sx: e.clientX, sy: e.clientY, px: Math.round(page.x), py: Math.round(page.y), near });
  };

  const firePing = (prompt: string) => {
    if (!ping || ping.mode !== "wheel") return;
    const target = ping.near.length ? `these shapes: ${ping.near.join(", ")}` : `the empty area around canvas point (${ping.px}, ${ping.py})`;
    setPing(null);
    void send(`${prompt}. Target: ${target}. Keep new content near that spot.`);
  };
  const says = log.filter((l) => l.role === "claude").slice(-4);
  const empty = log.length === 0;

  return (
    <div className="app">
      <Tldraw onMount={onMount} />
      <div className="overlay">
        {health && !health.hasKey && (
          <div className="banner">No ANTHROPIC_API_KEY set — running the built-in demo script. Add a key to <code>.env</code> and restart.</div>
        )}
        <form className={`promptbar glass ${status !== "idle" ? "busy" : ""}`} onSubmit={(e) => { e.preventDefault(); void send(prompt); }}>
          <span className="logo">VizAI</span>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={status === "idle" ? "Ask anything — Claude will explain it on the canvas…" : "Claude is on the canvas…"}
            disabled={status !== "idle"}
            autoFocus
          />
          <button type="button" className={`ping-btn ${ping ? "on" : ""}`} title="Ping: click a spot on the canvas and ask about it (⌘P)"
            onClick={() => setPing((p) => (p ? null : { mode: "arm" }))} disabled={status !== "idle"}>⌖</button>
          <label className="toggle" title="Send a screenshot of the canvas so Claude can see what you drew">
            <input type="checkbox" checked={seeCanvas} onChange={(e) => setSeeCanvas(e.target.checked)} /> 👁
          </label>
          {status === "idle"
            ? <button type="submit" disabled={!prompt.trim()}>Go</button>
            : <button type="button" className="stop" onClick={stop}>Stop</button>}
        </form>
        {ping?.mode === "arm" && status === "idle" && (
          <div className="status glass arm"><span className="dot" /><span className="txt">Click a spot on the canvas to ask about it · Esc to cancel</span></div>
        )}
        {ping && status === "idle" && (
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
            <span className="txt">{status === "thinking" ? (thought ? `${modelLabel || "Claude"} is thinking… ${thought}` : `${modelLabel || "Claude"} is thinking…`) : `${modelLabel || "Claude"} is drawing…`}</span>
          </div>
        )}
        {empty && status === "idle" && (
          <div className="suggestions">
            <h1>Ask. Watch it explain.</h1>
            <p>An AI that thinks on a canvas instead of a chat box.</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => <button key={s} className="glass" onClick={() => void send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {says.length > 0 && (
          <div className="says">
            {says.map((s, i) => <div key={s.id} className={`say glass ${i === says.length - 1 ? "latest" : ""}`}>{s.text}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
