import { Alert, Button, Card } from "./ui";
import { useApp } from "../context";
import { formatINR } from "../lib/format";
import { payoutNeedsComplaint } from "../lib/prefill";
import type { PayoutCheck } from "../lib/types";

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 border-b border-neutral-200 py-2">
      <dt className="text-neutral-800">{label}</dt>
      <dd className={strong ? "font-semibold" : "font-medium"}>{value}</dd>
    </div>
  );
}

const money = (value: number | null, missing: string) => (value === null ? missing : formatINR(value));

export function PayoutResult({ result, language, onComplain }: { result: PayoutCheck; language: string; onComplain: () => void }) {
  const { t } = useApp();
  const missing = t("po_notOnSlip");

  return (
    <Card>
      <div lang={language} className="space-y-5">
        <div>
          <h3 className="font-semibold">{t("doc_summary")}</h3>
          <p className="mt-1 whitespace-pre-line">{result.summary}</p>
        </div>

        <div>
          <h3 className="font-semibold">{t("po_figures")}</h3>
          <dl className="mt-1">
            <Row label={t("po_totalEarned")} value={money(result.total_earned, missing)} />
            <Row label={t("po_deductionsTotal")} value={money(result.deductions_total, missing)} />
            <Row label={t("po_paidOut")} value={money(result.paid_out, missing)} strong />
          </dl>
        </div>

        {result.adds_up === true && <Alert tone="success">{t("po_addsUp")}</Alert>}
        {result.adds_up === false && result.difference !== null && result.expected_payout !== null && (
          <Alert tone="warning">
            <strong>{t("po_noAddUp")}</strong>{" "}
            {t("po_expected")}: {formatINR(result.expected_payout)}. {t("po_gap")}: {formatINR(Math.abs(result.difference))}{" "}
            {result.difference < 0 ? t("po_paidLess") : t("po_paidMore")}.
          </Alert>
        )}
        {result.adds_up === null && <p className="text-sm text-neutral-700">{t("po_cannotCheck")}</p>}

        {result.deductions.length > 0 && (
          <div>
            <h3 className="font-semibold">{t("po_deductions")}</h3>
            <ul className="mt-2 space-y-3">
              {result.deductions.map((line, index) => {
                const flag = line.ask_about || line.duplicate;
                return (
                  <li
                    key={`${line.label}-${index}`}
                    className={`rounded-lg border p-3 ${flag ? "border-amber-400 bg-amber-50" : "border-neutral-200"}`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{line.label}</span>
                      <span className="font-semibold">{money(line.amount, missing)}</span>
                    </div>
                    {line.plain_meaning && <p className="mt-1 text-neutral-800">{line.plain_meaning}</p>}
                    {flag && (
                      <p className="mt-2 text-sm font-medium text-amber-900">
                        {t("po_askAbout")}
                        {line.reason ? `: ${line.reason}` : ""}
                        {line.duplicate ? ` ${t("po_duplicate")}` : ""}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {result.questions_to_ask.length > 0 && (
          <div>
            <h3 className="font-semibold">{t("po_questions")}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {result.questions_to_ask.map((q, i) => (
                <li key={`${q}-${i}`}>{q}</li>
              ))}
            </ul>
          </div>
        )}

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
        {payoutNeedsComplaint(result) && (
          <Button onClick={onComplain}>{t("doc_complain")}</Button>
        )}
        <p className="text-sm text-neutral-700">{t("po_note")}</p>
      </div>
    </Card>
  );
}
