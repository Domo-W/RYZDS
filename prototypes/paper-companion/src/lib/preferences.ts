import { z } from "zod";
import { promptPresets } from "./research-presets";
const actionSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1).max(24),
  prompt: z.string().trim().max(3000),
  shortcut: z.string().regex(/^[a-z0-9]$/i),
  enabled: z.boolean(),
});
export const preferencesSchema = z
  .object({
    hover: z.boolean(),
    translationLanguage: z
      .enum([
        "Simplified Chinese",
        "Traditional Chinese",
        "English",
        "Spanish",
        "French",
        "German",
        "Japanese",
        "Korean",
        "Portuguese",
        "Italian",
        "Arabic",
        "Hindi",
      ])
      .default("Simplified Chinese"),
    shortcut: z
      .string()
      .regex(
        /^(?:(?:Control|Alt|Meta|Shift)\+)+(?:Key[A-Z]|Digit[0-9]|Space)$/,
      ),
    actions: z.array(actionSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const enabled = data.actions.filter((a) => a.enabled);
    if (enabled.length > 4)
      ctx.addIssue({
        code: "custom",
        message: "Only four actions can be active. Turn one off first.",
      });
    if (enabled.some((a) => !a.prompt))
      ctx.addIssue({
        code: "custom",
        message: "Add a prompt before enabling an action.",
      });
    if (
      new Set(enabled.map((a) => a.shortcut.toLowerCase())).size !==
      enabled.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Each enabled action needs a different shortcut.",
      });
    if (!/(Control|Alt|Meta)\+/.test(data.shortcut))
      ctx.addIssue({
        code: "custom",
        message: "Include Alt, Control or Command in the wheel shortcut.",
      });
  });
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: Preferences = {
  hover: false,
  shortcut: "Alt+KeyK",
  translationLanguage: "Simplified Chinese",
  actions: [
    "translate",
    "graph",
    "explain",
    "logic",
    "results",
    "review",
    "experiment",
    "quiz",
  ].map((id, i) => {
    const preset = promptPresets.find((p) => p.id === id)!;
    return {
      id,
      label: preset.label,
      prompt: preset.prompt,
      shortcut: String(i + 1),
      enabled: i < 4,
    };
  }),
};
export function shortcutLabel(shortcut: string) {
  return shortcut
    .replaceAll("Key", "")
    .replaceAll("Digit", "")
    .replace("Meta", "Cmd")
    .replace("Control", "Ctrl")
    .replaceAll("+", " + ");
}
export function keyboardBinding(
  e: Pick<
    KeyboardEvent,
    "ctrlKey" | "altKey" | "metaKey" | "shiftKey" | "code"
  >,
) {
  return [
    e.ctrlKey && "Control",
    e.altKey && "Alt",
    e.metaKey && "Meta",
    e.shiftKey && "Shift",
    e.code,
  ]
    .filter(Boolean)
    .join("+");
}

export const translationLanguages = [
  "Simplified Chinese",
  "Traditional Chinese",
  "English",
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Korean",
  "Portuguese",
  "Italian",
  "Arabic",
  "Hindi",
] as const;
