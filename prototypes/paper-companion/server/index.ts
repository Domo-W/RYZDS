import express from "express";
import { Readable } from "node:stream";
import { resolve } from "node:path";
import { POST as chat } from "./chat";
import { POST as paper } from "./paper";
import { aiConfig } from "./config";

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  // Keep the prototype local and reject DNS-rebinding hosts.
  const host = req.headers.host?.split(":")[0];
  if (host !== "127.0.0.1" && host !== "localhost") {
    res.status(403).json({ error: "Local access only." });
    return;
  }
  next();
});
app.get("/api/status", (_req, res) =>
  res.json({ configured: false, model: aiConfig().model }),
);
for (const [path, handler] of [
  ["/api/chat", chat],
  ["/api/paper", paper],
] as const) {
  app.post(path, async (req, res) => {
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (value)
          headers.set(key, Array.isArray(value) ? value.join(",") : value);
      const request = new Request(`http://${req.headers.host}${path}`, {
        method: "POST",
        headers,
        body: Readable.toWeb(req) as ReadableStream,
        duplex: "half",
        signal: controller.signal,
      } as RequestInit);
      const response = await handler(request);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (!response.body) {
        res.end();
        return;
      }
      const output = Readable.fromWeb(
        response.body as import("node:stream/web").ReadableStream,
      );
      output.on("error", () => res.destroy());
      output.pipe(res);
    } catch {
      if (!res.headersSent)
        res.status(500).json({ error: "Request could not be completed." });
      else res.end();
    }
  });
}
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/", (_req, res) => res.sendFile(resolve("dist/index.html")));
}
const port = Number(process.env.PORT || 8788);
app.listen(port, "127.0.0.1", () =>
  console.log(`Margin API: http://127.0.0.1:${port}`),
);
