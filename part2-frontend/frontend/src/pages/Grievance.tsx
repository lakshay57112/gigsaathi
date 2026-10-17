import { useRef, useState, type FormEvent } from "react";
import { Alert, Button, Card, ErrorBox, focusFirstInvalid, PageTitle, SelectField, Spinner, TextAreaField, TextField } from "../components/ui";
import { VoiceButton } from "../components/VoiceButton";
import { useApp } from "../context";
import { api, ApiError } from "../lib/api";
import { deleteDraft, loadDrafts, saveDraft, type SavedDraft } from "../lib/drafts";
import { formatLongDate, localISODate } from "../lib/format";
import type { TextKey } from "../lib/i18n";
import { takePrefill } from "../lib/prefill";
import { copyText } from "../lib/text";
import type { GrievanceInput, GrievanceResult, IssueType, Tone } from "../lib/types";

const ISSUE_TYPES: IssueType[] = [
  "unpaid_payment",
  "incentive_not_paid",
  "unfair_deduction",
  "account_blocked",
  "penalty_or_rating",
  "safety_incident",
  "other",
];
const TONES: { value: Tone; label: TextKey }[] = [
  { value: "polite", label: "gr_polite" },
  { value: "professional", label: "gr_professional" },
  { value: "firm", label: "gr_firm" },
];

interface FormState {
  issue_type: IssueType;
  platform: string;
  incident_date: string;
  amount: string;
  description: string;
  tone: Tone;
}

