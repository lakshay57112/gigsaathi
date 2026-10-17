import { useState } from "react";
import { AiNote, AiText, Alert, Button, Card, ErrorBox, PageTitle, SelectField, Spinner } from "../components/ui";
import { useApp } from "../context";
import { api, ApiError } from "../lib/api";
import { formatLongDate } from "../lib/format";
import type { Scheme, SchemeResult } from "../lib/types";
import { useAsync } from "../lib/useAsync";

type AiState = { status: "idle" | "loading" | "done" | "error"; text: string };
const IDLE: AiState = { status: "idle", text: "" };

/** One button that asks the AI to re-explain verified content in the worker's language. */
function ExplainButton({ run }: { run: (language: string) => Promise<{ text: string }> }) {
  const { t, language } = useApp();
  const [state, setState] = useState<AiState>(IDLE);

  async function explain() {
    setState({ status: "loading", text: "" });
    try {
      setState({ status: "done", text: (await run(language)).text });
    } catch (e) {
      setState({ status: "error", text: e instanceof ApiError ? e.message : "Something went wrong." });
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <Button variant="secondary" onClick={explain} disabled={state.status === "loading"}>
        {state.status === "loading" ? t("explaining") : t("explainIn")}
      </Button>
      <div aria-live="polite">
        {state.status === "done" && (
          <div className="space-y-2 rounded-lg bg-neutral-50 p-4">
            <AiText text={state.text} language={language} />
            <AiNote />
          </div>
        )}
        {state.status === "error" && <Alert tone="error">{state.text}</Alert>}
      </div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-neutral-800">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

const STATUS_LABEL: Record<Scheme["verification_status"], string> = {
  verified: "Verified",
  partially_verified: "Partly verified",
  unverified: "Not verified",
};

function SchemeCard({ scheme }: { scheme: Scheme }) {
  const { t } = useApp();
  const unverified = scheme.verification_status !== "verified";
  return (
    <Card title={scheme.name} headingLevel={3}>
      <p>
        <span
          className={`inline-block rounded-full border px-3 py-0.5 text-sm font-medium ${
            unverified ? "border-amber-400 bg-amber-50 text-amber-900" : "border-green-400 bg-green-50 text-green-900"
          }`}
        >
          {STATUS_LABEL[scheme.verification_status]}
        </span>
      </p>
      <p className="mt-3">{scheme.summary}</p>
      <List title={t("welfare_eligibility")} items={scheme.eligibility} />
      <List title={t("welfare_documents")} items={scheme.documents} />
      <List title={t("welfare_benefits")} items={scheme.benefits} />
      <div className="mt-3">
        <h4 className="text-sm font-semibold">{t("welfare_apply")}</h4>
        <p className="text-neutral-800">{scheme.how_to_apply}</p>
        <p className="mt-1 text-neutral-800">
          {scheme.official_url ? (
            <a href={scheme.official_url} target="_blank" rel="noopener noreferrer" className="font-medium text-green-800 underline">
              {t("welfare_link")}: {scheme.official_url.replace("https://", "")}
            </a>
          ) : (
            t("welfare_noLink")
          )}
        </p>
      </div>
      {scheme.unverified_notes.length > 0 && (
        <div className="mt-3">
          <Alert tone="warning">
            <strong>{t("welfare_notVerified")}:</strong>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {scheme.unverified_notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}
      <p className="mt-3 text-sm text-neutral-600">
        {t("welfare_source")}:{" "}
        <a href={scheme.source_url} target="_blank" rel="noopener noreferrer" className="underline">
          {scheme.source_title}
        </a>
        . {t("welfare_verified")}: {formatLongDate(scheme.last_verified)}.
      </p>
    </Card>
  );
}

function SafetySection() {
  const { t } = useApp();
  const { data, error, loading, reload } = useAsync(api.getSafety);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <section className="on-dark rounded-xl bg-neutral-950 p-5 text-white" aria-labelledby="emergency-heading">
        <h2 id="emergency-heading" className="text-lg font-semibold">
          {t("safe_emergency")}
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {data.emergency.numbers.map((n) => (
            <li key={n.number}>
              <a href={`tel:${n.number}`} className="block min-h-11 rounded-lg border border-neutral-600 px-4 py-3 hover:bg-neutral-800">
                <span className="block text-2xl font-semibold">{n.number}</span>
                <span className="text-sm text-neutral-200">{n.label}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-neutral-200">{t("safe_noCall")}</p>
      </section>

      <p className="text-sm text-neutral-700">{data.disclaimer}</p>

      {data.sections.map((section) => (
        <Card key={section.id} title={section.title} headingLevel={3}>
          <ul className="list-disc space-y-2 pl-5">
            {section.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </Card>
      ))}
      <ExplainButton run={(language) => api.explainSafety(language)} />
    </div>
  );
}

function WelfareSection() {
  const { t, meta, language } = useApp();
  const [occupation, setOccupation] = useState("");
  const [state, setState] = useState("");
  const [result, setResult] = useState<SchemeResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    if (!occupation || !state) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await api.getSchemes(occupation, state));
    } catch (e) {
      setResult(null);
      setError(e instanceof ApiError ? e : new ApiError(0, "error", "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-neutral-700">{t("welfare_intro")}</p>
      <form onSubmit={lookup} className="space-y-4">
        <SelectField label={t("welfare_occupation")} value={occupation} onChange={(e) => setOccupation(e.target.value)} required>
          <option value="">{t("welfare_choose")}</option>
          {Object.entries(meta.occupations).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("welfare_state")} value={state} onChange={(e) => setState(e.target.value)} required>
          <option value="">{t("welfare_choose")}</option>
          {meta.states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectField>
        <Button type="submit" disabled={!occupation || !state || loading}>
          {t("welfare_find")}
        </Button>
      </form>

      {loading && <Spinner />}
      {error && <ErrorBox error={error} />}

      {result && (
        <div className="space-y-4" aria-live="polite">
          {result.schemes.map((scheme) => (
            <SchemeCard key={scheme.id} scheme={scheme} />
          ))}
          <Alert tone="info">
            <ul className="list-disc space-y-1 pl-5">
              {result.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Alert>
          <ExplainButton key={`${result.occupation}-${result.state}-${language}`} run={(lang) => api.explainSchemes(result.occupation, result.state, lang)} />
        </div>
      )}
    </div>
  );
}

export default function SafetyWelfare() {
  const { t } = useApp();
  return (
    <>
      <PageTitle>{t("safe_title")}</PageTitle>
      <div className="space-y-10">
        <section aria-labelledby="safety-heading">
          <h2 id="safety-heading" className="mb-4 text-xl font-semibold">
            {t("safe_tips")}
          </h2>
          <SafetySection />
        </section>
        <section aria-labelledby="welfare-heading">
          <h2 id="welfare-heading" className="mb-4 text-xl font-semibold">
            {t("welfare_title")}
          </h2>
          <WelfareSection />
        </section>
      </div>
    </>
  );
}
