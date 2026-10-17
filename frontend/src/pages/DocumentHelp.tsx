import { useState, type FormEvent } from "react";
import { VoiceButton } from "../components/VoiceButton";
import { PayoutResult } from "../components/PayoutResult";
import { AiNote, AiText, Alert, Button, Card, ErrorBox, PageTitle, Spinner, TextAreaField } from "../components/ui";
import { useApp } from "../context";
import { api, ApiError } from "../lib/api";
import { localISODate } from "../lib/format";
import { buildGrievancePrefill, buildPayoutPrefill, savePrefill } from "../lib/prefill";
import { navigate } from "../lib/route";
import type { DocumentExplanation, LabeledValue, PayoutCheck } from "../lib/types";

const MIN_CHARS = 20;

type Mode = "explain" | "payout";

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
  const [payout, setPayout] = useState<PayoutCheck | null>(null);
  const [resultLanguage, setResultLanguage] = useState(language);
  const [mode, setMode] = useState<Mode>("explain");

  const trimmed = text.trim();
  const tooShort = trimmed.length < MIN_CHARS;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (tooShort || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPayout(null);
    try {
      if (mode === "payout") setPayout(await api.checkPayout(trimmed, language));
      else setResult(await api.explainDocument(trimmed, language));
      setResultLanguage(language);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, "error", "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  function draftComplaint() {
    if (payout) savePrefill(buildPayoutPrefill(payout));
    else if (result) savePrefill(buildGrievancePrefill(result, localISODate()));
    else return;
    navigate("/grievance");
  }

  function changeMode(next: Mode) {
    setMode(next);
    setResult(null);
    setPayout(null);
    setError(null);
  }

  return (
    <>
      <PageTitle intro={mode === "payout" ? t("po_intro") : t("doc_intro")}>{t("doc_title")}</PageTitle>

      <fieldset className="mb-4">
        <legend className="mb-1 text-sm font-medium">{t("doc_modeLabel")}</legend>
        <div className="flex flex-wrap gap-x-6">
          {(
            [
              ["explain", "doc_modeExplain"],
              ["payout", "doc_modePayout"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-11 items-center gap-2">
              <input type="radio" name="mode" className="size-5 accent-green-700" checked={mode === value} onChange={() => changeMode(value)} />
              {t(label)}
            </label>
          ))}
        </div>
      </fieldset>

      <form onSubmit={submit} className="space-y-4">
        <TextAreaField
          label={mode === "payout" ? t("po_label") : t("doc_label")}
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
          {loading ? (mode === "payout" ? t("po_checking") : t("explaining")) : mode === "payout" ? t("po_submit") : t("doc_submit")}
        </Button>
      </form>

      <div className="mt-6" aria-live="polite">
        {loading && <Spinner label={mode === "payout" ? t("po_checking") : t("explaining")} />}
        {error && <ErrorBox error={error} />}
        {payout && <PayoutResult result={payout} language={resultLanguage} onComplain={draftComplaint} />}
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
      {!result && !payout && <div className="mt-4"><AiNote /></div>}
    </>
  );
}