export default function Grievance() {
  const { t, meta, language } = useApp();
  const formRef = useRef<HTMLFormElement>(null);
  // Values carried over from Document Help are read once, when the page opens.
  const [prefill] = useState(takePrefill);
  const [form, setForm] = useState<FormState>(() => ({
    issue_type: prefill?.issue_type ?? "unpaid_payment",
    platform: prefill?.platform ?? "",
    incident_date: prefill?.incident_date ?? "",
    amount: prefill?.amount ?? "",
    description: prefill?.description ?? "",
    tone: "professional",
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [draft, setDraft] = useState<GrievanceResult | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draftLanguage, setDraftLanguage] = useState(language);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState<SavedDraft[]>(() => loadDrafts());

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm((f) => ({ ...f, [field]: value }));

  function validate(): boolean {
    const found: Partial<Record<keyof FormState, string>> = {};
    if (!form.platform.trim()) found.platform = "Enter the company or platform name.";
    if (form.description.trim().length < 10) found.description = "Please describe what happened (at least 10 characters).";
    if (form.incident_date && form.incident_date > localISODate()) found.incident_date = "The date cannot be in the future.";
    if (form.amount !== "" && (!Number.isFinite(Number(form.amount)) || Number(form.amount) < 0 || Number(form.amount) > meta.max_amount)) {
      found.amount = "Enter a valid amount, or leave it empty.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) setTimeout(() => focusFirstInvalid(formRef.current), 0);
    return Object.keys(found).length === 0;
  }

  async function generate() {
    if (!validate()) return;
    const input: GrievanceInput = {
      issue_type: form.issue_type,
      platform: form.platform.trim(),
      incident_date: form.incident_date || null,
      amount: form.amount === "" ? null : Number(form.amount),
      description: form.description.trim(),
      language,
      tone: form.tone,
    };
    setLoading(true);
    setError(null);
    setNotice("");
    try {
      const result = await api.draftGrievance(input);
      setDraft(result);
      setSubject(result.subject);
      setBody(result.body);
      setDraftLanguage(language);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, "error", "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void generate();
  }

  async function copy() {
    setNotice((await copyText(`${subject}\n\n${body}`)) ? t("copied") : "Copy failed. Please select the text and copy it yourself.");
  }

  function save() {
    setSaved(saveDraft({ platform: form.platform.trim(), subject, body }));
    setNotice(t("gr_saved"));
  }

  function open(item: SavedDraft) {
    setDraft({ subject: item.subject, body: item.body, missing_details: [] });
    setSubject(item.subject);
    setBody(item.body);
    setNotice("");
  }

  return (
    <>
      <PageTitle intro={t("gr_intro")}>{t("gr_title")}</PageTitle>

      {prefill && <div className="mb-4"><Alert tone="info">{t("gr_prefilled")}</Alert></div>}

      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
        <SelectField label={t("gr_issue")} value={form.issue_type} onChange={(e) => set("issue_type", e.target.value as IssueType)}>
          {ISSUE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`issue_${type}` as TextKey)}
            </option>
          ))}
        </SelectField>
        <TextField label={t("gr_platform")} value={form.platform} maxLength={100} onChange={(e) => set("platform", e.target.value)} error={errors.platform} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("gr_date")} type="date" value={form.incident_date} max={localISODate()} onChange={(e) => set("incident_date", e.target.value)} error={errors.incident_date} />
          <TextField label={t("gr_amount")} type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} error={errors.amount} />
        </div>
        <TextAreaField label={t("gr_description")} hint={t("gr_descriptionHint")} rows={6} maxLength={2000} value={form.description} onChange={(e) => set("description", e.target.value)} error={errors.description} required />
        <VoiceButton onText={(text) => set("description", form.description ? `${form.description} ${text}` : text)} />

        <fieldset>
          <legend className="mb-1 text-sm font-medium">{t("gr_tone")}</legend>
          <div className="flex flex-wrap gap-4">
            {TONES.map((tone) => (
              <label key={tone.value} className="flex min-h-11 items-center gap-2">
                <input type="radio" name="tone" className="size-5 accent-green-700" checked={form.tone === tone.value} onChange={() => set("tone", tone.value)} />
                {t(tone.label)}
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit" disabled={loading}>
          {draft ? t("gr_regenerate") : t("gr_submit")}
        </Button>
      </form>

      <div className="mt-6" aria-live="polite">
        {loading && <Spinner label={t("explaining")} />}
        {error && <ErrorBox error={error} />}
      </div>

      {draft && !loading && (
        <div className="mt-2 space-y-4">
          <Card title={t("gr_body")}>
            <div lang={draftLanguage} className="space-y-4">
              {draft.missing_details.length > 0 && (
                <Alert tone="warning">
                  <strong>{t("gr_missing")}:</strong> {draft.missing_details.join(", ")}
                </Alert>
              )}
              <TextField label={t("gr_subject")} value={subject} onChange={(e) => setSubject(e.target.value)} />
              <TextAreaField label={t("gr_body")} rows={16} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <p className="mt-3 text-sm text-neutral-700">{t("gr_review")}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => void copy()}>{t("copy")}</Button>
              <Button variant="secondary" onClick={() => void generate()}>
                {t("gr_regenerate")}
              </Button>
              <Button variant="secondary" onClick={save}>
                {t("gr_saveDraft")}
              </Button>
            </div>
            <p role="status" className="mt-3 text-sm font-medium text-green-800">
              {notice}
            </p>
          </Card>
        </div>
      )}

      <div className="mt-8">
        <Card title={t("gr_savedTitle")}>
          {saved.length === 0 ? (
            <p className="text-neutral-700">{t("gr_noSaved")}</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {saved.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span>
                    <span className="block font-medium">{item.subject || item.platform}</span>
                    <span className="text-sm text-neutral-600">{formatLongDate(item.savedAt.slice(0, 10))}</span>
                  </span>
                  <span className="flex gap-2">
                    <Button variant="secondary" className="min-h-9 px-3 py-1 text-sm" onClick={() => open(item)}>
                      {t("gr_open")}
                    </Button>
                    <Button variant="danger" className="min-h-9 px-3 py-1 text-sm" onClick={() => setSaved(deleteDraft(item.id))}>
                      {t("delete")}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
