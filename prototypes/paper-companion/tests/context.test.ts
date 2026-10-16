import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { POST as chat } from "../server/chat";
import { POST as paper } from "../server/paper";
import { defaultPreferences, preferencesSchema } from "../src/lib/preferences";

const key = "sk-test-placeholder-not-a-real-key";
const source = {
  page: 2,
  text: "Explain Figure 1",
  pageText: "Synthetic scores",
  image: "data:image/jpeg;base64,AAAA",
  kind: "Page region",
};
const payload = {
  paperFileId: "file-example",
  prompt: "How many participants?",
  filename: "sample.pdf",
  source,
  history: [
    { role: "user", content: "Explain the graph" },
    { role: "assistant", content: "Illustrative means only." },
  ],
};
const request = (body: unknown, extra: Record<string, string> = {}) =>
  new Request("http://127.0.0.1:8788/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-OpenAI-Key": key,
      ...extra,
    },
    body: JSON.stringify(body),
  });

test("full-paper context, source focus, history and bounded upload contract", async (t) => {
  const actualFetch = globalThis.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  let next: () => Response = () => Response.json({});
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init: init! });
    return next();
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = actualFetch;
  });

  await t.test(
    "upload forwards the complete PDF with one-hour expiry",
    async () => {
      next = () =>
        Response.json({
          id: "file-example",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        });
      const bytes = await readFile(
        new URL("../public/sample.pdf", import.meta.url),
      );
      const form = new FormData();
      form.set(
        "file",
        new File([bytes], "sample.pdf", { type: "application/pdf" }),
      );
      const result = await paper(
        new Request("http://127.0.0.1:8788/api/paper", {
          method: "POST",
          headers: { "X-OpenAI-Key": key },
          body: form,
        }),
      );
      assert.equal(result.status, 200);
      assert.equal((await result.json()).fileId, "file-example");
      const outgoing = calls.at(-1)!;
      assert.equal(outgoing.url, "https://api.openai.com/v1/files");
      const body = outgoing.init.body as FormData;
      assert.equal(body.get("purpose"), "user_data");
      assert.equal(body.get("expires_after[seconds]"), "3600");
      assert.equal(body.get("expires_after[anchor]"), "created_at");
      assert.deepEqual(
        Buffer.from(await (body.get("file") as File).arrayBuffer()),
        bytes,
      );
    },
  );
  await t.test(
    "every question includes full PDF plus focal screenshot and conversation",
    async () => {
      next = () =>
        new Response(
          'data: {"type":"response.output_text.delta","delta":"Mock transport only"}\n\ndata: {"type":"response.completed"}\n\n',
        );
      const result = await chat(request(payload));
      assert.equal(result.status, 200);
      assert.match(await result.text(), /Mock transport only/);
      const outgoing = calls.at(-1)!;
      assert.equal(outgoing.url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(outgoing.init.body as string);
      assert.equal(body.store, false);
      assert.equal(body.stream, true);
      assert.deepEqual(body.input.slice(0, 2), payload.history);
      const content = body.input.at(-1).content;
      assert.deepEqual(content[0], {
        type: "input_file",
        file_id: "file-example",
      });
      assert.match(content[1].text, /How many participants/);
      assert.match(content[1].text, /Page: 2/);
      assert.equal(content[2].image_url, source.image);
      assert.ok(!JSON.stringify(body).includes(key));
    },
  );
  await t.test(
    "no selection-only fallback and no request before key setup",
    async () => {
      const before = calls.length;
      assert.equal(
        (await chat(request({ ...payload, paperFileId: undefined }))).status,
        400,
      );
      assert.equal(
        (await chat(request(payload, { "X-OpenAI-Key": "" }))).status,
        503,
      );
      assert.equal(
        (await chat(request(payload, { origin: "https://untrusted.example" })))
          .status,
        403,
      );
      assert.equal(calls.length, before);
    },
  );
  await t.test("invalid and oversized PDFs never reach provider", async () => {
    const before = calls.length;
    const form = new FormData();
    form.set("file", new File(["not a PDF"], "invalid.pdf"));
    assert.equal(
      (
        await paper(
          new Request("http://127.0.0.1:8788/api/paper", {
            method: "POST",
            headers: { "X-OpenAI-Key": key },
            body: form,
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await paper(
          new Request("http://127.0.0.1:8788/api/paper", {
            method: "POST",
            headers: { "X-OpenAI-Key": key, "Content-Length": "40000000" },
            body: "x",
          }),
        )
      ).status,
      413,
    );
    assert.equal(calls.length, before);
  });
  await t.test(
    "context limit and expired file are visible failures",
    async () => {
      next = () =>
        Response.json(
          { error: { code: "context_length_exceeded" } },
          { status: 400 },
        );
      assert.match(
        (await (await chat(request(payload))).json()).error,
        /no pages were silently dropped/,
      );
      next = () =>
        Response.json({ error: { code: "file_not_found" } }, { status: 400 });
      assert.match(
        (await (await chat(request(payload))).json()).error,
        /Upload the paper again/,
      );
    },
  );
  await t.test("interrupted stream is not reported as completed", async () => {
    next = () =>
      new Response(
        'data: {"type":"response.output_text.delta","delta":"partial"}\n\n',
      );
    assert.match(
      await (await chat(request(payload))).text(),
      /connection ended early/,
    );
  });
});

test("prompt library allows many saved prompts but only four active", () => {
  assert.equal(defaultPreferences.actions.length, 8);
  assert.equal(defaultPreferences.actions.filter((a) => a.enabled).length, 4);
  const five = structuredClone(defaultPreferences);
  five.actions[4].enabled = true;
  assert.equal(preferencesSchema.safeParse(five).success, false);
  five.actions[0].enabled = false;
  assert.equal(preferencesSchema.safeParse(five).success, true);
  const duplicate = structuredClone(defaultPreferences);
  duplicate.actions[1].shortcut = duplicate.actions[0].shortcut;
  assert.equal(preferencesSchema.safeParse(duplicate).success, false);
  assert.equal(
    preferencesSchema.safeParse({
      ...defaultPreferences,
      translationLanguage: "French",
    }).success,
    true,
  );
  assert.ok(
    defaultPreferences.actions
      .find((a) => a.id === "translate")!
      .prompt.includes("{{target_language}}"),
  );
});
