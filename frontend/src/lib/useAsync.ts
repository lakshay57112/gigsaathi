import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

/** Run an async loader on mount and whenever `reload` is called. Ignores out-of-date results. */
export function useAsync<T>(load: () => Promise<T>): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let current = true;
    setLoading(true);
    loadRef.current().then(
      (result) => {
        if (!current) return;
        setData(result);
        setError(null);
        setLoading(false);
      },
      (e: unknown) => {
        if (!current) return;
        setError(e instanceof ApiError ? e : new ApiError(0, "error", "Something went wrong."));
        setLoading(false);
      },
    );
    return () => {
      current = false;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}
