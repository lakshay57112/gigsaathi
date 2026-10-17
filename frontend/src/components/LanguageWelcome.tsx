import { useEffect, useRef } from "react";
import { useApp } from "../context";
import { browserStorage, readStoredLanguage } from "../lib/languagePref";

// Shown once, on the first visit. Each language is written in its own script, so a worker
// can find theirs without reading English. The heading is fixed text, not translated, because
// nobody has chosen a language yet.
export function LanguageWelcome() {
  const { meta, setLanguage } = useApp();
  const savedCode = readStoredLanguage(browserStorage());
  const saved = meta.languages.find((l) => l.code === savedCode);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2 text-xl font-semibold">
        <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8">
          <rect width="32" height="32" rx="7" fill="#262626" />
          <path d="M9 17l5 5 9-12" stroke="#22c55e" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {meta.app_name}
      </div>
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold focus:outline-none">
        Choose your language
        <span lang="hi" className="mt-1 block text-2xl text-neutral-700">
          अपनी भाषा चुनें
        </span>
      </h1>
      <p className="mt-3 text-neutral-700">
        Answers will come in this language. You can change it any time.
      </p>
      {saved && (
        <button
          type="button"
          lang={saved.code}
          onClick={() => setLanguage(saved.code)}
          className="mt-6 min-h-14 w-full rounded-xl bg-green-700 px-4 py-3 text-lg font-semibold text-white hover:bg-green-800"
        >
          Continue · {saved.native}
        </button>
      )}
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {meta.languages.map((l) => (
          <li key={l.code}>
            <button
              type="button"
              lang={l.code}
              onClick={() => setLanguage(l.code)}
              className={`flex min-h-16 w-full flex-col items-start justify-center rounded-xl border px-4 py-2 text-left hover:border-green-700 hover:bg-green-50 ${
                l.code === savedCode ? "border-green-700 bg-green-50" : "border-neutral-300 bg-white"
              }`}
            >
              <span className="text-lg font-semibold">{l.native}</span>
              {l.native !== l.name && (
                <span lang="en" className="text-sm text-neutral-700">
                  {l.name}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
