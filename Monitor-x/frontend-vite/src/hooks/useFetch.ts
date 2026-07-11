import { useState, useEffect, useCallback, useRef } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Wraps the `useEffect → API call → useState` pattern used across pages,
// adding error capture and a manual refetch.
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // Monotonic request id: only the most recent load may write to state, so a
  // slow response (from an earlier deps value or a superseded refetch) can never
  // clobber a newer one, and an unmount discards any in-flight result.
  const reqId = useRef(0);

  const load = useCallback(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((result) => {
        if (id === reqId.current) setData(result);
      })
      .catch((err: Error) => {
        if (id === reqId.current) setError(err.message);
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
    return () => {
      // Invalidate the in-flight request so its result is ignored after unmount / deps change.
      reqId.current++;
    };
  }, [load]);

  return { data, loading, error, refetch: load };
}
