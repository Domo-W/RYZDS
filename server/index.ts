import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { healthInfo, runCanvasTurn, type CanvasRequest } from "./canvas.js";

try { process.loadEnvFile(".env"); } catch { /* no .env file */ }

const PORT = Number(process.env.VIZAI_PORT ?? 8787);
const app = express();
app.use(express.json({ limit: "30mb" }));

app.get("/api/health", (_req, res) => res.json(healthInfo()));

app.post("/api/canvas", async (req: Request<unknown, unknown, CanvasRequest>, res: Response) => {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  const ac = new AbortController();
  req.on("close", () => ac.abort());
  await runCanvasTurn(req.body, (o) => res.write(JSON.stringify(o) + "\n"), ac.signal);
  res.end();
});

if (process.env.NODE_ENV === "production") {
  const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
  app.use(express.static(dist));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  const h = healthInfo();
  console.log(`[vizai] api on http://localhost:${PORT}  smart=${h.model} fast=${h.fastModel} key=${h.hasKey ? "yes" : "NO (demo mode)"}`);
});
