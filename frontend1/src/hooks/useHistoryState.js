import { useCallback, useEffect, useRef, useState } from "react";

// Store navigation in browser history, leaving form fields in ordinary React state.
export function useHistoryState(key, initialValue) {
  const fallback = useRef();
  const initialized = useRef(false);
  if (initialized.current !== key) {
    fallback.current = typeof initialValue === "function" ? initialValue() : initialValue;
    initialized.current = key;
  }
  const read = () => {
    const navigation = window.history.state?.munaraNavigation || {};
    return Object.hasOwn(navigation, key) ? navigation[key] : fallback.current;
  };
  const [value, setValue] = useState(read);
  const current = useRef(value);

  useEffect(() => {
    const restore = () => {
      current.current = read();
      setValue(current.current);
    };
    const state = window.history.state || {};
    if (!Object.hasOwn(state.munaraNavigation || {}, key)) {
      window.history.replaceState({ ...state, munaraNavigation: { ...state.munaraNavigation, [key]: fallback.current } }, "");
    }
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [key]);

  const navigate = useCallback((nextValue) => {
    const next = typeof nextValue === "function" ? nextValue(current.current) : nextValue;
    if (Object.is(next, current.current)) return;
    const state = window.history.state || {};
    window.history.pushState({ ...state, munaraNavigation: { ...state.munaraNavigation, [key]: next } }, "");
    current.current = next;
    setValue(next);
  }, [key]);

  return [value, navigate];
}
