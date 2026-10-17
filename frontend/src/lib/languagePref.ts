// Remembers which language the worker picked, so the welcome screen is only shown once.

export const LANGUAGE_KEY = "gs.language";

/**
 * Show the language screen on every page load, not just the first visit. A returning worker
 * gets a one-tap "Continue" button for their saved language. Set to false to ask only once.
 */
export const ASK_EVERY_VISIT = true;

type ReadableStorage = Pick<Storage, "getItem">;

/** The saved language code, or null when nothing is saved (or storage is blocked). */
export function readStoredLanguage(storage: ReadableStorage | null): string | null {
  try {
    return storage?.getItem(LANGUAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/**
 * Show the welcome screen only when we can remember the answer. If browser storage is
 * blocked, the screen would come back on every visit, so we skip it and use English.
 */
export function needsLanguageChoice(storage: Pick<Storage, "getItem" | "setItem"> | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem("gs.probe", "1");
    storage.getItem("gs.probe");
  } catch {
    return false;
  }
  return readStoredLanguage(storage) === null;
}

export function shouldAskLanguage(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  everyVisit: boolean = ASK_EVERY_VISIT,
): boolean {
  return everyVisit ? true : needsLanguageChoice(storage);
}

export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
