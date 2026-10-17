import { getDeviceId } from "./device";
import type {
  ChatResult,
  ChatTurn,
  DocumentExplanation,
  EarningsEntry,
  EarningsInput,
  GrievanceInput,
  GrievanceResult,
  Meta,
  SafetyContent,
  SchemeResult,
  Summary,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** Turn an error response from the backend into an ApiError with a friendly message. */
export function parseErrorBody(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail;

  if (typeof detail === "string") return new ApiError(status, "error", detail);

  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const item of detail as { field?: string; message?: string }[]) {
      if (item.field && item.message) fieldErrors[item.field] = item.message;
    }
    return new ApiError(status, "validation", "Please check the highlighted fields.", fieldErrors);
  }

  if (detail && typeof detail === "object") {
    const { code, message } = detail as { code?: string; message?: string };
    if (message) return new ApiError(status, code ?? "error", message);
  }

  if (status === 413) return new ApiError(status, "too_large", "That is too much text to send at once.");
  return new ApiError(status, "error", "Something went wrong. Please try again.");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId(), ...init.headers },
    });
  } catch {
    throw new ApiError(0, "network", "Could not reach the server. Please check your internet connection.");
  }
  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // not JSON; fall through to a generic message
    }
    throw parseErrorBody(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  getMeta: () => request<Meta>("/meta"),
  getSummary: () => request<Summary>("/summary"),
  listEarnings: () => request<EarningsEntry[]>("/earnings?limit=30"),
  addEarnings: (entry: EarningsInput) => post<EarningsEntry>("/earnings", entry),
  deleteEarnings: (id: number) => request<void>(`/earnings/${id}`, { method: "DELETE" }),
  deleteAllEarnings: () => request<void>("/earnings", { method: "DELETE" }),
  explainSummary: (language: string) => post<{ text: string }>("/summary/explain", { language }),
  chat: (message: string, language: string, history: ChatTurn[]) =>
    post<ChatResult>("/assistant/chat", { message, language, history }),
  getSafety: () => request<SafetyContent>("/safety"),
  explainSafety: (language: string) => post<{ text: string }>("/safety/explain", { language }),
  getSchemes: (occupation: string, state: string) =>
    request<SchemeResult>(
      `/schemes?occupation=${encodeURIComponent(occupation)}&state=${encodeURIComponent(state)}`,
    ),
  explainSchemes: (occupation: string, state: string, language: string) =>
    post<{ text: string }>("/schemes/explain", { occupation, state, language }),
  explainDocument: (text: string, language: string) =>
    post<DocumentExplanation>("/documents/explain", { text, language }),
  draftGrievance: (input: GrievanceInput) => post<GrievanceResult>("/grievance/draft", input),
};
