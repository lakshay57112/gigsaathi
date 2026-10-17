import { useState, type FormEvent } from "react";
import { VoiceButton } from "../components/VoiceButton";
import { AiNote, AiText, Alert, Button, Card, ErrorBox, PageTitle, Spinner, TextAreaField } from "../components/ui";
import { useApp } from "../context";
import { api, ApiError } from "../lib/api";
import { localISODate } from "../lib/format";
import { buildGrievancePrefill, savePrefill } from "../lib/prefill";
import { navigate } from "../lib/route";
import type { DocumentExplanation, LabeledValue } from "../lib/types";

const MIN_CHARS = 20;

function Pairs({ title, items }: { title: string; items: LabeledValue[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <dl className="mt-1 space-y-1">
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex flex-wrap gap-x-2">
            <dt className="text-neutral-700">{item.label}:</dt>
            <dd className="font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function DocumentHelp() {
  const { t, meta, language } = useApp();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<DocumentExplanation | null>(null);
  const [resultLanguage, setResultLanguage] = useState(language);

  const trimmed = text.trim();
  const tooShort = trimmed.length < MIN_CHARS;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (tooShort || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.explainDocument(trimmed, language));
      setResultLanguage(language);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, "error", "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  function draftComplaint() {
    if (!result) return;
    savePrefill(buildGrievancePrefill(result, localISODate()));
    navigate("/grievance");
  }

  return (
    <>
      <PageTitle intro={t("doc_intro")}>{t("doc_title")}</PageTitle>

      <form onSubmit={submit} className="space-y-4">
        <TextAreaField
          label={t("doc_label")}
          hint={t("doc_privacy")}
          rows={9}
          maxLength={meta.max_document_chars}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <VoiceButton
            label={t("voice_document")}
            onText={(spoken) => setText((current) => (current ? `${current} ${spoken}` : spoken).slice(0, meta.max_document_chars))}
          />
          <p className="text-sm text-neutral-600">
            {text.length} / {meta.max_document_chars}
          </p>
        </div>
        <Button type="submit" disabled={tooShort || loading}>
          {loading ? t("explaining") : t("doc_submit")}
        </Button>
      </form>

      <div className="mt-6" aria-live="polite">
        {loading && <Spinner label={t("explaining")} />}
        {error && <ErrorBox error={error} />}
        {result && (
          <Card>
            <div lang={resultLanguage} className="space-y-5">
              <div>
                <h3 className="font-semibold">{t("doc_summary")}</h3>
                <AiText text={result.summary} language={resultLanguage} />
              </div>
              <Pairs title={t("doc_dates")} items={result.key_dates} />
              <Pairs title={t("doc_amounts")} items={result.amounts} />
              <Bullets title={t("doc_actions")} items={result.action_items} />
              {result.warnings.length > 0 && (
                <Alert tone="warning">
                  <strong>{t("doc_warnings")}</strong>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {result.warnings.map((w, i) => (
                      <li key={`${w}-${i}`}>{w}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </div>
            <div className="mt-5 space-y-3">
              <Button onClick={draftComplaint}>{t("doc_complain")}</Button>
              <p className="text-sm text-neutral-700">{t("doc_verify")}</p>
            </div>
          </Card>
        )}
      </div>
      {!result && <div className="mt-4"><AiNote /></div>}
    </>
  );
}
