// An anonymous id, created once per browser. There are no accounts; the server uses this id
// to keep one worker's earnings separate from another's.

const KEY = "gs.deviceId";

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // private mode or blocked storage
  }
}

let memoryId: string | null = null;

export function getDeviceId(): string {
  const storage = safeStorage();
  const existing = storage?.getItem(KEY) ?? memoryId;
  if (existing && /^[A-Za-z0-9-]{16,64}$/.test(existing)) return existing;
  const created = crypto.randomUUID();
  memoryId = created;
  try {
    storage?.setItem(KEY, created);
  } catch {
    // keep the in-memory id for this session
  }
  return created;
}
