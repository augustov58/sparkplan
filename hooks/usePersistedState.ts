import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Drop-in replacement for useState that persists to sessionStorage.
 * Use a unique key (include projectId for project-specific state).
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // Non-parseable or unavailable — fall back to default
    }
    return defaultValue;
  });

  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    try {
      sessionStorage.setItem(keyRef.current, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }, [state]);

  return [state, setState];
}
