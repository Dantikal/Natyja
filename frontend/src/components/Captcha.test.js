import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Captcha from './Captcha';
import api from '../api/axios';
import { LanguageProvider } from '../context/LanguageContext';
jest.mock('../api/axios', () => ({ get: jest.fn() }));
const image = 'data:image/svg+xml;base64,PHN2Zy8+';
function Form({ resetKey = 0 }) {
  const [value, onChange] = useState({ id: '', answer: '' });
  return <LanguageProvider><Captcha purpose="login" value={value} onChange={onChange} resetKey={resetKey} /><output>{JSON.stringify(value)}</output></LanguageProvider>;
}
beforeEach(() => { localStorage.setItem('lang', 'ru'); api.get.mockReset(); });
test('refresh and failed-submit reset discard the previous answer and challenge', async () => {
  api.get.mockResolvedValueOnce({ data: { id: 'first', image, expiresIn: 300 } })
    .mockResolvedValueOnce({ data: { id: 'second', image, expiresIn: 300 } })
    .mockResolvedValueOnce({ data: { id: 'third', image, expiresIn: 300 } });
  const view = render(<Form />);
  await screen.findByAltText('Код проверки');
  fireEvent.change(screen.getByLabelText('Введите 6 символов с картинки'), { target: { value: 'ab2cd3' } });
  expect(screen.getByRole('status').textContent).toContain('AB2CD3');
  fireEvent.click(screen.getByRole('button', { name: 'Обновить код' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('second'));
  expect(screen.getByLabelText('Введите 6 символов с картинки').value).toBe('');
  view.rerender(<Form resetKey={1} />);
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('third'));
});
test('failed challenge loading keeps input disabled and offers retry', async () => {
  api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { id: 'retry', image, expiresIn: 300 } });
  render(<Form />);
  await screen.findByText('Не удалось загрузить проверку');
  expect(screen.getByLabelText('Введите 6 символов с картинки').disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Обновить код' }));
  await screen.findByAltText('Код проверки');
  expect(screen.getByLabelText('Введите 6 символов с картинки').disabled).toBe(false);
});
