import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../context/LanguageContext';
import api from '../api/axios';
import ReportEditorModal from './ReportEditorModal';

jest.mock('../api/axios', () => ({ patch: jest.fn() }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'commander' } }) }));
jest.mock('./WordEditor', () => () => <div>Word editor</div>);
jest.mock('./ExcelEditor', () => () => <div>Excel editor</div>);
jest.mock('./FileUpload', () => () => null);
jest.mock('./TaskAttachment', () => () => null);
const task = { id: 55, title: 'Доклад', due_date: '2026-12-20', report_type: 'text', report_html: '<p>Доклад командира</p>' };
beforeEach(() => { localStorage.setItem('lang', 'ru'); api.patch.mockReset(); });

test('commander saves the current document before submitting it to the administrator', async () => {
  api.patch.mockResolvedValue({ data: {} }); const onSaved = jest.fn();
  render(<LanguageProvider><ReportEditorModal task={task} onSaved={onSaved} onClose={() => {}} /></LanguageProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Таблица данных (Excel)' }));
  expect(await screen.findByText('Excel editor')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Текстовый отчёт (Word)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Отправить администратору' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(api.patch.mock.calls[0][0]).toBe('/tasks/55/report');
  expect(api.patch.mock.calls[0][1].reportHtml).toBe(task.report_html);
  expect(api.patch.mock.calls[1][0]).toBe('/tasks/55/submit');
});

test('a failed submission keeps the commander report open and shows the server error', async () => {
  api.patch.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce({ response: { data: { error: 'Не удалось отправить' } } });
  const onSaved = jest.fn();
  render(<LanguageProvider><ReportEditorModal task={task} onSaved={onSaved} onClose={() => {}} /></LanguageProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Отправить администратору' }));
  await screen.findByText('Не удалось отправить');
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeTruthy();
});
