import { useState } from "react";
import { Alert, Button, buttonClass, Card, ErrorBox, PageTitle, SelectField, Spinner, TextField } from "../components/ui";
import { useApp } from "../context";
import { api } from "../lib/api";
import { formatHours, formatINR, formatLongDate, localISODate } from "../lib/format";
import type { TextKey } from "../lib/i18n";
import { formatMonth, PERIODS, periodRange, type PeriodId } from "../lib/statementPeriod";
import { useAsync } from "../lib/useAsync";

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-300 p-3">
      <dt className="text-sm text-neutral-700">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}

export default function Statement() {
  const { t } = useApp();
  const [period, setPeriod] = useState<PeriodId>("p90");
  const [name, setName] = useState("");
  const days = PERIODS.find((p) => p.id === period)!.days;

  return (
    <>
      <div className="print:hidden">
        <PageTitle intro={t("st_intro")}>{t("st_title")}</PageTitle>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <SelectField label={t("st_period")} value={period} onChange={(e) => setPeriod(e.target.value as PeriodId)}>
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>
                {t(`st_${p.id}` as TextKey)}
              </option>
            ))}
          </SelectField>
          <TextField label={t("st_name")} hint={t("st_nameHint")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>

      {/* A new view per period, so each choice loads fresh data. */}
      <StatementView key={period} days={days} name={name} />
    </>
  );
}

function StatementView({ days, name }: { days: number; name: string }) {
  const { t } = useApp();
  const { start, end } = periodRange(days, localISODate());
  const statement = useAsync(() => api.getStatement(start, end));
  const data = statement.data;
  const empty = data !== null && data.entries.length === 0;

  return (
    <>
      <div aria-live="polite">
        {statement.loading && !data && <Spinner />}
        {statement.error && <ErrorBox error={statement.error} onRetry={statement.reload} />}
      </div>

      {empty && (
        <Card>
          <p className="text-neutral-800">{t("st_none")}</p>
          <p className="mt-3">
            <a href="#/earnings" className={buttonClass("primary")}>
              {t("st_add")}
            </a>
          </p>
        </Card>
      )}

      {data && !empty && (
        <>
          <div className="mb-4 print:hidden">
            <Button onClick={() => window.print()}>{t("st_print")}</Button>
          </div>

          <article aria-label={t("st_heading")} className="rounded-xl border border-neutral-300 p-5 print:border-0 print:p-0">
            <h2 className="text-2xl font-semibold">{t("st_heading")}</h2>
            {name.trim() && <p className="mt-1 text-lg">{name.trim()}</p>}
            <p className="mt-1 text-neutral-700">
              {formatLongDate(data.start)} – {formatLongDate(data.end)}
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              {t("st_generated")}: {formatLongDate(data.generated_on)}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Figure label={t("st_totalGross")} value={formatINR(data.totals.gross)} />
              <Figure label={t("st_totalExpenses")} value={formatINR(data.totals.expenses)} />
              <Figure label={t("st_totalNet")} value={formatINR(data.totals.net)} />
              <Figure label={t("st_totalHours")} value={formatHours(data.totals.hours)} />
              <Figure label={t("st_daysWorked")} value={String(data.days_worked)} />
              <Figure
                label={t("st_avgMonth")}
                value={formatINR(data.months.length > 0 ? Math.round(data.totals.net / data.months.length) : 0)}
              />
            </dl>

            <h3 className="mt-6 text-lg font-semibold">{t("st_months")}</h3>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[30rem] text-left text-sm">
                <caption className="sr-only">{t("st_months")}</caption>
                <thead>
                  <tr className="border-b border-neutral-400 text-neutral-700">
                    <th scope="col" className="py-2 pr-3 font-medium">{t("st_month")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t("earn_gross")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t("earn_expenses")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t("earn_net")}</th>
                    <th scope="col" className="py-2 text-right font-medium">{t("st_daysWorked")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((m) => (
                    <tr key={m.month} className="border-b border-neutral-200">
                      <th scope="row" className="py-2 pr-3 font-normal">{formatMonth(m.month)}</th>
                      <td className="py-2 pr-3 text-right">{formatINR(m.gross)}</td>
                      <td className="py-2 pr-3 text-right">{formatINR(m.expenses)}</td>
                      <td className="py-2 pr-3 text-right font-semibold">{formatINR(m.net)}</td>
                      <td className="py-2 text-right">{m.days_worked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-6 text-lg font-semibold">{t("st_entries")}</h3>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[30rem] text-left text-sm">
                <caption className="sr-only">{t("st_entries")}</caption>
                <thead>
                  <tr className="border-b border-neutral-400 text-neutral-700">
                    <th scope="col" className="py-2 pr-3 font-medium">{t("earn_date")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t("earn_gross")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t("earn_expenses")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t("earn_net")}</th>
                    <th scope="col" className="py-2 text-right font-medium">{t("earn_hours")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-200 break-inside-avoid">
                      <th scope="row" className="py-1.5 pr-3 font-normal">{formatLongDate(row.entry_date)}</th>
                      <td className="py-1.5 pr-3 text-right">{formatINR(row.gross)}</td>
                      <td className="py-1.5 pr-3 text-right">{formatINR(row.expenses)}</td>
                      <td className="py-1.5 pr-3 text-right">{formatINR(row.net)}</td>
                      <td className="py-1.5 text-right">{row.hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-6 border-t border-neutral-300 pt-3 text-sm text-neutral-800">{t("st_disclaimer")}</p>
          </article>

          <div className="mt-4 print:hidden">
            <Alert tone="info">{t("st_tip")}</Alert>
          </div>
        </>
      )}
    </>
  );
}
