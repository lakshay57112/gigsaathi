import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./lib/api";
import { translate, type TextKey } from "./lib/i18n";
import { browserStorage, LANGUAGE_KEY, needsLanguageChoice, readStoredLanguage } from "./lib/languagePref";
import type { Meta } from "./lib/types";

interface AppState {
  meta: Meta;
  language: string;
  /** True until the worker has picked a language on the welcome screen. */
  needsLanguage: boolean;
  setLanguage: (code: string) => void;
  speechLocale: string;
  t: (key: TextKey) => string;
}

const AppContext = createContext<AppState | null>(null);

function readLanguage(): string {
  return readStoredLanguage(browserStorage()) ?? "en";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguageState] = useState(readLanguage);
  const [needsLanguage, setNeedsLanguage] = useState(() => needsLanguageChoice(browserStorage()));

  useEffect(() => {
    api.getMeta().then(setMeta, (e: Error) => setError(e.message));
  }, []);

  const setLanguage = useCallback((code: string) => {
    setLanguageState(code);
    setNeedsLanguage(false);
    try {
      window.localStorage.setItem(LANGUAGE_KEY, code);
    } catch {
      // the choice still applies for this visit
    }
  }, []);

  const activeLanguage = meta?.languages.some((l) => l.code === language) ? language : "en";

  useEffect(() => {
    document.documentElement.lang = activeLanguage;
    if (meta) document.title = meta.app_name;
  }, [activeLanguage, meta]);

  const value = useMemo<AppState | null>(
    () =>
      meta && {
        meta,
        language: activeLanguage,
        needsLanguage,
        setLanguage,
        speechLocale: meta.languages.find((l) => l.code === activeLanguage)?.speech_locale ?? "en-IN",
        t: (key) => translate(activeLanguage, key),
      },
    [meta, activeLanguage, needsLanguage, setLanguage],
  );

  if (error) {
    return (
      <div role="alert" className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Cannot load the app</h1>
        <p className="mt-2 text-neutral-700">{error}</p>
        <button className="mt-4 rounded-lg bg-green-700 px-4 py-2 font-medium text-white" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
  if (!value) return <p role="status" className="p-8 text-center text-neutral-600">Loading…</p>;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
