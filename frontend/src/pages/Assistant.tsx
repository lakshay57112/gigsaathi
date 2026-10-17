import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AiNote, AiText, Button, PageTitle } from "../components/ui";
import { VoiceButton } from "../components/VoiceButton";
import { useApp } from "../context";
import { api, ApiError } from "../lib/api";
import type { TextKey } from "../lib/i18n";
import type { ChatTurn } from "../lib/types";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  failed?: boolean;
  usedEarnings?: boolean;
  usedSchemes?: boolean;
}

const CHIPS: TextKey[] = ["ai_chip1", "ai_chip2", "ai_chip3", "ai_chip4"];
const MAX_HISTORY = 10;

export default function Assistant() {
  const { t, language } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;

    // Earlier successful turns give the assistant context for follow-up questions.
    const history: ChatTurn[] = messages
      .filter((m) => !m.failed)
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((m) => [...m, { id: nextId.current++, role: "user", text: question }]);
    setInput("");
    setSending(true);
    try {
      const result = await api.chat(question, language, history);
      setMessages((m) => [
        ...m,
        {
          id: nextId.current++,
          role: "assistant",
          text: result.reply,
          usedEarnings: result.used_earnings_data,
          usedSchemes: result.used_scheme_data,
        },
      ]);
    } catch (e) {
      const reason = e instanceof ApiError ? e.message : "";
      setMessages((m) => [
        ...m,
        { id: nextId.current++, role: "assistant", text: `${t("ai_failure")}${reason ? `\n${reason}` : ""}`, failed: true },
      ]);
    } finally {
      setSending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  }

  return (
    <>
      <PageTitle intro={t("ai_intro")}>{t("ai_title")}</PageTitle>

      {messages.length === 0 && (
        <section aria-labelledby="try-heading" className="mb-6">
          <h2 id="try-heading" className="mb-2 text-sm font-medium text-neutral-700">
            {t("ai_suggestions")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {CHIPS.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => void send(t(key))}
                  className="min-h-11 rounded-full border border-neutral-300 bg-white px-4 py-2 text-left text-sm hover:bg-neutral-100"
                >
                  {t(key)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div role="log" aria-live="polite" aria-label={t("ai_title")} className="space-y-4">
        {messages.map((m) => (
          <article
            key={m.id}
            className={`rounded-xl border p-4 ${
              m.role === "user" ? "ml-8 border-neutral-900 bg-neutral-950 text-white" : m.failed ? "mr-8 border-red-300 bg-red-50" : "mr-8 border-neutral-200 bg-white"
            }`}
          >
            <h2 className={`mb-1 text-xs font-semibold uppercase tracking-wide ${m.role === "user" ? "text-neutral-300" : "text-neutral-600"}`}>
              {m.role === "user" ? t("ai_you") : t("ai_assistant")}
            </h2>
            {m.role === "user" ? <p className="whitespace-pre-wrap">{m.text}</p> : m.failed ? <p className="whitespace-pre-wrap text-red-900">{m.text}</p> : <AiText text={m.text} language={language} />}
            {m.usedEarnings && <p className="mt-2 text-sm text-green-800">{t("ai_usedEarnings")}</p>}
            {m.usedSchemes && <p className="mt-2 text-sm text-green-800">{t("ai_usedSchemes")}</p>}
          </article>
        ))}
        {sending && (
          <p role="status" className="mr-8 rounded-xl border border-neutral-200 p-4 text-neutral-700">
            {t("ai_thinking")}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <label htmlFor="question" className="sr-only">
          {t("ai_placeholder")}
        </label>
        <textarea
          id="question"
          rows={3}
          maxLength={1000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("ai_placeholder")}
          className="block w-full rounded-lg border border-neutral-400 bg-white px-3 py-2 text-base placeholder:text-neutral-500"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={sending || input.trim() === ""}>
            {t("ai_send")}
          </Button>
          <VoiceButton onText={(text) => setInput((current) => (current ? `${current} ${text}` : text))} />
        </div>
      </form>

      <div className="mt-4">
        <AiNote />
      </div>
    </>
  );
}
