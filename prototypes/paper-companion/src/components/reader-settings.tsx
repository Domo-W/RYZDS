"use client";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  KeyRound,
  Keyboard,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  defaultPreferences,
  keyboardBinding,
  preferencesSchema,
  shortcutLabel,
  translationLanguages,
  type Preferences,
} from "@/lib/preferences";
import { promptPresets, researchSource } from "@/lib/research-presets";
export type SettingsTab = "connection" | "controls" | "prompts";
export default function ReaderSettings({
  initialTab,
  preferences,
  hasSessionKey,
  serverConfigured,
  onSave,
  onKey,
  onDisconnect,
  onClose,
}: {
  initialTab: SettingsTab;
  preferences: Preferences;
  hasSessionKey: boolean;
  serverConfigured: boolean;
  onSave: (p: Preferences) => void;
  onKey: (key: string) => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [draft, setDraft] = useState(() => structuredClone(preferences));
  const [key, setKey] = useState("");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    first.current?.focus();
    return () => previous?.focus();
  }, []);
  const activeCount = draft.actions.filter((a) => a.enabled).length;
  function updateAction(
    index: number,
    changes: Partial<Preferences["actions"][number]>,
  ) {
    if (changes.enabled && !draft.actions[index].enabled && activeCount >= 4) {
      setError("Only four actions can be active. Turn one off first.");
      return;
    }
    setError("");
    setDraft({
      ...draft,
      actions: draft.actions.map((a, i) =>
        i === index ? { ...a, ...changes } : a,
      ),
    });
  }
  function addPrompt(presetId?: string) {
    const preset = promptPresets.find((p) => p.id === presetId);
    const shortcut =
      "123456789abcdefghijklmnopqrstuvwxyz"
        .split("")
        .find((key) => !draft.actions.some((a) => a.shortcut === key)) || "1";
    setDraft({
      ...draft,
      actions: [
        ...draft.actions,
        {
          id: crypto.randomUUID(),
          label: preset?.label || "New prompt",
          prompt: preset?.prompt || "",
          shortcut,
          enabled: false,
        },
      ],
    });
    setError("");
    setNotice(
      "Added to your library, switched off. Edit it and save your preferences.",
    );
  }
  function save() {
    const result = preferencesSchema.safeParse(draft);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    onSave(result.data);
    setError("");
    setNotice("Reading preferences saved.");
  }
  function addKey() {
    const value = key.trim();
    if (!/^sk-[A-Za-z0-9_-]{16,}$/.test(value)) {
      setError("Enter a valid OpenAI API key beginning with sk-.");
      return;
    }
    onKey(value);
    setKey("");
    setError("");
    setNotice(
      "Key added for this tab. It will be checked on your first AI request.",
    );
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        className="settings-card reader-settings"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            if (recording) setRecording(false);
            else onClose();
          }
          if (e.key === "Tab") {
            const nodes = Array.from(
              dialog.current!.querySelectorAll<HTMLElement>(
                "button:not(:disabled), a[href], input, textarea, select",
              ),
            ).filter((el) => el.offsetParent !== null);
            const edge = e.shiftKey ? nodes[0] : nodes.at(-1);
            if (document.activeElement === edge) {
              e.preventDefault();
              (e.shiftKey ? nodes.at(-1) : nodes[0])?.focus();
            }
          }
        }}
      >
        <header>
          <span className="eyebrow">YOUR READING SPACE</span>
          <button
            ref={first}
            className="icon-button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <h2>Make Margin yours.</h2>
        <p>A quieter way to read, with your own tools.</p>
        <nav className="settings-tabs" aria-label="Settings sections">
          {(
            [
              { id: "connection", label: "API key", icon: KeyRound },
              { id: "controls", label: "Controls", icon: Keyboard },
              { id: "prompts", label: "Prompts", icon: Sparkles },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "selected" : ""}
              aria-pressed={tab === t.id}
              onClick={() => {
                setTab(t.id);
                setError("");
                setNotice("");
                setRecording(false);
              }}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {tab === "connection" && (
            <>
              <div className="connection-card">
                <KeyRound size={20} />
                <div>
                  <strong>
                    {hasSessionKey
                      ? "Session key added"
                      : serverConfigured
                        ? "Server key configured"
                        : "Connect when you are ready"}
                  </strong>
                  <p>
                    {hasSessionKey
                      ? "Ready for your next request. This does not verify your balance or model access."
                      : serverConfigured
                        ? "A server key is available. You can use your own key for this tab instead."
                        : "Read and explore without a key. Add one before asking AI to explain a selection."}
                  </p>
                </div>
              </div>
              <label htmlFor="api-key">OpenAI API key</label>
              <input
                id="api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-…"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                maxLength={300}
              />
              <p className="settings-help">
                Kept in memory for this tab only. Cleared on refresh. Sent
                through this app’s server to OpenAI when you ask a question;
                never saved to browser storage or an environment file.
              </p>
              <div className="connection-actions">
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                >
                  Get an OpenAI API key <ExternalLink size={12} />
                </a>
                <button
                  className="button primary"
                  disabled={!key.trim()}
                  onClick={addKey}
                >
                  Use key for this tab
                </button>
              </div>
              {hasSessionKey && (
                <button
                  className="disconnect-key"
                  onClick={() => {
                    onDisconnect();
                    setNotice("Session key removed.");
                  }}
                >
                  Remove session key
                </button>
              )}
              <p className="settings-help">
                OpenAI usage is billed to the key’s project. No API request is
                made when you save a key here. Your first question uploads the
                full PDF; uploaded AI files expire after 1 hour. Full-paper
                context uses more input tokens than a selection alone.
              </p>
            </>
          )}
          {tab === "controls" && (
            <>
              <div className="setting-row">
                <div>
                  <strong>How the wheel opens</strong>
                  <p>Keyboard is the default. Hover is optional.</p>
                </div>
                <select
                  aria-label="Wheel trigger"
                  value={draft.hover ? "hover" : "keyboard"}
                  onChange={(e) =>
                    setDraft({ ...draft, hover: e.target.value === "hover" })
                  }
                >
                  <option value="keyboard">Keyboard only</option>
                  <option value="hover">Keyboard + hover</option>
                </select>
              </div>
              <div className="setting-row">
                <div>
                  <strong>Open wheel shortcut</strong>
                  <p>
                    Point at the paper or select text, then press your shortcut.
                  </p>
                </div>
                <button
                  className={`shortcut-recorder ${recording ? "recording" : ""}`}
                  aria-label="Change wheel shortcut"
                  onClick={() => {
                    setRecording(true);
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (!recording || e.key === "Tab" || e.key === "Escape")
                      return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (!/^(Key[A-Z]|Digit[0-9]|Space)$/.test(e.code)) return;
                    if (!e.altKey && !e.ctrlKey && !e.metaKey) {
                      setError("Include Alt, Control or Command.");
                      return;
                    }
                    setDraft({
                      ...draft,
                      shortcut: keyboardBinding(e.nativeEvent),
                    });
                    setRecording(false);
                    setError("");
                  }}
                >
                  {recording
                    ? "Press a shortcut…"
                    : shortcutLabel(draft.shortcut)}
                </button>
              </div>
              <p className="settings-help">
                Avoid shortcuts already used by your browser or operating
                system. Shortcuts are inactive while you type in a field. Escape
                closes the wheel.
              </p>
              {draft.hover && (
                <div className="setting-note">
                  Hover opens the wheel after 0.7 seconds. Moving into the wheel
                  keeps the selected content locked.
                </div>
              )}
              <div className="setting-note">
                Text selection stays highlighted until you open the wheel.
                Box-selecting a figure opens it directly. You can also use the
                toolbar’s Open wheel button.
              </div>
            </>
          )}
          {tab === "prompts" && (
            <>
              <div className="library-heading">
                <div>
                  <strong>Prompt library</strong>
                  <p>
                    {draft.actions.length} saved ·{" "}
                    <b>{activeCount} / 4 active</b>
                  </p>
                </div>
                <button className="button" onClick={() => addPrompt()}>
                  <Plus size={14} />
                  New prompt
                </button>
              </div>
              <p className="prompts-intro">
                Keep as many prompts as you need. Switch on up to four for the
                wheel. Action keys work while the wheel is open.
              </p>
              <label className="translation-setting">
                Translate into
                <select
                  aria-label="Translation language"
                  value={draft.translationLanguage}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      translationLanguage: e.target
                        .value as Preferences["translationLanguage"],
                    })
                  }
                >
                  {translationLanguages.map((language) => (
                    <option key={language}>{language}</option>
                  ))}
                </select>
              </label>
              <div className="preset-source">
                <span>
                  Logic, results and reviewer presets draw on{" "}
                  <a href={researchSource} target="_blank" rel="noreferrer">
                    awesome-ai-research-writing <ExternalLink size={10} />
                  </a>
                  , adapted for selected excerpts.
                </span>
              </div>
              <select
                className="add-preset"
                aria-label="Add preset to library"
                value=""
                onChange={(e) => addPrompt(e.target.value)}
              >
                <option value="" disabled>
                  Add a research or reading preset…
                </option>
                {promptPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <div className="prompt-editors">
                {draft.actions.map((action, i) => (
                  <details className="prompt-editor" key={action.id}>
                    <summary>
                      <label
                        className="library-toggle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Enable ${action.label}`}
                          checked={action.enabled}
                          onChange={(e) =>
                            updateAction(i, { enabled: e.target.checked })
                          }
                        />
                      </label>
                      <strong>{action.label || `Prompt ${i + 1}`}</strong>
                      <kbd>{action.shortcut.toUpperCase() || "—"}</kbd>
                      <span className="slot-status">
                        {action.enabled ? "On" : "Off"}
                      </span>
                    </summary>
                    <div className="prompt-fields">
                      <div className="prompt-field-row">
                        <label>
                          Label
                          <input
                            aria-label={`Prompt ${i + 1} label`}
                            maxLength={24}
                            value={action.label}
                            onChange={(e) =>
                              updateAction(i, { label: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Action key
                          <input
                            aria-label={`Prompt ${i + 1} shortcut`}
                            maxLength={1}
                            value={action.shortcut}
                            onChange={(e) =>
                              updateAction(i, {
                                shortcut: e.target.value.toLowerCase(),
                              })
                            }
                          />
                        </label>
                      </div>
                      <label>
                        Prompt
                        <textarea
                          aria-label={`Prompt ${i + 1} text`}
                          rows={5}
                          maxLength={3000}
                          value={action.prompt}
                          onChange={(e) =>
                            updateAction(i, { prompt: e.target.value })
                          }
                        />
                      </label>
                      <p className="settings-help">
                        The full paper, current page and selection are attached
                        when you ask AI. Use {"{{target_language}}"} to insert
                        your chosen translation language.
                      </p>
                      <button
                        className="delete-prompt"
                        disabled={draft.actions.length === 1}
                        onClick={() => {
                          setDraft({
                            ...draft,
                            actions: draft.actions.filter((_, j) => i !== j),
                          });
                          setNotice(
                            "Prompt removed from this draft. Save to apply.",
                          );
                        }}
                      >
                        <Trash2 size={12} />
                        Remove from library
                      </button>
                    </div>
                  </details>
                ))}
              </div>
            </>
          )}
          {error && (
            <p className="settings-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="settings-success" role="status">
              {notice}
            </p>
          )}
        </div>
        <footer>
          <button
            className="reset-settings"
            onClick={() => {
              setDraft(structuredClone(defaultPreferences));
              setError("");
              setNotice("Defaults restored in this form. Save to apply.");
            }}
          >
            Reset preferences
          </button>
          <div>
            {tab !== "connection" && (
              <button className="button primary" onClick={save}>
                <Check size={15} />
                Save preferences
              </button>
            )}
            <button className="button" onClick={onClose}>
              Done
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
