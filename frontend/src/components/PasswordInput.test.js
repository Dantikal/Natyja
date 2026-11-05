import { render, screen, fireEvent } from '@testing-library/react';
import PasswordInput from './PasswordInput';
jest.mock('../context/LanguageContext', () => ({ useLang: () => ({ lang: 'ru' }) }));
test('shows and hides the entered password without changing it or submitting the form', () => {
  const submit = jest.fn(event => event.preventDefault());
  render(<form onSubmit={submit}><PasswordInput label="Пароль" defaultValue="Fixture123!" /></form>);
  const input = screen.getByLabelText('Пароль');
  expect(input.type).toBe('password');
  fireEvent.click(screen.getByRole('button', { name: 'Показать пароль' }));
  expect(input.type).toBe('text'); expect(input.value).toBe('Fixture123!');
  fireEvent.click(screen.getByRole('button', { name: 'Скрыть пароль' }));
  expect(input.type).toBe('password'); expect(submit).not.toHaveBeenCalled();
});
