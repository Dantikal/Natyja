import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AssistantContext from './AssistantContext';
import api from '../api/axios';
jest.mock('../api/axios', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('../context/LanguageContext', () => ({ useLang: () => ({ lang: 'ru' }) }));
jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
test('explicitly selected documents, own task and separate search terms are sent to the parent', async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/documents') ? [{ id: 'doc-1', name: 'Личный документ.txt' }] : { tasks: [{ id: 42, title: 'Отчёт за месяц', status: 'в_работе', due_date: '2026-10-31T23:59:59.999+06:00' }], serverNow: '2026-10-30T12:00:00Z' } }));
  const change = jest.fn(); render(<AssistantContext onChange={change} disabled={false} />);
  await screen.findByText('Личный документ.txt');
  fireEvent.click(screen.getByLabelText('Личный документ.txt'));
  fireEvent.change(screen.getByLabelText('Моя задача'), { target: { value: '42' } });
  fireEvent.click(screen.getByLabelText('Искать в интернете'));
  fireEvent.change(screen.getByLabelText('Поисковые слова'), { target: { value: 'Бишкек' } });
  await waitFor(() => expect(change).toHaveBeenLastCalledWith({ documentIds: ['doc-1'], attachments: [{ id: 'doc-1', name: 'Личный документ.txt' }], taskId: 42, webQuery: 'Бишкек', webEnabled: true, uploading: false }));
  expect(screen.getByText('Осталось: 1 дн. 6 ч.')).toBeInTheDocument();
});
