// An anonymous id, created once per browser. There are no accounts; the server uses this id
// to keep one worker's earnings separate from another's.

const KEY = "gs.deviceId";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  if (existing && UUID_V4.test(existing)) return existing;
  const created = crypto.randomUUID();
  memoryId = created;
  try {
    storage?.setItem(KEY, created);
  } catch {
    // keep the in-memory id for this session
  }
  return created;
}
