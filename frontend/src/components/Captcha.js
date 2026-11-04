import { useEffect, useId, useState } from 'react';
import api from '../api/axios';
import { useLang } from '../context/LanguageContext';
import './Captcha.css';

export default function Captcha({ purpose, value, onChange, resetKey = 0, disabled = false }) {
  const { tr } = useLang();
  const inputId = useId();
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState(false);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    let active = true;
    let timer;
    const controller = new AbortController();
    setChallenge(null); setError(false); onChange({ id: '', answer: '' });
    api.get('/auth/captcha', { params: { purpose }, signal: controller.signal }).then(({ data }) => {
      if (!active) return;
      setChallenge(data); onChange({ id: data.id, answer: '' });
      timer = setTimeout(() => setCycle(n => n + 1), data.expiresIn * 1000);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [purpose, cycle, resetKey, onChange]);
  return <fieldset className="captcha-field" disabled={disabled}>
    <legend>{tr('Защита от ботов')}</legend>
    <div className="captcha-picture-row">
      {challenge ? <img src={challenge.image} width="220" height="72" alt={tr('Код проверки')} /> :
        <span role="status">{tr(error ? 'Не удалось загрузить проверку' : 'Загрузка проверки…')}</span>}
      <button type="button" className="btn-secondary" onClick={() => setCycle(n => n + 1)} aria-label={tr('Обновить код')}>↻</button>
    </div>
    <label htmlFor={inputId}>{tr('Введите 6 символов с картинки')}
      <input id={inputId} name="captcha" value={value.answer} maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false}
        disabled={!challenge || disabled} required
        onChange={e => onChange({ id: challenge.id, answer: e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase() })} />
    </label>
    <small>{tr('Регистр букв не важен. Код действует 5 минут.')}</small>
  </fieldset>;
}
