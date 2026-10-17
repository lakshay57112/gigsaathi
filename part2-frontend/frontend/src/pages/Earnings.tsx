import { useRef, useState, type FormEvent } from "react";
import { Alert, Button, Card, ErrorBox, focusFirstInvalid, PageTitle, Spinner, TextField } from "../components/ui";
import { useApp } from "../context";
import { api, ApiError } from "../lib/api";
import { formatINR, formatLongDate, localISODate } from "../lib/format";
import { toNumber, validateEarnings, type EarningsForm, type FormErrors } from "../lib/validation";
import { useAsync } from "../lib/useAsync";

const emptyForm = (): EarningsForm => ({
  entry_date: localISODate(),
  gross: "",
  hours: "",
  expenses: "",
  note: "",
});

export default function Earnings() {
  const { t, meta } = useApp();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<EarningsForm>(emptyForm);
  const [errors, setErrors] = useState<FormErrors<keyof EarningsForm>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const history = useAsync(api.listEarnings);

  const set = (field: keyof EarningsForm) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setSaved(false);
  };

  const gross = Number(form.gross);
  const expenses = Number(form.expenses);
  const showNet = form.gross !== "" && form.expenses !== "" && Number.isFinite(gross) && Number.isFinite(expenses);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setFormError(null);
    const found = validateEarnings(form, meta.max_amount, localISODate());
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // wait a tick so aria-invalid is on the fields before moving focus
      setTimeout(() => focusFirstInvalid(formRef.current), 0);
      return;
    }
    setSaving(true);
    try {
      await api.addEarnings({
        entry_date: form.entry_date,
        gross: toNumber(form.gross),
        hours: toNumber(form.hours),
        expenses: toNumber(form.expenses),
        note: form.note.trim(),
      });
      setForm({ ...emptyForm(), entry_date: form.entry_date });
      setSaved(true);
      history.reload();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors as FormErrors<keyof EarningsForm>);
        setTimeout(() => focusFirstInvalid(formRef.current), 0);
      }
      setFormError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number, date: string) {
    if (!window.confirm(`${t("delete")}: ${formatLongDate(date)}?`)) return;
    try {
      await api.deleteEarnings(id);
    } finally {
      history.reload();
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <>
      <PageTitle>{t("earn_title")}</PageTitle>

      <Card title={t("earn_add")}>
        <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
          {hasErrors && <Alert tone="error">{formError ?? "Please check the highlighted fields."}</Alert>}
          {!hasErrors && formError && <Alert tone="error">{formError}</Alert>}

          <TextField label={t("earn_date")} type="date" value={form.entry_date} max={localISODate()} onChange={set("entry_date")} error={errors.entry_date} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t("earn_gross")} type="number" inputMode="decimal" min="0" step="0.01" value={form.gross} onChange={set("gross")} error={errors.gross} required />
            <TextField label={t("earn_hours")} type="number" inputMode="decimal" min="0" max="24" step="0.25" value={form.hours} onChange={set("hours")} error={errors.hours} required />
          </div>
          <TextField label={t("earn_expenses")} hint={t("earn_expensesHint")} type="number" inputMode="decimal" min="0" step="0.01" value={form.expenses} onChange={set("expenses")} error={errors.expenses} required />
          <TextField label={t("earn_note")} maxLength={200} value={form.note} onChange={set("note")} error={errors.note} />

          <p aria-live="polite" className="rounded-lg bg-neutral-50 px-4 py-3 text-neutral-800">
            {showNet ? (
              <>
                {t("earn_net")}: <strong>{formatINR(gross - expenses)}</strong>
              </>
            ) : (
              t("earn_netFormula")
            )}
          </p>

          <Button type="submit" disabled={saving}>
            {t("earn_submit")}
          </Button>
          {saved && <Alert tone="success">{t("earn_saved")}</Alert>}
        </form>
      </Card>

      <div className="mt-6">
        <Card title={t("earn_history")}>
          {history.loading && !history.data && <Spinner />}
          {history.error && <ErrorBox error={history.error} onRetry={history.reload} />}
          {history.data?.length === 0 && <p className="text-neutral-700">{t("earn_none")}</p>}
          {history.data && history.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">{t("earn_history")}</caption>
                <thead>
                  <tr className="border-b border-neutral-300 text-neutral-700">
                    <th scope="col" className="py-2 pr-3 font-medium">{t("earn_date")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t("earn_gross")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t("earn_expenses")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t("earn_net")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t("earn_hours")}</th>
                    <th scope="col" className="py-2"><span className="sr-only">{t("delete")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-200">
                      <th scope="row" className="py-2 pr-3 font-normal">
                        {formatLongDate(row.entry_date)}
                        {row.note && <span className="block text-neutral-600">{row.note}</span>}
                      </th>
                      <td className="py-2 pr-3 text-right">{formatINR(row.gross)}</td>
                      <td className="py-2 pr-3 text-right">{formatINR(row.expenses)}</td>
                      <td className="py-2 pr-3 text-right font-semibold">{formatINR(row.net)}</td>
                      <td className="py-2 pr-3 text-right">{row.hours}</td>
                      <td className="py-2 text-right">
                        <Button variant="danger" className="min-h-9 px-3 py-1 text-sm" onClick={() => remove(row.id, row.entry_date)} aria-label={`${t("delete")} ${formatLongDate(row.entry_date)}`}>
                          {t("delete")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
