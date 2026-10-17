import { useState } from "react";
import { Alert, Button, Card, PageTitle, SelectField } from "../components/ui";
import { useApp } from "../context";
import { api, ApiError } from "../lib/api";

export default function Settings() {
  const { t, meta, language, setLanguage } = useApp();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function clearData() {
    if (!window.confirm(t("set_clearConfirm"))) return;
    try {
      await api.deleteAllEarnings();
      setMessage({ tone: "success", text: t("set_cleared") });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof ApiError ? e.message : "Something went wrong." });
    }
  }

  return (
    <>
      <PageTitle>{t("set_title")}</PageTitle>
      <div className="space-y-6">
        <Card title={t("set_language")}>
          <SelectField label={t("language")} hint={t("set_languageHelp")} value={language} onChange={(e) => setLanguage(e.target.value)}>
            {meta.languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
                {l.native !== l.name ? ` (${l.name})` : ""}
              </option>
            ))}
          </SelectField>
        </Card>

        <Card title={t("set_ai")}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-neutral-700">Provider</dt>
            <dd className="font-medium">{meta.ai.provider}</dd>
            <dt className="text-neutral-700">Model</dt>
            <dd className="font-medium">{meta.ai.model}</dd>
            <dt className="text-neutral-700">Status</dt>
            <dd className="font-medium">{meta.ai.configured ? "Connected" : "Not configured on this server"}</dd>
          </dl>
          <p className="mt-3 text-sm text-neutral-700">
            The assistant, document explanations, complaint drafts and "explain in my language" buttons use {meta.ai.provider}. Earnings tracking, the scheme lookup and the safety guidance work without it.
          </p>
        </Card>

        <Card title={t("set_privacy")}>
          <ul className="list-disc space-y-2 pl-5 text-neutral-800">
            <li>There is no account or password. Your saved earnings are linked to a random ID stored in this browser. If you clear your browser data, you lose access to them.</li>
            <li>Earnings entries are saved on the server so the dashboard and assistant can use them. You can delete them at any time below.</li>
            <li>Your questions, pasted documents and complaint details are sent to {meta.ai.provider} to get an answer. This app does not save pasted documents. Check Google's own terms for how it handles data.</li>
            <li>Saved complaint drafts stay on this device only.</li>
            <li>Do not paste Aadhaar, bank, card, password or OTP details anywhere in this app.</li>
          </ul>
        </Card>

        <Card title={t("set_data")}>
          <Button variant="danger" onClick={() => void clearData()}>
            {t("set_clear")}
          </Button>
          <div className="mt-3" aria-live="polite">
            {message && <Alert tone={message.tone}>{message.text}</Alert>}
          </div>
        </Card>
      </div>
    </>
  );
}
