import { useCallback, useEffect, useRef, useState } from "react";

const cloneSnapshot = (value) => JSON.parse(JSON.stringify(value));

export default function useDocumentHistory({
  value,
  onChange,
  resetKey,
  debounceMs = 350,
  limit = 100,
}) {
  const serializedValue = JSON.stringify(value);
  const latestValueRef = useRef(serializedValue);
  const currentRef = useRef(serializedValue);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  const initializationTimerRef = useRef(null);
  const resetKeyRef = useRef(resetKey);
  const initializingRef = useRef(true);
  const onChangeRef = useRef(onChange);
  const [availability, setAvailability] = useState({ canUndo: false, canRedo: false });

  onChangeRef.current = onChange;
  latestValueRef.current = serializedValue;

  const updateAvailability = useCallback(() => {
    setAvailability({
      canUndo: pastRef.current.length > 0 || (
        pendingRef.current !== null && pendingRef.current !== currentRef.current
      ),
      canRedo: futureRef.current.length > 0,
    });
  }, []);

  const finishInitialization = useCallback(() => {
    currentRef.current = latestValueRef.current;
    pendingRef.current = null;
    pastRef.current = [];
    futureRef.current = [];
    initializingRef.current = false;
    updateAvailability();
  }, [updateAvailability]);

  const commitPending = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending === null || pending === currentRef.current) {
      updateAvailability();
      return;
    }

    pastRef.current = [...pastRef.current, currentRef.current].slice(-limit);
    currentRef.current = pending;
    futureRef.current = [];
    updateAvailability();
  }, [limit, updateAvailability]);

  useEffect(() => {
    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      initializingRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (initializationTimerRef.current) window.clearTimeout(initializationTimerRef.current);
      pendingRef.current = null;
      pastRef.current = [];
      futureRef.current = [];
      initializationTimerRef.current = window.setTimeout(finishInitialization, 80);
      updateAvailability();
      return;
    }

    if (initializingRef.current) {
      if (initializationTimerRef.current) window.clearTimeout(initializationTimerRef.current);
      initializationTimerRef.current = window.setTimeout(finishInitialization, 80);
      return;
    }

    if (serializedValue === currentRef.current) {
      pendingRef.current = null;
      updateAvailability();
      return;
    }

    pendingRef.current = serializedValue;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(commitPending, debounceMs);
    updateAvailability();
  }, [commitPending, debounceMs, finishInitialization, resetKey, serializedValue, updateAvailability]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (initializationTimerRef.current) window.clearTimeout(initializationTimerRef.current);
  }, []);

  const undo = useCallback(() => {
    if (initializingRef.current) return;
    commitPending();
    if (pastRef.current.length === 0) return;

    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [currentRef.current, ...futureRef.current].slice(0, limit);
    currentRef.current = previous;
    pendingRef.current = null;
    onChangeRef.current(cloneSnapshot(JSON.parse(previous)));
    updateAvailability();
  }, [commitPending, limit, updateAvailability]);

  const redo = useCallback(() => {
    if (initializingRef.current || futureRef.current.length === 0) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);

    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, currentRef.current].slice(-limit);
    currentRef.current = next;
    pendingRef.current = null;
    onChangeRef.current(cloneSnapshot(JSON.parse(next)));
    updateAvailability();
  }, [limit, updateAvailability]);

  return { ...availability, undo, redo };
}
