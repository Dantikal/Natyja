import { useId, useState } from 'react';
import { useLang } from '../context/LanguageContext';
import './PasswordInput.css';

export default function PasswordInput({ label, id, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  const { lang } = useLang();
  const text = lang === 'ky' ? (visible ? 'Сырсөздү жашыруу' : 'Сырсөздү көрсөтүү') : (visible ? 'Скрыть пароль' : 'Показать пароль');
  return <div className="password-field">
    <label htmlFor={inputId}>{label}</label>
    <div className="password-input-row">
      <input {...props} id={inputId} type={visible ? 'text' : 'password'} />
      <button type="button" className="password-visibility" aria-label={text} aria-controls={inputId} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{text}</button>
    </div>
  </div>;
}
