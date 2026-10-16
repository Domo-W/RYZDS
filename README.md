# VizAI — an AI that explains on a canvas, not in a chat box

Most chatbots are stuck in a text thread. VizAI gives Claude an infinite whiteboard instead.
You ask a question; Claude **draws the answer live** — titles, diagrams, arrows, sticky-note
takeaways, hand-drawn SVG illustrations — while narrating with speech bubbles and **moving the
camera** to walk you through it, like a person explaining at a whiteboard.

## How it works

```
you type a prompt ──▶ /api/canvas (Express) ──▶ Claude (Sonnet 5.5 / Haiku 5.5, streaming)
                                                      │
                 tldraw canvas ◀── ops applied live ◀──┘  NDJSON: one canvas operation per line
```

- **Brain:** Claude via the official `@anthropic-ai/sdk`. The system prompt teaches it a tiny visual
  language (`say`, `text`, `shape`, `arrow`, `note`, `frame`, `svg`, `focus`, `wait`, …).
- **Streaming:** the server forwards text deltas as they arrive; the browser parses complete lines
  and applies each op immediately, so the explanation builds up in front of you.
- **Choreography:** a "Claude" collaborator cursor glides to whatever it is drawing, speech bubbles
  show narration, and the camera pans/zooms when content lands off-screen or Claude calls `focus`.
- **It can see:** every turn sends a compact JSON description of the canvas plus (optionally) a PNG
  screenshot, so Claude can annotate things you drew by hand, edit its own shapes, and avoid overlaps.
- **Memory:** conversation history is kept client-side, so follow-ups ("make that part bigger",
  "now compare it to X") work.

## Run it

```bash
npm install
cp .env.example .env     # add your ANTHROPIC_API_KEY
npm run dev              # web on http://localhost:5173, API on :8787
```

Without an API key the app runs a built-in demo script so the UI can still be shown off.

**Model routing:** short, simple prompts go to `claude-haiku-5-5` (fast, cheap); explanations,
comparisons, plans, and anything with a canvas screenshot go to `claude-sonnet-5-5`. Override with
`VIZAI_MODEL`, `VIZAI_FAST_MODEL`, `VIZAI_EFFORT`, `VIZAI_FAST_EFFORT`, `VIZAI_PORT` in `.env`.

Production: `npm run build && npm start` serves the built app and API from one process.

## Project layout

- `server/index.ts` — Express API, streams Claude's output as NDJSON events
- `server/prompt.ts` — the system prompt (the visual language spec) + demo script
- `src/canvas/ops.ts` — op types
- `src/canvas/apply.ts` — turns ops into tldraw shapes, camera moves, cursor moves
- `src/canvas/snapshot.ts` — describes / screenshots the canvas for Claude
- `src/canvas/presence.ts` — the animated "Claude" cursor + chat bubble
- `src/App.tsx` — glass UI: prompt bar, status, narration log

## Try asking

- "Explain how a neural network learns, visually"
- "Draw how HTTPS works, step by step"
- Draw a rough sketch yourself, then: "label what I drew and fix the layout"
- "Zoom in on the second step and expand it"
