// Grievance drafts are kept only in this browser. They are never sent to the server for storage.

const KEY = "gs.grievanceDrafts";
export const MAX_DRAFTS = 10;

export interface SavedDraft {
  id: string;
  savedAt: string;
  platform: string;
  subject: string;
  body: string;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadDrafts(storage: StorageLike | null = defaultStorage()): SavedDraft[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as SavedDraft[]) : [];
  } catch {
    return [];
  }
}

function write(drafts: SavedDraft[], storage: StorageLike | null): void {
  try {
    storage?.setItem(KEY, JSON.stringify(drafts));
  } catch {
    // storage full or blocked
  }
}

export function saveDraft(
  draft: Omit<SavedDraft, "id" | "savedAt">,
  storage: StorageLike | null = defaultStorage(),
  now: Date = new Date(),
): SavedDraft[] {
  const entry: SavedDraft = { ...draft, id: `${now.getTime()}`, savedAt: now.toISOString() };
  const drafts = [entry, ...loadDrafts(storage)].slice(0, MAX_DRAFTS);
  write(drafts, storage);
  return drafts;
}

export function deleteDraft(id: string, storage: StorageLike | null = defaultStorage()): SavedDraft[] {
  const drafts = loadDrafts(storage).filter((d) => d.id !== id);
  write(drafts, storage);
  return drafts;
}
