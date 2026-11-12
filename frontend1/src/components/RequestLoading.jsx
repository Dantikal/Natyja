import { T } from "../i18n.jsx";
import React, { useEffect, useState, useSyncExternalStore } from "react";
import { getPendingRequests, subscribeToRequests } from "../api/loading.js";

export default function RequestLoading() {
  const pending = useSyncExternalStore(subscribeToRequests, getPendingRequests);
  const busy = pending > 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(timer);
  }, [busy]);
  if (!busy || !visible) return null;
  return (
    <div className="request-loading" role="status" aria-live="polite">
      <span className="request-loading__spinner" aria-hidden="true" />
      <span><T>{"Загрузка…"}</T></span>
    </div>
  );
}
