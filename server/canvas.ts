import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, demoScript } from "./prompt.js";

export type CanvasRequest = {
  history?: Anthropic.MessageParam[];
  prompt?: string;
  canvas?: unknown;
  image?: string | null;
  paper?: { name: string; data: string } | null;
};

type Effort = "low" | "medium" | "high";
const MODEL_SMART = process.env.VIZAI_MODEL ?? "claude-sonnet-5-5";
const MODEL_FAST = process.env.VIZAI_FAST_MODEL ?? "claude-haiku-5-5";
const EFFORT_SMART = (process.env.VIZAI_EFFORT ?? "medium") as Effort;
const EFFORT_FAST = (process.env.VIZAI_FAST_EFFORT ?? "low") as Effort;

export const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
export const healthInfo = () => ({ ok: true, hasKey: hasKey(), model: MODEL_SMART, fastModel: MODEL_FAST });

const COMPLEX = /\b(explain|how|why|compare|vs\.?|versus|plan|design|diagram|teach|walk|step|architecture|flow|visuali[sz]e|sketch|map out|break ?down|timeline|overview|strategy|analy[sz]e|summari[sz]e|tutorial|lesson|outline|brainstorm)\b/i;

/** Haiku for quick/simple asks, Sonnet for explanations and anything that needs layout thinking. */
export function pickModel(prompt: string, hasImage: boolean): { model: string; effort: Effort; label: string } {
  const p = prompt.trim();
  const simple = p.length < 70 && !COMPLEX.test(p) && !hasImage;
  return simple
    ? { model: MODEL_FAST, effort: EFFORT_FAST, label: "Haiku 5.5" }
    : { model: MODEL_SMART, effort: EFFORT_SMART, label: "Sonnet 5.5" };
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

/** Runs one canvas turn, emitting NDJSON envelope events through `send`. Shared by Express (local) and Vercel (prod). */
export async function runCanvasTurn(body: CanvasRequest, send: (o: unknown) => void, signal?: AbortSignal) {
  const { history = [], prompt = "", canvas = {}, image = null, paper = null } = body ?? {};

  if (!hasKey()) {
    for (const line of demoScript(prompt)) {
      if (signal?.aborted) return;
      send({ t: "text", text: line + "\n" });
      await new Promise((r) => setTimeout(r, 350));
    }
    send({ t: "done", stop_reason: "end_turn" });
    return;
  }

  const userContent: Anthropic.ContentBlockParam[] = [];
  if (paper?.data) {
    userContent.push({
      type: "document", title: paper.name, cache_control: { type: "ephemeral" },
      source: { type: "base64", media_type: "application/pdf", data: paper.data },
    });
  }
  if (image) userContent.push({ type: "image", source: { type: "base64", media_type: "image/png", data: image } });
  userContent.push({ type: "text", text: `<canvas_state>\n${JSON.stringify(canvas)}\n</canvas_state>\n\n${prompt}` });

  const messages: Anthropic.MessageParam[] = [
    ...history.filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content),
    { role: "user", content: userContent },
  ];

  const pick = pickModel(prompt, Boolean(image) || Boolean(paper));
  send({ t: "meta", model: pick.model, label: pick.label });
  const isHaiku = pick.model.includes("haiku");

  try {
    const stream = getClient().beta.messages.stream(
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
      { signal },
    );
    for await (const ev of stream) {
      if (ev.type !== "content_block_delta") continue;
      if (ev.delta.type === "text_delta") send({ t: "text", text: ev.delta.text });
      else if (ev.delta.type === "thinking_delta") send({ t: "thinking", text: ev.delta.thinking });
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") send({ t: "error", message: "Claude declined this request." });
    send({ t: "done", stop_reason: final.stop_reason, model: pick.model,
      usage: { input: final.usage.input_tokens, output: final.usage.output_tokens, cache_read: final.usage.cache_read_input_tokens } });
  } catch (err) {
    if (signal?.aborted) return;
    let message = "Unknown error";
    if (err instanceof Anthropic.AuthenticationError) message = "Invalid API key — check ANTHROPIC_API_KEY";
    else if (err instanceof Anthropic.RateLimitError) message = "Rate limited — try again in a moment";
    else if (err instanceof Anthropic.APIError) message = `API error ${err.status}: ${err.message}`;
    else if (err instanceof Error) message = err.message;
    console.error("[vizai]", message);
    send({ t: "error", message });
  }
}
