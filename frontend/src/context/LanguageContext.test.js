import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider, useLang } from './LanguageContext';

test('language changes translate task controls and keep translation callbacks stable on ordinary renders', () => {
  const callbacks = [];
  function Probe() {
    const { t, tr, toggleLang } = useLang(); callbacks.push(t);
    return <button onClick={toggleLang}>{tr('Сохранить отчёт')}</button>;
  }
  localStorage.setItem('lang', 'ru');
  const { rerender } = render(<LanguageProvider><Probe /></LanguageProvider>);
  rerender(<LanguageProvider><Probe /></LanguageProvider>);
  expect(callbacks[0]).toBe(callbacks[1]);
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить отчёт' }));
  expect(screen.getByRole('button', { name: 'Отчётту сактоо' })).toBeTruthy();
  expect(document.documentElement.lang).toBe('ky');
});
