# Margin — cursor-first research paper companion

Upload a paper, point at a passage or select a figure, open a four-action wheel,
and read the explanation beside the pointer or in the right-hand chat.
The **entire PDF is the AI background**; the selected region tells it what to focus on.
This is an independent prototype alongside VizAI. The existing root canvas app is unchanged.

## Run

Requires Node 22.13+ (Node 24 recommended).

```bash
cd prototypes/paper-companion
npm ci
npm run dev
# Open http://127.0.0.1:5174 — API runs on 127.0.0.1:8788
```

No API key is needed to upload, read, select or customize prompts. Before an AI
question, **Settings → API key** accepts your own OpenAI key for the current tab.
Saving it does not verify access or send a provider request. It is kept only in
React memory, cleared on refresh, and forwarded through the local API to OpenAI
when you ask. No key is included in this repository or written to localStorage.
This adapter deliberately does not use a shared `OPENAI_API_KEY` environment key.
`OPENAI_MODEL` optionally overrides the default `gpt-5.4-mini`.

```bash
npm test       # transport and preference contracts; no external calls
npm run build  # TypeScript + production frontend
npm start      # http://127.0.0.1:8788, frontend and API together
```

Both servers bind to loopback. This is a local prototype, not a public service:
add authentication, user isolation, upload/rate controls and HTTPS before hosting it.
Do not bypass the local host/origin checks or expose the Vite server to the network.

## Reading flow

1. Upload a PDF (up to 30 MB) or try the included fictional paper.
2. Point at text or select text, then press **Alt/Option + K**. For figures, use
   **Select region** and drag a box around the figure and caption.
3. Choose **Translate**, **Explain graph**, **Explain content**, or **Check logic**.
4. Without a key, the API setup opens. With a key, the full paper is prepared and
   the response streams into the cursor bubble. Open Chat to continue the same
   response and ask follow-ups; opening Chat does not trigger another AI request.

Keyboard is the default. Settings allows optional hover activation, a custom
wheel shortcut, editable prompt text/labels/action keys, any number of saved
prompts and at most **four enabled**. Translate has a target-language selector.
Preferences persist locally; papers, conversations and API keys do not.

## What goes into context

- Opening a PDF loads it **locally**; hovering does not send it anywhere.
- The first explicit AI question uploads the **complete PDF** through `/api/paper`
  to OpenAI Files with `purpose=user_data` and a **one-hour expiry**.
- Each `/api/chat` request attaches that file ID, the selected screenshot/text,
  current-page text, the user prompt and recent conversation (up to 12 messages).
  PDF input gives the model page text and page images, not just the current page.
- The attachment is reused for that paper and key. Changing either invalidates it;
  expired cached attachments are uploaded again on the next question.
- Local-ready / preparing / attached indicators distinguish actual state. An
  oversized model context returns an error; no silent selection-only fallback.
- `store:false` is set on Responses. Files still exist upstream until their expiry;
  refresh clears this tab, **not** the upstream file. Full-paper input consumes
  more input tokens than selected excerpts. Provider data policies still apply.

Citation instructions use **PDF page positions** (`[p.N]`), which may differ from
printed page labels. The model is instructed to check surrounding evidence,
separate observation and inference, and treat document instructions as untrusted
content. These are guardrails, not guarantees of model accuracy.

## Validation and limits

Eight automated checks cover complete file forwarding and expiry, file + selected
region + history in Responses, missing-key/file and cross-origin guards, invalid
and oversized PDF rejection, context-limit/expired-file errors, incomplete streams,
and the four-enabled-action limit. Provider calls are mocked: **real OpenAI upload,
reply quality and streaming have not been verified with a live key**.

Browser checks cover PDF rendering, page navigation, keyboard wheel, API setup
before asking, prompt enable/disable limits and translation-language persistence.
The sample deliberately places the figure on page 2 and its 24-participant sample
and fixed-order confound on page 3. With a real key, ask about those details while
selecting the figure to smoke-test cross-page grounding.

Pointer targeting uses nearby text lines or a rectangular region, not semantic
layout parsing. Box selection gives better control for figures. Scanned PDFs rely
on model vision. New radial actions start a fresh conversation; follow-ups retain
that selection. There is no persistent library, retrieval index, diagram canvas
integration, OCR pipeline or global desktop mouse hook in this prototype.

## Source layout

- `src/components/paper-companion.tsx`: PDF rendering, context capture, wheel,
  attachment lifecycle, bubble and shared chat.
- `src/components/reader-settings.tsx`: API key, controls and prompt library.
- `src/lib/preferences.ts`, `research-presets.ts`: validated preferences/presets.
- `server/paper.ts`, `chat.ts`: bounded upload and streaming Responses handlers.
- `server/index.ts`: loopback-only Express adapter; no Sites/Cloudflare dependency.
- `scripts/copy-pdf-assets.mjs`: installs worker, CMaps, fonts, WASM and license from
  the locked PDF.js dependency; generated vendor files are not checked into Git.

## Attribution

Research prompts are original English adaptations inspired by the logic-check,
experimental-analysis and reviewer sections of
[Leey21/awesome-ai-research-writing](https://github.com/Leey21/awesome-ai-research-writing)
(revision `df0af726a79109b8760c1b80d5dfc36ed44a6f1f`, inspected 2026-10-16).
They are not benchmarked or claimed to be universally best. Other reading presets
were written for Margin. The UI links the collection in Settings.

PDF.js is Apache-2.0; its notices travel with the generated assets. The included
sample PDF is original fictional content with synthetic data, dedicated to CC0.
Regenerate it using `python3 scripts/create-sample.py` with `reportlab` installed.
No third-party research paper, personal paper, API key or hosting credential is bundled.

References: [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs),
[Files API expiry](https://developers.openai.com/api/reference/resources/files/methods/create).
