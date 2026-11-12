import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { api } from "../api/client.js";
import { annualRegistryKey, readAnnualDrafts, reportingYear } from "../annualWorkspace.js";
import { useLanguage } from "../i18n.jsx";

export default function AnnualArchiveSync() {
  const userId = useSelector((state) => state.auth.user?.id);
  const { language } = useLanguage();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    let running = false;
    const sync = async () => {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        const drafts = readAnnualDrafts(userId);
        for (const [key, draft] of Object.entries(drafts)) {
          if (draft.archived || draft.year >= reportingYear()) continue;
          await api.post("/dashboard/submission-archive/", { ...draft, kind: "annual-draft" }, { signal: controller.signal });
          if (controller.signal.aborted) return;
          // Re-read so changes made in another tab are never overwritten.
          const latest = readAnnualDrafts(userId);
          if (latest[key]) latest[key].archived = true;
          localStorage.setItem(annualRegistryKey(userId), JSON.stringify(latest));
          window.dispatchEvent(new Event("submission-archived"));
        }
        setError(false);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { running = false; }
    };
    sync();
    const timer = setInterval(sync, 30000);
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("online", sync); window.removeEventListener("focus", sync); };
  }, [userId]);
  return error ? <p className="annual-archive-notice" role="status">{language === "ru" ? "Годовой архив пока не синхронизирован. Локальные копии сохранены; повторная попытка произойдёт автоматически." : "Жылдык архив азырынча шайкештештирилген жок. Жергиликтүү көчүрмөлөр сакталган; аракет автоматтык түрдө кайталанат."}</p> : null;
}
