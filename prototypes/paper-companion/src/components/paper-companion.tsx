"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Crop,
  FileText,
  Languages,
  ListChecks,
  Lightbulb,
  MessageCircle,
  Settings2,
  Sparkles,
  Square,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Markdown from "react-markdown";
import ReaderSettings, { type SettingsTab } from "./reader-settings";
import {
  defaultPreferences,
  preferencesSchema,
  keyboardBinding,
  shortcutLabel,
  type Preferences,
} from "@/lib/preferences";

type Rect = { x: number; y: number; w: number; h: number };
type Source = {
  page: number;
  text: string;
  pageText: string;
  image: string;
  kind: string;
  rect: Rect;
};
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: string;
  source: Source;
  prompt?: string;
};
type Anchor = { x: number; y: number };
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const actionIcons = [Languages, Crop, Lightbulb, ListChecks];
function Mascot({
  small = false,
  thinking = false,
}: {
  small?: boolean;
  thinking?: boolean;
}) {
  return (
    <span
      className={`mascot ${small ? "small" : ""} ${thinking ? "thinking" : ""}`}
      aria-hidden="true"
    >
      <i />
      <i />
      <b />
    </span>
  );
}

export default function Home() {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const originalPaper = useRef<File | null>(null);
  const paperAttachment = useRef<{ fileId: string; expiresAt: number } | null>(
    null,
  );
  const [preparingPaper, setPreparingPaper] = useState(false);
  const [paperAttached, setPaperAttached] = useState(false);
  const [filename, setFilename] = useState("");
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [preferences, setPreferences] =
    useState<Preferences>(defaultPreferences);
  const hoverOn = preferences.hover;
  const actions = preferences.actions;
  const [sessionKey, setSessionKey] = useState("");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("controls");
  const [regionMode, setRegionMode] = useState(false);
  const [highlight, setHighlight] = useState<Rect | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [anchor, setAnchor] = useState<Anchor>({ x: 400, y: 300 });
  const [wheel, setWheel] = useState(false);
  const [bubble, setBubble] = useState(false);
  const [panel, setPanel] = useState(false);
  const [settings, setSettings] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pageSize, setPageSize] = useState({ width: 760, height: 980 });
  const [fitWidth, setFitWidth] = useState(760);
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const uploadId = useRef(0);
  const pageText = useRef("");
  const pointer = useRef<Anchor | null>(null);
  const dragStart = useRef<Anchor | null>(null);
  const ready = useRef(false);
  const hoverCandidate = useRef<Rect | null>(null);
  const selectedTarget = useRef<Source | null>(null);
  const latest = messages.filter((m) => m.role === "assistant").at(-1);
  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const closeFloating = useCallback(() => {
    clearTimer();
    setWheel(false);
    setBubble(false);
    setHighlight(null);
    pointer.current = null;
    hoverCandidate.current = null;
    selectedTarget.current = null;
  }, [clearTimer]);
  const stopRequest = useCallback(() => {
    ++requestId.current;
    abort.current?.abort();
    setBusy(false);
    setPreparingPaper(false);
  }, []);

  useEffect(() => {
    const refresh = () =>
      fetch("/api/status")
        .then((r) => r.json() as Promise<{ configured: boolean }>)
        .then((d) => setConfigured(d.configured))
        .catch(() => setConfigured(false));
    refresh();
    window.addEventListener("focus", refresh);
    try {
      const saved = localStorage.getItem("margin-preferences-v3");
      if (saved) {
        const result = preferencesSchema.safeParse(JSON.parse(saved));
        if (result.success) setPreferences(result.data);
      } else {
        const legacy = localStorage.getItem("margin-preferences-v2");
        if (legacy) {
          const result = preferencesSchema.safeParse(JSON.parse(legacy));
          if (result.success) {
            const extras = result.data.actions
              .filter(
                (a) =>
                  !defaultPreferences.actions.some(
                    (d) => d.label === a.label && d.prompt === a.prompt,
                  ),
              )
              .map((a) => ({ ...a, id: crypto.randomUUID(), enabled: false }));
            const next = {
              ...result.data,
              actions: [
                ...structuredClone(defaultPreferences.actions),
                ...extras,
              ],
            };
            setPreferences(next);
            localStorage.setItem("margin-preferences-v3", JSON.stringify(next));
          }
        }
      }
    } catch {}
    return () => {
      window.removeEventListener("focus", refresh);
      clearTimer();
      abort.current?.abort();
    };
  }, [clearTimer]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, panel]);
  useEffect(() => {
    const element = scrollArea.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setFitWidth(
        Math.min(
          760,
          Math.max(
            300,
            element.clientWidth - (window.innerWidth < 720 ? 32 : 72),
          ),
        ),
      ),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [pdf]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (settings || event.isComposing || event.repeat) return;
      if (event.key === "Escape") {
        closeFloating();
        setRegionMode(false);
        return;
      }
      const element = event.target as HTMLElement;
      if (element.closest('input, textarea, select, [contenteditable="true"]'))
        return;
      if (keyboardBinding(event) === preferences.shortcut) {
        event.preventDefault();
        if (wheel) closeFloating();
        else openWheel();
        return;
      }
      if (wheel && !event.altKey && !event.ctrlKey && !event.metaKey) {
        const action = actions.find(
          (a) =>
            a.enabled && a.shortcut.toLowerCase() === event.key.toLowerCase(),
        );
        if (action) {
          event.preventDefault();
          void runAction(action);
        }
      }
    };
    window.addEventListener("keydown", key);
    window.addEventListener("resize", closeFloating);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", closeFloating);
    };
  });

  async function loadPDF(file: File) {
    const id = ++uploadId.current;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError("This prototype supports PDFs up to 30 MB.");
      return;
    }
    stopRequest();
    closeFloating();
    setLoading(true);
    setError("");
    setSource(null);
    setMessages([]);
    ready.current = false;
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const document = await pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        cMapUrl: "/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/standard_fonts/",
        wasmUrl: "/wasm/",
      }).promise;
      if (id !== uploadId.current) {
        await document.destroy();
        return;
      }
      originalPaper.current = file;
      paperAttachment.current = null;
      setPaperAttached(false);
      const previous = pdf;
      setPdf(document);
      setFilename(file.name);
      setPage(1);
      setZoom(1);
      setRegionMode(false);
      if (previous) await previous.destroy();
    } catch (e) {
      if (id === uploadId.current)
        setError(
          e instanceof Error && e.name === "PasswordException"
            ? "This PDF is password-protected. Unlock it before uploading."
            : "Could not open this PDF. Please check the file and try again.",
        );
    } finally {
      if (id === uploadId.current) setLoading(false);
    }
  }
  async function loadSample() {
    try {
      setLoading(true);
      const r = await fetch("/sample.pdf");
      if (!r.ok) throw Error();
      await loadPDF(
        new File(
          [await r.blob()],
          "Reading with Local Explanations - Demo.pdf",
          { type: "application/pdf" },
        ),
      );
    } catch {
      setError("Could not load the sample. Please upload your own PDF.");
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!pdf || !canvas.current || !layer.current) return;
    let cancelled = false;
    let renderTask:
      | { cancel: () => void; promise: Promise<unknown> }
      | undefined;
    let textLayer:
      | { cancel: () => void; render: () => Promise<void> }
      | undefined;
    ready.current = false;
    setRendering(true);
    setError("");
    closeFloating();
    (async () => {
      const p = await pdf.getPage(page);
      const pdfjs = await import("pdfjs-dist");
      if (cancelled || !canvas.current || !layer.current) return;
      const base = p.getViewport({ scale: 1 });
      const viewport = p.getViewport({ scale: (fitWidth / base.width) * zoom });
      setPageSize({ width: viewport.width, height: viewport.height });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const c = canvas.current;
      c.width = Math.floor(viewport.width * ratio);
      c.height = Math.floor(viewport.height * ratio);
      c.style.width = `${viewport.width}px`;
      c.style.height = `${viewport.height}px`;
      layer.current.replaceChildren();
      layer.current.style.setProperty("--scale-factor", String(viewport.scale));
      layer.current.style.setProperty(
        "--total-scale-factor",
        String(viewport.scale),
      );
      renderTask = p.render({
        canvas: c,
        viewport,
        transform: [ratio, 0, 0, ratio, 0, 0],
      });
      const text = await p.getTextContent();
      if (cancelled) return;
      pageText.current = text.items
        .map((item) =>
          "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
        )
        .join("")
        .slice(0, 24000);
      textLayer = new pdfjs.TextLayer({
        textContentSource: text,
        container: layer.current!,
        viewport,
      });
      await Promise.all([renderTask.promise, textLayer.render()]);
      if (!cancelled) {
        ready.current = true;
        setRendering(false);
      }
    })().catch((e) => {
      if (!cancelled && e?.name !== "RenderingCancelledException") {
        setError("Could not render this page. Switch pages and try again.");
        setRendering(false);
      }
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, page, zoom, fitWidth, closeFloating]);

  function normalized(r: DOMRect): Rect {
    const bounds = paper.current!.getBoundingClientRect();
    return {
      x: clamp((r.left - bounds.left) / bounds.width, 0, 1),
      y: clamp((r.top - bounds.top) / bounds.height, 0, 1),
      w: Math.min(r.width / bounds.width, 1),
      h: Math.min(r.height / bounds.height, 1),
    };
  }
  function textInside(rect: Rect) {
    if (!layer.current || !paper.current) return "";
    return Array.from(layer.current.querySelectorAll("span"))
      .filter((s) => {
        const r = normalized(s.getBoundingClientRect());
        const cx = r.x + r.w / 2,
          cy = r.y + r.h / 2;
        return (
          cx >= rect.x &&
          cx <= rect.x + rect.w &&
          cy >= rect.y &&
          cy <= rect.y + rect.h
        );
      })
      .map((s) => s.textContent)
      .join(" ")
      .slice(0, 16000);
  }
  function snapshot(rect: Rect) {
    const c = canvas.current!;
    const clip = document.createElement("canvas");
    const width = Math.max(1, rect.w * c.width);
    const height = Math.max(1, rect.h * c.height);
    const scale = Math.min(1, 1600 / Math.max(width, height));
    clip.width = Math.round(width * scale);
    clip.height = Math.round(height * scale);
    clip
      .getContext("2d")!
      .drawImage(
        c,
        rect.x * c.width,
        rect.y * c.height,
        width,
        height,
        0,
        0,
        clip.width,
        clip.height,
      );
    return clip.toDataURL("image/jpeg", 0.88);
  }
  function activate(
    rect: Rect,
    point: Anchor,
    kind: string,
    selectedText?: string,
    open = true,
  ) {
    if (!ready.current) return;
    clearTimer();
    window.getSelection()?.removeAllRanges();
    const bounded = {
      x: clamp(rect.x, 0, 0.99),
      y: clamp(rect.y, 0, 0.99),
      w: Math.min(rect.w, 1 - rect.x),
      h: Math.min(rect.h, 1 - rect.y),
    };
    const captured = {
      page,
      text: selectedText || textInside(bounded),
      pageText: pageText.current,
      image: snapshot(bounded),
      kind,
      rect: bounded,
    };
    setSource(captured);
    selectedTarget.current = open ? null : captured;
    setHighlight(bounded);
    setAnchor({
      x: clamp(point.x, 165, window.innerWidth - 165),
      y: clamp(point.y, 190, window.innerHeight - 190),
    });
    setWheel(open);
    setBubble(false);
  }
  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStart.current && regionMode) {
      const r = paper.current!.getBoundingClientRect();
      const end = {
        x: clamp((event.clientX - r.left) / r.width, 0, 1),
        y: clamp((event.clientY - r.top) / r.height, 0, 1),
      };
      const start = dragStart.current;
      setHighlight({
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        w: Math.abs(end.x - start.x),
        h: Math.abs(end.y - start.y),
      });
      return;
    }
    if (
      !ready.current ||
      wheel ||
      bubble ||
      regionMode ||
      event.buttons ||
      selectedTarget.current ||
      window.getSelection()?.toString()
    ) {
      clearTimer();
      return;
    }
    const target = event.target as HTMLElement;
    const bounds = paper.current!.getBoundingClientRect();
    let rect: Rect;
    if (target.tagName === "SPAN" && layer.current?.contains(target)) {
      const hit = normalized(target.getBoundingClientRect());
      // A compact same-column excerpt, not a claim of semantic paragraph detection.
      const spans = Array.from(layer.current.querySelectorAll("span"))
        .map((s) => normalized(s.getBoundingClientRect()))
        .filter(
          (r) =>
            r.w > 0 &&
            Math.abs(r.y - hit.y) < 0.033 &&
            Math.min(r.x + r.w, hit.x + hit.w) - Math.max(r.x, hit.x) > 0,
        );
      const left = Math.min(...spans.map((r) => r.x), hit.x),
        top = Math.min(...spans.map((r) => r.y), hit.y);
      rect = {
        x: Math.max(0, left - 0.005),
        y: Math.max(0, top - 0.004),
        w: Math.min(
          1 - left,
          Math.max(...spans.map((r) => r.x + r.w), hit.x + hit.w) - left + 0.01,
        ),
        h: Math.min(
          1 - top,
          Math.max(...spans.map((r) => r.y + r.h), hit.y + hit.h) - top + 0.008,
        ),
      };
    } else {
      const x = (event.clientX - bounds.left) / bounds.width,
        y = (event.clientY - bounds.top) / bounds.height;
      rect = {
        x: clamp(x - 0.2, 0, 0.6),
        y: clamp(y - 0.12, 0, 0.76),
        w: 0.4,
        h: 0.24,
      };
    }
    hoverCandidate.current = rect;
    setHighlight(rect);
    const point = { x: event.clientX, y: event.clientY };
    if (
      pointer.current &&
      Math.hypot(pointer.current.x - point.x, pointer.current.y - point.y) <
        5 &&
      timer.current
    )
      return;
    clearTimer();
    pointer.current = point;
    if (!hoverOn) return;
    timer.current = setTimeout(
      () =>
        activate(
          rect,
          point,
          target.tagName === "SPAN" ? "Text excerpt" : "Page region",
        ),
      700,
    );
  }
  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    clearTimer();
    selectedTarget.current = null;
    if (wheel || bubble) {
      closeFloating();
      return;
    }
    if (!regionMode || !ready.current) return;
    event.preventDefault();
    const r = paper.current!.getBoundingClientRect();
    dragStart.current = {
      x: (event.clientX - r.left) / r.width,
      y: (event.clientY - r.top) / r.height,
    };
    setHighlight(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
    clearTimer();
    if (regionMode && dragStart.current) {
      dragStart.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (highlight && highlight.w > 0.015 && highlight.h > 0.01) {
        activate(
          highlight,
          { x: event.clientX, y: event.clientY },
          "Select region",
        );
        setRegionMode(false);
      }
      return;
    }
    const selection = window.getSelection();
    if (
      selection &&
      selection.toString().trim() &&
      selection.rangeCount &&
      layer.current?.contains(selection.anchorNode) &&
      layer.current?.contains(selection.focusNode)
    ) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      activate(
        normalized(rect),
        { x: event.clientX, y: event.clientY },
        "Selected text",
        selection.toString().slice(0, 16000),
        hoverOn,
      );
      return;
    }
    // Resume dwell after an ordinary click, just as after pointer movement.
    if (
      hoverOn &&
      !wheel &&
      !bubble &&
      !regionMode &&
      ready.current &&
      hoverCandidate.current
    ) {
      const candidate = hoverCandidate.current;
      const point = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(
        () =>
          activate(
            candidate,
            point,
            textInside(candidate) ? "Text excerpt" : "Page region",
          ),
        700,
      );
    }
  }

  async function ask(
    prompt: string,
    label = prompt,
    target = source,
    history: Message[] = [],
  ) {
    if (!target || busy) return;
    if (!sessionKey && !configured) {
      setWheel(false);
      clearTimer();
      setSettingsTab("connection");
      setSettings(true);
      return;
    }
    clearTimer();
    setWheel(false);
    setBubble(!panel);
    setBusy(true);
    setInput("");
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const id = ++requestId.current;
    const messageId = crypto.randomUUID();
    const user: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: label,
      source: target,
    };
    const assistant: Message = {
      id: messageId,
      role: "assistant",
      content: "",
      source: target,
      prompt,
    };
    setMessages([...history, user, assistant]);
    const update = (delta?: string, error?: string) => {
      if (id === requestId.current)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content: m.content + (delta || ""),
                  error: error || m.error,
                }
              : m,
          ),
        );
    };
    try {
      if (!originalPaper.current)
        throw Error("Upload a paper before asking AI.");
      if (
        !paperAttachment.current ||
        paperAttachment.current.expiresAt <= Date.now() / 1000 + 60
      ) {
        setPreparingPaper(true);
        setPaperAttached(false);
        const form = new FormData();
        form.set("file", originalPaper.current);
        const uploadResponse = await fetch("/api/paper", {
          method: "POST",
          headers: sessionKey ? { "X-OpenAI-Key": sessionKey } : {},
          body: form,
          signal: controller.signal,
        });
        const attachment = (await uploadResponse.json()) as {
          fileId: string;
          expiresAt: number;
          error?: string;
        };
        if (!uploadResponse.ok)
          throw Error(attachment.error || "Could not prepare the full paper.");
        if (id !== requestId.current || controller.signal.aborted) return;
        paperAttachment.current = attachment;
        setPaperAttached(true);
        setPreparingPaper(false);
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionKey ? { "X-OpenAI-Key": sessionKey } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          paperFileId: paperAttachment.current.fileId,
          prompt,
          filename,
          source: target,
          history: history
            .filter((m) => !m.error && m.content)
            .slice(-12)
            .map((m) => ({ role: m.role, content: m.content.slice(0, 12000) })),
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw Error(data.error || "Request failed. Please try again.");
      }
      if (!response.body) throw Error("No response received.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) {
            const data = JSON.parse(line);
            update(data.delta, data.error);
          }
        }
      }
    } catch (e) {
      if (!controller.signal.aborted)
        update(
          undefined,
          e instanceof Error
            ? e.message
            : "Connection interrupted. Please try again.",
        );
    } finally {
      if (id === requestId.current) {
        setBusy(false);
        setPreparingPaper(false);
      }
    }
  }
  function openPanel() {
    setPanel(true);
    setBubble(false);
    setWheel(false);
    clearTimer();
  }
  function changePage(n: number) {
    closeFloating();
    setPage(clamp(n, 1, pdf!.numPages));
    scrollArea.current?.scrollTo({ top: 0 });
  }
  function openSettings(tab: SettingsTab = "controls") {
    clearTimer();
    setWheel(false);
    setBubble(false);
    setSettingsTab(tab);
    setSettings(true);
  }
  function savePreferences(next: Preferences) {
    setPreferences(next);
    clearTimer();
    try {
      localStorage.setItem("margin-preferences-v3", JSON.stringify(next));
    } catch {
      setError("Preferences are active, but this browser could not save them.");
    }
  }
  function runAction(action: Preferences["actions"][number]) {
    return ask(
      action.prompt.replaceAll(
        "{{target_language}}",
        preferences.translationLanguage,
      ),
      action.label,
    );
  }
  function openWheel() {
    if (!actions.some((a) => a.enabled)) {
      openSettings("prompts");
      return;
    }
    if (!ready.current || !paper.current) return;
    const selected = selectedTarget.current;
    const rect = selected?.rect || hoverCandidate.current;
    if (!rect) {
      setError(
        "Point at some text or select a region first, then open the wheel.",
      );
      return;
    }
    setError("");
    const bounds = paper.current.getBoundingClientRect();
    const point = {
      x: bounds.left + (rect.x + rect.w / 2) * bounds.width,
      y: bounds.top + (rect.y + rect.h / 2) * bounds.height,
    };
    activate(
      rect,
      point,
      selected?.kind || (textInside(rect) ? "Text excerpt" : "Page region"),
      selected?.text,
    );
  }
  const highlightStyle = highlight
    ? {
        left: `${highlight.x * 100}%`,
        top: `${highlight.y * 100}%`,
        width: `${highlight.w * 100}%`,
        height: `${highlight.h * 100}%`,
      }
    : {};

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <Mascot small />
          <span>
            margin<span className="brand-dot">.</span>
          </span>
          <span className="prototype">LAB</span>
        </a>
        <div className="file-title">
          {pdf ? (
            <>
              <FileText size={15} />
              <span>{filename}</span>
            </>
          ) : (
            <>
              <span className="quiet-dot" /> Your reading space
            </>
          )}
        </div>
        <div className="header-actions">
          <button
            className={`ai-status ${sessionKey || configured ? "connected" : ""}`}
            onClick={() => openSettings("connection")}
            title="Manage API connection"
          >
            <i />
            {sessionKey
              ? "Session key added"
              : configured
                ? "Server key configured"
                : "Connect AI"}
          </button>
          <button
            className="icon-button"
            title="Settings"
            aria-label="Settings"
            onClick={() => openSettings()}
          >
            <Settings2 size={18} />
          </button>
          <button
            className={`button ${panel ? "active" : ""}`}
            onClick={() => {
              if (panel) setPanel(false);
              else openPanel();
            }}
          >
            <MessageCircle size={16} />
            Chat
          </button>
        </div>
      </header>
      <input
        ref={upload}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        aria-label="Upload PDF"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void loadPDF(file);
          e.target.value = "";
        }}
      />
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className={`workspace ${panel ? "with-panel" : ""}`}>
        <section className="reader">
          {!pdf ? (
            <div
              className="welcome"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) void loadPDF(f);
              }}
            >
              <div className="welcome-eyebrow">
                <span /> A LITTLE COMPANY FOR BIG IDEAS
              </div>
              <h1>
                Stay with the paper.
                <br />
                <em>Let curiosity lead.</em>
              </h1>
              <p className="welcome-copy">
                Point to a thought. Make it click.
                <br />A little help, right where you are reading.
              </p>
              <button
                className={`upload-card ${dragOver ? "dragover" : ""}`}
                disabled={loading}
                onClick={() => upload.current?.click()}
              >
                <div className="upload-symbol">
                  <Upload size={25} />
                </div>
                <strong>
                  {loading ? "Opening your paper…" : "Bring a paper"}
                </strong>
                <span>Drop a PDF here, or click to browse</span>
                <small>PDF · Up to 30 MB</small>
              </button>
              <button
                className="sample-link"
                disabled={loading}
                onClick={loadSample}
              >
                Try a sample paper <ArrowRight size={15} />
              </button>
              <button
                className="setup-entry"
                onClick={() => openSettings("connection")}
              >
                Set up your API key <ArrowRight size={13} />
              </button>
              <div className="steps">
                <span>
                  <b>01</b>Point or select
                </span>
                <span>
                  <b>02</b>Open the wheel
                </span>
                <span>
                  <b>03</b>Keep the conversation going
                </span>
              </div>
              <p className="privacy-note">
                Your PDF opens locally. Asking AI sends the full paper and your
                selected region to OpenAI.
                <br />
                Uploaded AI files expire after 1 hour. Refreshing clears this
                tab’s paper, chat and key.
              </p>
            </div>
          ) : (
            <>
              <div className="reader-toolbar">
                <div className="toolbar-group">
                  <button
                    className="icon-button"
                    title="Upload another paper"
                    aria-label="Upload another paper"
                    onClick={() => upload.current?.click()}
                  >
                    <Upload size={17} />
                  </button>
                  <span className="divider" />
                  <button
                    className="icon-button"
                    aria-label="Previous page"
                    disabled={page === 1 || rendering}
                    onClick={() => changePage(page - 1)}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <label className="page-control">
                    <input
                      aria-label="Page number"
                      type="number"
                      min={1}
                      max={pdf.numPages}
                      value={page}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (n >= 1 && n <= pdf.numPages) changePage(n);
                      }}
                    />
                    <span>/ {pdf.numPages}</span>
                  </label>
                  <button
                    className="icon-button"
                    aria-label="Next page"
                    disabled={page === pdf.numPages || rendering}
                    onClick={() => changePage(page + 1)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
                <div className="toolbar-group">
                  <button
                    className="icon-button"
                    aria-label="Zoom out"
                    disabled={zoom <= 0.7 || rendering}
                    onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="zoom-label">{Math.round(zoom * 100)}%</span>
                  <button
                    className="icon-button"
                    aria-label="Zoom in"
                    disabled={zoom >= 1.6 || rendering}
                    onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
                  >
                    <ZoomIn size={16} />
                  </button>
                  <span className="divider" />
                  <button
                    className={`tool-button ${regionMode ? "selected" : ""}`}
                    onClick={() => {
                      closeFloating();
                      setRegionMode(!regionMode);
                    }}
                  >
                    <Crop size={16} />
                    Select region
                  </button>
                  <button
                    className="tool-button wheel-trigger"
                    onClick={openWheel}
                    title={`Open wheel · ${shortcutLabel(preferences.shortcut)}`}
                  >
                    Open wheel <kbd>{shortcutLabel(preferences.shortcut)}</kbd>
                  </button>
                </div>
              </div>
              <div className="reading-hint">
                <span className="hint-mark">✦</span>
                {regionMode
                  ? "Drag a box around a figure, equation or passage."
                  : (hoverOn
                      ? "Hover for 0.7 seconds or use "
                      : "Point or select, then press ") +
                    shortcutLabel(preferences.shortcut) +
                    " · Esc to close"}
                <span className="hint-right">
                  {rendering || loading
                    ? "Rendering…"
                    : preparingPaper
                      ? "Preparing full paper for AI…"
                      : paperAttached
                        ? "Full paper attached for AI"
                        : "Full paper ready · sent when you ask"}
                </span>
              </div>
              <div
                className="paper-scroll"
                ref={scrollArea}
                onScroll={closeFloating}
              >
                <div
                  className={`paper ${regionMode ? "region-mode" : ""}`}
                  ref={paper}
                  style={{ width: pageSize.width, height: pageSize.height }}
                  onPointerMove={move}
                  onPointerDown={pointerDown}
                  onPointerUp={pointerUp}
                  onPointerCancel={() => {
                    dragStart.current = null;
                    setHighlight(null);
                  }}
                  onPointerLeave={() => {
                    clearTimer();
                    pointer.current = null;
                    if (
                      !wheel &&
                      !bubble &&
                      !dragStart.current &&
                      !selectedTarget.current
                    )
                      setHighlight(null);
                  }}
                >
                  <canvas ref={canvas} />
                  <div className="textLayer" ref={layer} />
                  {highlight && (
                    <div
                      className={`target-highlight ${wheel || bubble ? "locked" : ""}`}
                      style={highlightStyle}
                    />
                  )}{" "}
                  {rendering && (
                    <div className="rendering-overlay">
                      <span className="spinner" />
                      Opening this page
                    </div>
                  )}
                </div>
                <div className="page-footer">
                  {page} <span>—</span> {pdf.numPages}
                </div>
              </div>
              <footer className="reader-footer">
                <BookOpen size={13} />
                <span>{filename}</span>
                <span className="footer-right">Only a question away.</span>
              </footer>
            </>
          )}
        </section>
        {panel && (
          <aside className="chat-panel">
            <header className="chat-header">
              <Mascot small />
              <div>
                <strong>Make sense of it</strong>
                <span>Margin · Your reading companion</span>
              </div>
              <button
                className="icon-button"
                aria-label="Close chat"
                onClick={() => setPanel(false)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-empty">
                  <span className="chat-orbit">
                    <Mascot />
                  </span>
                  <h2>Start with a question.</h2>
                  <p>
                    Point at text or a figure.
                    <br />
                    We will work through it together.
                  </p>
                  <div className="empty-prompts">
                    <span>What does this concept mean?</span>
                    <span>What is this figure showing?</span>
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <article className={`message ${m.role}`} key={m.id}>
                    {m.role === "assistant" && (
                      <div className="message-author">
                        <Mascot small />
                        <strong>Margin</strong>
                      </div>
                    )}
                    <button
                      className="source-chip"
                      title="Return to this page"
                      onClick={() => {
                        if (page !== m.source.page) changePage(m.source.page);
                        else setHighlight(m.source.rect);
                        setSource(m.source);
                      }}
                    >
                      p. {m.source.page} · {m.source.kind}
                      <ArrowUp size={10} />
                    </button>
                    {m.content && (
                      <div className="markdown">
                        <Markdown>{m.content}</Markdown>
                      </div>
                    )}
                    {m.role === "assistant" &&
                      !m.content &&
                      !m.error &&
                      busy && (
                        <div className="thinking-dots">
                          <i />
                          <i />
                          <i />
                        </div>
                      )}
                    {m.error && (
                      <div className="message-error" role="alert">
                        {m.error}
                        <button
                          disabled={busy}
                          onClick={() =>
                            ask(
                              m.prompt!,
                              messages[messages.indexOf(m) - 1]?.content ||
                                "Retry",
                              m.source,
                              messages.slice(
                                0,
                                Math.max(0, messages.indexOf(m) - 1),
                              ),
                            )
                          }
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
              <div ref={chatEnd} />
            </div>
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim())
                  void ask(
                    input.trim(),
                    input.trim(),
                    latest?.source || source,
                    messages,
                  );
              }}
            >
              <div className="composer-context">
                {latest?.source || source ? (
                  <>
                    <FileText size={12} />
                    Full paper + selection on p.{" "}
                    {(latest?.source || source)!.page}
                  </>
                ) : (
                  "Select something in your paper first"
                )}
              </div>
              <textarea
                aria-label="Follow-up"
                placeholder="Explain it more simply, or ask a follow-up…"
                rows={2}
                maxLength={3000}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!source && !latest}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    if (input.trim() && !busy)
                      void ask(
                        input.trim(),
                        input.trim(),
                        latest?.source || source,
                        messages,
                      );
                  }
                }}
              />
              <div className="composer-bottom">
                <span>Enter to send · Shift Enter for a new line</span>
                {busy ? (
                  <button
                    type="button"
                    className="send"
                    title="Stop response"
                    aria-label="Stop response"
                    onClick={stopRequest}
                  >
                    <Square size={13} />
                  </button>
                ) : (
                  <button
                    className="send"
                    aria-label="Send follow-up"
                    disabled={!input.trim() || (!source && !latest)}
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
              <p>
                AI can make mistakes. Check important claims against the paper.
              </p>
            </form>
          </aside>
        )}
      </div>
      {wheel && source && (
        <>
          <button
            className="floating-dismiss"
            aria-label="Close wheel"
            onClick={closeFloating}
          />
          <div
            className="wheel"
            role="dialog"
            aria-label="Reading actions"
            style={{ left: anchor.x, top: anchor.y }}
          >
            <div className="wheel-ring" />
            {actions
              .filter((action) => action.enabled)
              .map((action, i) => {
                const Icon = actionIcons[i];
                return action.enabled ? (
                  <button
                    key={action.id}
                    className={`wheel-action action-${i}`}
                    disabled={busy}
                    title={
                      action.prompt.includes("{{target_language}}")
                        ? `Translate to ${preferences.translationLanguage}`
                        : action.label
                    }
                    onClick={() => runAction(action)}
                  >
                    <Icon size={20} />
                    <strong>{action.label}</strong>
                    <kbd>{action.shortcut.toUpperCase()}</kbd>
                  </button>
                ) : null;
              })}
            <button
              className="wheel-center"
              aria-label="Close wheel center"
              onClick={closeFloating}
            >
              <Mascot />
            </button>
            <div className="wheel-caption">
              p. {source.page} ·{" "}
              {source.kind === "Page region"
                ? "Nearby region · select to refine"
                : "Selection locked"}
            </div>
          </div>
        </>
      )}
      {bubble && latest && !panel && (
        <div
          className="cursor-bubble"
          role="status"
          style={{
            left: clamp(
              anchor.x + 35,
              12,
              typeof window === "undefined" ? 800 : window.innerWidth - 350,
            ),
            top: clamp(
              anchor.y - 60,
              82,
              typeof window === "undefined" ? 500 : window.innerHeight - 330,
            ),
          }}
        >
          <header>
            <Mascot small />
            <strong>Margin</strong>
            <span>p. {latest.source.page}</span>
            <button
              className="icon-button"
              aria-label="Close bubble"
              onClick={() => {
                setBubble(false);
                setHighlight(null);
              }}
            >
              <X size={15} />
            </button>
          </header>
          <div className="bubble-text">
            {latest.error ? (
              <p className="error-text">{latest.error}</p>
            ) : latest.content ? (
              <Markdown>
                {latest.content.slice(0, 260) +
                  (latest.content.length > 260 ? "…" : "")}
              </Markdown>
            ) : (
              <div className="thinking-dots">
                <i />
                <i />
                <i />
                <span>Reading this with you…</span>
              </div>
            )}
          </div>
          <button className="bubble-expand" onClick={openPanel}>
            {latest.error
              ? "Open chat to retry"
              : "Expand chat and keep asking"}
            <ArrowRight size={15} />
          </button>
        </div>
      )}
      {settings && (
        <ReaderSettings
          initialTab={settingsTab}
          preferences={preferences}
          hasSessionKey={Boolean(sessionKey)}
          serverConfigured={Boolean(configured)}
          onSave={savePreferences}
          onKey={(key) => {
            stopRequest();
            paperAttachment.current = null;
            setPaperAttached(false);
            setSessionKey(key);
          }}
          onDisconnect={() => {
            stopRequest();
            paperAttachment.current = null;
            setPaperAttached(false);
            setSessionKey("");
          }}
          onClose={() => setSettings(false)}
        />
      )}
    </main>
  );
}
