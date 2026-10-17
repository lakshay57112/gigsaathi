import { useState } from "react";
import { AiNote, AiText, Alert, Button, buttonClass, Card, ErrorBox, PageTitle, Spinner } from "../components/ui";
import { useApp } from "../context";
import { api, ApiError } from "../lib/api";
import { formatHours, formatINR, formatShortDate } from "../lib/format";
import { buildWeeklySummary } from "../lib/summary";
import type { Summary } from "../lib/types";
import { useAsync } from "../lib/useAsync";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4">
      <dt className="text-sm text-neutral-600">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
    </div>
  );
}

function DailyBars({ summary }: { summary: Summary }) {
  const { t } = useApp();
  const largest = Math.max(1, ...summary.daily.map((d) => Math.abs(d.net)));
  return (
    <Card title={t("dash_daily")}>
      <ul className="space-y-2">
        {summary.daily.map((day) => {
          const width = day.net === 0 ? 0 : Math.max(2, (Math.abs(day.net) / largest) * 100);
          return (
            <li key={day.date} className="grid grid-cols-[4.5rem_1fr_6rem] items-center gap-3 text-sm">
              <span className="text-neutral-700">{formatShortDate(day.date)}</span>
              <span className="h-3 rounded bg-neutral-100" aria-hidden="true">
                <span
                  className={`block h-3 rounded ${day.net < 0 ? "bg-red-700" : "bg-green-700"}`}
                  style={{ width: `${width}%` }}
                />
              </span>
              <span className="text-right font-medium">{formatINR(day.net)}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AiSummary() {
  const { t, language } = useApp();
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; text: string }>({
    status: "idle",
    text: "",
  });

  async function explain() {
    setState({ status: "loading", text: "" });
    try {
      const result = await api.explainSummary(language);
      setState({ status: "done", text: result.text });
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

export default function Dashboard() {
  const { t } = useApp();
  const { data, error, loading, reload } = useAsync(api.getSummary);

  return (
    <>
      <PageTitle>{t("dash_title")}</PageTitle>
      {loading && <Spinner />}
      {error && <ErrorBox error={error} onRetry={reload} />}

      {data && !data.has_data && (
        <Card>
          <h2 className="text-lg font-semibold">{t("dash_empty")}</h2>
          <p className="mt-1 text-neutral-700">{t("dash_emptyHelp")}</p>
          <a href="#/earnings" className={buttonClass("primary", "mt-4")}>
            {t("dash_add")}
          </a>
        </Card>
      )}

      {data?.has_data && (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={t("dash_today")} value={formatINR(data.today.net)} />
            <Stat label={t("dash_week")} value={formatINR(data.week.net)} />
            <Stat label={t("dash_hours")} value={formatHours(data.week.hours)} />
            <Stat label={t("dash_expenses")} value={formatINR(data.week.expenses)} />
          </dl>

          {data.week_insights.net_per_hour !== null && (
            <p className="text-neutral-800">
              {t("dash_perHour")}: <strong>{formatINR(data.week_insights.net_per_hour)}</strong>
            </p>
          )}

          <DailyBars summary={data} />

          <Card title={t("dash_summary")}>
            <p className="text-sm text-neutral-600">{t("dash_summaryNote")}</p>
            <p className="mt-2">{buildWeeklySummary(data)}</p>
            <AiSummary />
          </Card>
        </div>
      )}
    </>
  );
}
