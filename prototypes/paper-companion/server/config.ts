// This portable prototype uses only the key entered in the current browser tab.
// Never expose a shared server key through this unauthenticated local adapter.
export function aiConfig(request?: Request) {
  return {
    key: request?.headers.get("X-OpenAI-Key")?.trim(),
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  };
}
