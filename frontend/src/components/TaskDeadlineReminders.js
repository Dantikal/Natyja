import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import api from '../api/axios';
import { remaining, reminderKey } from '../utils/taskDeadlines';
import './TaskDeadlineReminders.css';
export default function TaskDeadlineReminders() {
  const { user } = useAuth();
  const userId = user?.id, mustChangePassword = user?.mustChangePassword;
  const { lang } = useLang();
  const [toast, setToast] = useState(null);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 20000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    setToast(null);
    if (!userId || mustChangePassword) return;
    const controller = new AbortController();
    let running = false;
    const storageKey = 'natyyzha:deadline-reminders:' + userId;
    let seen;
    try { const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); seen = new Set(Array.isArray(saved) ? saved : []); } catch { seen = new Set(); }
    async function poll() {
      if (running || document.hidden || controller.signal.aborted) return;
      running = true;
      try {
        const { data } = await api.get('/assistant-support/tasks', { signal: controller.signal });
        if (controller.signal.aborted) return;
        const now = new Date(data.serverNow).getTime();
        const fresh = data.tasks.filter(task => { const key = reminderKey(task, now); return key && !seen.has(key); });
        if (fresh.length) {
          fresh.forEach(task => seen.add(reminderKey(task, now)));
          try { localStorage.setItem(storageKey, JSON.stringify([...seen].slice(-1000))); } catch {}
          setToast({ task: fresh[0], count: fresh.length, now, userId });
        }
      } catch {} finally { running = false; }
    }
    poll(); const timer = setInterval(poll, 60000);
    const visible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', visible);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [userId, mustChangePassword]);
  if (!toast || toast.userId !== userId) return null;
  return <div className="task-deadline-toast" role="status"><div><strong>{lang === 'ky' ? 'Задачанын мөөнөтү' : 'Срок задачи'}</strong><p>{toast.task.title}</p><p>{remaining(toast.task.due_date, toast.now, lang === 'ky')}{toast.count > 1 ? ` · +${toast.count - 1}` : ''}</p><Link to="/my-tasks" onClick={() => setToast(null)}>{lang === 'ky' ? 'Задачаларды ачуу' : 'Открыть мои задачи'}</Link></div><button type="button" onClick={() => setToast(null)} aria-label={lang === 'ky' ? 'Жабуу' : 'Закрыть'}>×</button></div>;
}
