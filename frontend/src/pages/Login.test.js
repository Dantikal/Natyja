import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Login from './Login';
import { LanguageProvider } from '../context/LanguageContext';
const mockLogin = jest.fn();
const mockNavigate = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ login: mockLogin }) }));
jest.mock('../components/Brand', () => () => null);
jest.mock('react-router-dom', () => ({ Link: ({ to, children }) => <a href={to}>{children}</a>, useNavigate: () => mockNavigate }));

test('login submits credentials without a bot challenge and handles authentication errors', async () => {
  localStorage.setItem('lang', 'ru');
  mockLogin.mockRejectedValueOnce({ response: { data: { error: 'Неверный email или пароль' } } });
  mockLogin.mockResolvedValueOnce({ mustChangePassword: false });
  render(<LanguageProvider><Login /></LanguageProvider>);
  expect(screen.queryByRole('group', { name: 'Защита от ботов' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Электронная почта'), { target: { value: 'login@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'Example123!' } });
  const button = screen.getByRole('button', { name: 'Войти' });
  expect(button).toBeEnabled();
  fireEvent.submit(button.closest('form'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Неверный email или пароль');
  expect(mockLogin).toHaveBeenCalledWith('login@example.invalid', 'Example123!');
  fireEvent.submit(button.closest('form'));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/profile'));
});
