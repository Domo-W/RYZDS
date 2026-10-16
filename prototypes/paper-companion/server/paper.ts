import { aiConfig } from "./config";

const maxBytes = 30 * 1024 * 1024;
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Request origin does not match." },
      { status: 403 },
    );
  const { key } = aiConfig(request);
  if (!key)
    return Response.json(
      { error: "Add an OpenAI API key in Settings before asking AI." },
      { status: 503 },
    );
  if (Number(request.headers.get("content-length")) > maxBytes + 65536)
    return Response.json(
      { error: "Choose a PDF smaller than 30 MB." },
      { status: 413 },
    );
  const controller = new AbortController();
  const cancel = () => controller.abort();
  request.signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 90000);
  try {
    // Bound even chunked requests before parsing multipart data.
    const reader = request.body?.getReader();
    if (!reader) throw Error("invalid");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes + 65536) {
        await reader.cancel();
        return Response.json(
          { error: "Choose a PDF smaller than 30 MB." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const form = await new Response(new Blob(chunks as BlobPart[]), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > maxBytes ||
      !file.name.toLowerCase().endsWith(".pdf") ||
      !(await file.slice(0, 1024).text()).includes("%PDF-")
    ) {
      return Response.json(
        { error: "Please choose a valid PDF up to 30 MB." },
        { status: 400 },
      );
    }
    const outgoing = new FormData();
    outgoing.set("file", file);
    outgoing.set("purpose", "user_data");
    outgoing.set("expires_after[anchor]", "created_at");
    outgoing.set("expires_after[seconds]", "3600");
    const response = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: outgoing,
      signal: controller.signal,
    });
    const result = (await response.json()) as {
      id?: string;
      expires_at?: number;
      error?: { code?: string };
    };
    if (!response.ok || !result.id || !result.expires_at) {
      return Response.json(
        {
          error:
            response.status === 401
              ? "OpenAI could not verify your key. Update it in Settings."
              : response.status === 429
                ? "OpenAI quota or rate limit reached. Check billing or try again shortly."
                : `Could not prepare the full paper (${response.status}). Please retry.`,
        },
        { status: 502 },
      );
    }
    return Response.json(
      { fileId: result.id, expiresAt: result.expires_at },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error: controller.signal.aborted
          ? "Paper upload was cancelled or timed out. Please retry."
          : "Could not prepare the paper. Check the PDF and connection, then retry.",
      },
      { status: 400 },
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", cancel);
  }
}
