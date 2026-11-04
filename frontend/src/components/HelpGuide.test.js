import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '../context/LanguageContext';
import HelpGuide from './HelpGuide';
import HelpButton from './HelpButton';
let mockUser = null;
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
beforeEach(() => { mockUser = null; localStorage.setItem('lang', 'ru'); });
test('search finds matching instructions and handles an empty result', () => {
  render(<LanguageProvider><HelpGuide /></LanguageProvider>);
  fireEvent.change(screen.getByLabelText('Поиск по руководству'), { target: { value: 'черновик' } });
  expect(screen.getByText('Как написать и отправить отчёт')).toBeTruthy();
  expect(screen.queryByText('Первый вход и регистрация')).toBeNull();
  fireEvent.change(screen.getByLabelText('Поиск по руководству'), { target: { value: 'отчет' } });
  expect(screen.getByText('Как написать и отправить отчёт')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Поиск по руководству'), { target: { value: 'zzzzzz' } });
  expect(screen.getByText(/Ничего не найдено/)).toBeTruthy();
});
test('instructions are localized and privileged topics follow the current role', () => {
  const view = render(<LanguageProvider><HelpGuide /></LanguageProvider>);
  expect(screen.queryByText('Командиру: назначение и проверка задач')).toBeNull();
  mockUser = { role: 'commander' };
  view.rerender(<LanguageProvider><HelpGuide /></LanguageProvider>);
  expect(screen.getByText('Командиру: назначение и проверка задач')).toBeTruthy();
  expect(screen.queryByText('Администратору: доступ пользователей')).toBeNull();
  mockUser = { role: 'admin' };
  view.rerender(<LanguageProvider><HelpGuide /></LanguageProvider>);
  expect(screen.getByText('Администратору: доступ пользователей')).toBeTruthy();
});
test('Kyrgyz guide is available before signing in', () => {
  localStorage.setItem('lang', 'ky');
  render(<LanguageProvider><HelpGuide /></LanguageProvider>);
  expect(screen.getByLabelText('Керектүү теманы издөө')).toBeTruthy();
  expect(screen.getByText('Сайтка кантип кирем?')).toBeTruthy();
});
test('opening and closing help preserves a draft and returns keyboard focus', async () => {
  function Draft() {
    const [value, setValue] = useState('');
    return <LanguageProvider><label>Черновик<input value={value} onChange={e => setValue(e.target.value)} /></label><HelpButton /></LanguageProvider>;
  }
  render(<Draft />);
  fireEvent.change(screen.getByLabelText('Черновик'), { target: { value: 'Не потерять отчёт' } });
  const trigger = screen.getByRole('button', { name: 'Помощь' }); trigger.focus(); fireEvent.click(trigger);
  await screen.findByLabelText('Поиск по руководству');
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByLabelText('Черновик').value).toBe('Не потерять отчёт');
  expect(document.activeElement).toBe(trigger);
});
