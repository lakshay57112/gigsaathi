import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useApp } from "../context";
import type { ApiError } from "../lib/api";
import { cleanAiText } from "../lib/text";

// ---- Buttons and links ----------------------------------------------------------------

type Variant = "primary" | "secondary" | "danger";

const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-base font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-green-700 text-white hover:bg-green-800",
  secondary: "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100",
  danger: "border border-red-300 bg-white text-red-800 hover:bg-red-50",
};

export function buttonClass(variant: Variant = "primary", extra = ""): string {
  return `${BUTTON_BASE} ${VARIANTS[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

// ---- Layout ----------------------------------------------------------------------------

export function PageTitle({ children, intro }: { children: ReactNode; intro?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{children}</h1>
      {intro && <p className="mt-2 max-w-2xl text-neutral-700">{intro}</p>}
    </header>
  );
}

export function Card({
  title,
  children,
  className = "",
  headingLevel = 2,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={`rounded-xl border border-neutral-200 bg-white p-5 ${className}`}>
      {title && <Heading className="mb-3 text-lg font-semibold">{title}</Heading>}
      {children}
    </section>
  );
}

// ---- Feedback --------------------------------------------------------------------------

type Tone = "error" | "success" | "info" | "warning";

const TONES: Record<Tone, string> = {
  error: "border-red-300 bg-red-50 text-red-900",
  success: "border-green-300 bg-green-50 text-green-900",
  info: "border-neutral-300 bg-neutral-50 text-neutral-800",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
};

export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${TONES[tone]}`}>
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useApp();
  return (
    <p role="status" className="flex items-center gap-3 py-6 text-neutral-700">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-neutral-300 border-t-green-700"
      />
      {label ?? t("loading")}
    </p>
  );
}

export function ErrorBox({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const { t } = useApp();
  return (
    <div className="space-y-3">
      <Alert tone="error">{error.message}</Alert>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

export function AiNote() {
  const { t } = useApp();
  return <p className="text-sm text-neutral-600">{t("aiNote")}</p>;
}

/** Text written by the AI, shown as plain text in the language it was written in. */
export function AiText({ text, language }: { text: string; language: string }) {
  return (
    <div lang={language} className="whitespace-pre-wrap leading-relaxed">
      {cleanAiText(text)}
    </div>
  );
}

// ---- Form fields -----------------------------------------------------------------------

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
}

const CONTROL =
  "block w-full min-h-11 rounded-lg border bg-white px-3 py-2 text-base text-neutral-900 " +
  "placeholder:text-neutral-500";

function controlClass(error?: string): string {
  return `${CONTROL} ${error ? "border-red-600" : "border-neutral-400"}`;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-neutral-900">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mb-1 text-sm text-neutral-600">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ");
  return ids || undefined;
}

export function TextField({
  label,
  hint,
  error,
  className = "",
  ...input
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${controlClass(error)} ${className}`}
        {...input}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...select
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={controlClass(error)}
        {...select}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  ...area
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={controlClass(error)}
        {...area}
      />
    </FieldShell>
  );
}

/** Move keyboard focus to the first field that failed validation. */
export function focusFirstInvalid(form: HTMLFormElement | null): void {
  form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}
