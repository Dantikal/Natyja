import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLang } from '../context/LanguageContext';
import './HelpGuide.css';
const HelpGuide = lazy(() => import('./HelpGuide'));

function HelpDialog({ onClose }) {
  const { lang } = useLang();
  const panel = useRef(null);
  const ky = lang === 'ky';
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current.querySelector('button').focus();
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  function keyboard(event) {
    if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const controls = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], summary')];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <div className="help-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" ref={panel} onKeyDown={keyboard}>
      <header className="help-heading"><div><h2 id="help-title">{ky ? 'Жардам' : 'Помощь'}</h2><p>{ky ? 'Сайтты кантип колдонсо болот' : 'Руководство для нового пользователя'}</p></div>
        <button type="button" className="btn-secondary" onClick={onClose}>{ky ? 'Жабуу' : 'Закрыть'}</button></header>
      <div className="help-scroll"><Suspense fallback={<p role="status">{ky ? 'Жүктөлүүдө…' : 'Загрузка…'}</p>}><HelpGuide /></Suspense></div>
    </section>
  </div>;
}

export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const { lang } = useLang();
  const label = lang === 'ky' ? 'Жардам' : 'Помощь';
  return <><button type="button" className="help-launcher" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
    <span aria-hidden="true">?</span>{label}</button>{open && <HelpDialog onClose={() => setOpen(false)} />}</>;
}
