// Vercel serverless function (Node runtime, web-standard signature) that streams NDJSON.
import { runCanvasTurn, type CanvasRequest } from "../server/canvas.js";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as CanvasRequest;
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        await runCanvasTurn(body, send, req.signal);
      } catch (e) {
        send({ t: "error", message: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
