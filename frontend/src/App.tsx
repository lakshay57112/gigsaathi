import { useEffect, useRef, useState } from "react";
import { LanguageWelcome } from "./components/LanguageWelcome";
import { useApp } from "./context";
import { ROUTES, useRoute } from "./lib/route";
import Assistant from "./pages/Assistant";
import Dashboard from "./pages/Dashboard";
import DocumentHelp from "./pages/DocumentHelp";
import Earnings from "./pages/Earnings";
import Grievance from "./pages/Grievance";
import SafetyWelfare from "./pages/SafetyWelfare";
import Statement from "./pages/Statement";
import Settings from "./pages/Settings";

const PAGES: Record<string, () => React.JSX.Element> = {
  "/": Dashboard,
  "/earnings": Earnings,
  "/statement": Statement,
  "/assistant": Assistant,
  "/safety": SafetyWelfare,
  "/documents": DocumentHelp,
  "/grievance": Grievance,
  "/settings": Settings,
};

function Nav({ route, onNavigate }: { route: string; onNavigate?: () => void }) {
  const { t } = useApp();
  return (
    <nav aria-label="Main">
      <ul className="space-y-1">
        {ROUTES.map((r) => {
          const active = r.path === route;
          return (
            <li key={r.path}>
              <a
                href={`#${r.path}`}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-lg border-l-4 px-3 py-2 text-base ${
                  active
                    ? "border-green-500 bg-neutral-800 font-semibold text-white"
                    : "border-transparent text-neutral-300 hover:bg-neutral-900 hover:text-white"
                }`}
              >
                {t(r.label)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function LanguagePicker() {
  const { meta, language, setLanguage, t } = useApp();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language" className="text-sm font-medium text-neutral-700">
        {t("language")}
      </label>
      <select
        id="language"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="min-h-11 rounded-lg border border-neutral-400 bg-white px-2 text-base"
      >
        {meta.languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
            {l.native !== l.name ? ` (${l.name})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function Brand() {
  const { meta } = useApp();
  return (
    <a href="#/" className="flex items-center gap-2 text-xl font-semibold text-white">
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-7">
        <rect width="32" height="32" rx="7" fill="#262626" />
        <path d="M9 17l5 5 9-12" stroke="#22c55e" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {meta.app_name}
    </a>
  );
}

export default function App() {
  const { t, meta, needsLanguage } = useApp();
  const route = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  const Page = PAGES[route] ?? Dashboard;
  const current = ROUTES.find((r) => r.path === route);

  // On every page change: update the tab title and move focus to the content, so keyboard and
  // screen-reader users start at the top of the new page.
  useEffect(() => {
    const label = current ? t(current.label) : "";
    document.title = label ? `${label} · ${meta.app_name}` : meta.app_name;
    if (firstRender.current) {
      firstRender.current = false;
    } else {
      mainRef.current?.focus();
    }
    setMenuOpen(false);
  }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

  if (needsLanguage) return <LanguageWelcome />;

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
        className="sr-only z-50 print:hidden rounded-lg bg-white px-4 py-2 font-medium text-neutral-900 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t("skip")}
      </a>

      <aside className="on-dark sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 bg-neutral-950 p-5 md:flex print:hidden">
        <Brand />
        <Nav route={route} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="on-dark bg-neutral-950 md:hidden print:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Brand />
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
              className="min-h-11 rounded-lg border border-neutral-600 px-4 text-base font-medium text-white"
            >
              {menuOpen ? t("closeMenu") : t("menu")}
            </button>
          </div>
          <div id="mobile-nav" hidden={!menuOpen} className="px-3 pb-4">
            <Nav route={route} onNavigate={() => setMenuOpen(false)} />
          </div>
        </header>

        <div className="flex justify-end border-b border-neutral-200 px-4 py-2 md:px-8 print:hidden">
          <LanguagePicker />
        </div>

        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-3xl px-4 py-6 focus:outline-none md:px-8 md:py-10 print:max-w-none print:p-0"
        >
          <Page key={route} />
        </main>
      </div>
    </div>
  );
}
