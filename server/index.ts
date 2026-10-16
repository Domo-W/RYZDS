import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, demoScript } from "./prompt.ts";

try { process.loadEnvFile(".env"); } catch { /* no .env file */ }

const PORT = Number(process.env.VIZAI_PORT ?? 8787);
const MODEL_SMART = process.env.VIZAI_MODEL ?? "claude-sonnet-5-5";
const MODEL_FAST = process.env.VIZAI_FAST_MODEL ?? "claude-haiku-5-5";
type Effort = "low" | "medium" | "high";
const EFFORT_SMART = (process.env.VIZAI_EFFORT ?? "medium") as Effort;
const EFFORT_FAST = (process.env.VIZAI_FAST_EFFORT ?? "low") as Effort;

const COMPLEX = /\b(explain|how|why|compare|vs\.?|versus|plan|design|diagram|teach|walk|step|architecture|flow|visuali[sz]e|sketch|map out|break ?down|timeline|overview|strategy|analy[sz]e|summari[sz]e|tutorial|lesson|outline|brainstorm)\b/i;

/** Haiku for quick/simple asks, Sonnet for explanations and anything that needs layout thinking. */
function pickModel(prompt: string, hasImage: boolean): { model: string; effort: Effort; label: string } {
  const p = prompt.trim();
  const simple = p.length < 70 && !COMPLEX.test(p) && !hasImage;
  return simple
    ? { model: MODEL_FAST, effort: EFFORT_FAST, label: "Haiku 5.5" }
    : { model: MODEL_SMART, effort: EFFORT_SMART, label: "Sonnet 5.5" };
}
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = hasKey ? new Anthropic() : null;

const app = express();
app.use(express.json({ limit: "30mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, hasKey, model: MODEL_SMART, fastModel: MODEL_FAST }));

type Body = {
  history?: Anthropic.MessageParam[];
  prompt?: string;
  canvas?: unknown;
  image?: string | null;
};

app.post("/api/canvas", async (req: Request<unknown, unknown, Body>, res: Response) => {
  const { history = [], prompt = "", canvas = {}, image = null } = req.body ?? {};
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  const send = (o: unknown) => res.write(JSON.stringify(o) + "\n");

  if (!client) {
    for (const line of demoScript(prompt)) {
      send({ t: "text", text: line + "\n" });
      await new Promise((r) => setTimeout(r, 350));
    }
    send({ t: "done", stop_reason: "end_turn" });
    return res.end();
  }

  const userContent: Anthropic.ContentBlockParam[] = [];
  if (image) userContent.push({ type: "image", source: { type: "base64", media_type: "image/png", data: image } });
  userContent.push({ type: "text", text: `<canvas_state>\n${JSON.stringify(canvas)}\n</canvas_state>\n\n${prompt}` });

  const messages: Anthropic.MessageParam[] = [
    ...history.filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content),
    { role: "user", content: userContent },
  ];

  const ac = new AbortController();
  req.on("close", () => ac.abort());

  const pick = pickModel(prompt, Boolean(image));
  send({ t: "meta", model: pick.model, label: pick.label });
  const isHaiku = pick.model.includes("haiku");

  try {
    const stream = client.beta.messages.stream(
      {
        model: pick.model,
        max_tokens: 16000,
        // Haiku has no server-side refusal fallback; Sonnet/Opus do.
        ...(isHaiku ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }),
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: pick.effort },
        messages,
      },
      { signal: ac.signal },
    );
    for await (const ev of stream) {
      if (ev.type !== "content_block_delta") continue;
      if (ev.delta.type === "text_delta") send({ t: "text", text: ev.delta.text });
      else if (ev.delta.type === "thinking_delta") send({ t: "thinking", text: ev.delta.thinking });
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") send({ t: "error", message: "Claude declined this request." });
    send({ t: "done", stop_reason: final.stop_reason, model: pick.model, usage: { input: final.usage.input_tokens, output: final.usage.output_tokens, cache_read: final.usage.cache_read_input_tokens } });
  } catch (err) {
    if (ac.signal.aborted) return res.end();
    let message = "Unknown error";
    if (err instanceof Anthropic.AuthenticationError) message = "Invalid API key — check ANTHROPIC_API_KEY in .env";
    else if (err instanceof Anthropic.RateLimitError) message = "Rate limited — try again in a moment";
    else if (err instanceof Anthropic.APIError) message = `API error ${err.status}: ${err.message}`;
    else if (err instanceof Error) message = err.message;
    console.error("[vizai]", message);
    send({ t: "error", message });
  }
  res.end();
});

if (process.env.NODE_ENV === "production") {
  const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
  app.use(express.static(dist));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`[vizai] api on http://localhost:${PORT}  smart=${MODEL_SMART}/${EFFORT_SMART} fast=${MODEL_FAST}/${EFFORT_FAST} key=${hasKey ? "yes" : "NO (demo mode)"}`);
});
