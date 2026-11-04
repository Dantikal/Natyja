import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Assistant from './Assistant';
import api from '../api/axios';
import { saveChats, loadChats } from '../utils/assistantHistory';
jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock('../api/axios', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 2, role: 'soldier' } }) }));
jest.mock('../context/LanguageContext', () => ({ useLang: () => ({ lang: 'ky' }) }));
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); global.crypto = { randomUUID: () => 'chat-test' }; api.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/documents') ? [] : url.endsWith('/tasks') ? { tasks: [], serverNow: new Date().toISOString() } : { ready: true } })); });
test('plus opens file choices and a photo becomes a removable attachment used in the next message', async () => {
  api.post.mockImplementation(url => Promise.resolve({ data: url.endsWith('/documents') ? { id: 'photo-1', name: 'report.png' } : { answer: 'Ответ по фото' } }));
  render(<Assistant />);
  await screen.findByText('● Жергиликтүү модель даяр');
  const plus = screen.getByRole('button', { name: 'Файл кошуу' });
  fireEvent.click(plus);
  expect(screen.getByRole('button', { name: /Сүрөт жүктөө/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Документ жүктөө/ })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' }); expect(plus).toHaveFocus();
  fireEvent.change(screen.getByLabelText('Сүрөт тандоо'), { target: { files: [new File(['photo'], 'report.png', { type: 'image/png' })] } });
  await screen.findByRole('button', { name: 'Алып салуу: report.png' });
  expect(screen.getByLabelText('Сурооңуз')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Жөнөтүү' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Жөнөтүү' }));
  await screen.findByText('Ответ по фото');
  expect(api.post).toHaveBeenLastCalledWith('/assistant-support/chat', { message: 'Тиркелген файлдарды окуп, мазмунун кыскача түшүндүрүп бер.', history: [], lang: 'ky', documentIds: ['photo-1'] }, expect.anything());
  fireEvent.click(screen.getByRole('button', { name: 'Алып салуу: report.png' }));
  expect(screen.queryByRole('button', { name: 'Алып салуу: report.png' })).not.toBeInTheDocument();
});
test('regenerates the last answer without duplicating history or losing a draft', async () => {
  saveChats(2, [{ id: 'saved', title: 'Отчёт', messages: [{ role: 'user', content: 'План отчёта' }, { role: 'assistant', content: 'Первый ответ' }] }]);
  api.post.mockResolvedValue({ data: { answer: 'Новый ответ' } });
  render(<Assistant />);
  await screen.findByText('Первый ответ');
  fireEvent.change(screen.getByLabelText('Сурооңуз'), { target: { value: 'Черновик' } });
  fireEvent.click(screen.getByText('Кайра жооп берүү'));
  await screen.findByText('Новый ответ');
  expect(loadChats(2)[0].messages).toHaveLength(2);
  expect(screen.getByLabelText('Сурооңуз')).toHaveValue('Черновик');
  expect(api.post).toHaveBeenCalledWith('/assistant-support/chat', expect.objectContaining({ message: 'План отчёта', history: [] }), expect.anything());
  fireEvent.change(screen.getByLabelText('Чат издөө'), { target: { value: 'несуществующий' } });
  expect(screen.queryByRole('button', { name: 'Отчёт' })).not.toBeInTheDocument();
});
test('Kyrgyz chat sends bounded history and renders model text safely', async () => {
  api.post.mockResolvedValue({ data: { answer: '<img src=x onerror=alert(1)>', sources: [{ id: '1', title: 'Нускама' }] } });
  const { container } = render(<Assistant />);
  await screen.findByText('● Жергиликтүү модель даяр');
  expect(screen.queryByText('Жалпы документтерди кошуу (админ)')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Сурооңуз'), { target: { value: 'Отчётту кантип жөнөтөм?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Жөнөтүү' }));
  await screen.findByText('<img src=x onerror=alert(1)>');
  expect(container.querySelector('img')).toBeNull();
  expect(api.post).toHaveBeenCalledWith('/assistant-support/chat', { message: 'Отчётту кантип жөнөтөм?', history: [], lang: 'ky', documentIds: [] }, expect.anything());
  fireEvent.click(screen.getByText('Эске сактоо / оңдоо'));
  fireEvent.change(screen.getByLabelText('Туура жооп'), { target: { value: 'Сактап, командирге жөнөтүңүз.' } });
  fireEvent.click(screen.getByText('Сактоо'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/assistant/corrections', { question: 'Отчётту кантип жөнөтөм?', answer: 'Сактап, командирге жөнөтүңүз.' }));
});
test('restores a conversation, creates a new draft, and deletes only after confirmation', async () => {
  saveChats(2, [{ id: 'saved', title: 'Мурунку чат', messages: [{ role: 'user', content: 'Сакталган суроо' }, { role: 'assistant', content: 'Сакталган жооп' }] }]);
  saveChats(3, [{ id: 'other', title: 'Чужой чат', messages: [] }]);
  render(<Assistant />);
  await screen.findByText('Сакталган жооп');
  expect(screen.queryByText('Чужой чат')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '＋ Жаңы чат' }));
  expect(screen.getByText('Кантип жардам берейин?')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Мурунку чат'));
  expect(screen.getByText('Сакталган жооп')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Чатты өчүрүү: Мурунку чат' }));
  expect(loadChats(2)).toHaveLength(1);
  fireEvent.click(screen.getByText('Өчүрүү', { exact: true }));
  expect(loadChats(2)).toEqual([]);
  expect(loadChats(3)).toHaveLength(1);
});
test('mobile history panel opens, closes on Escape and restores focus without losing the draft', async () => {
  window.matchMedia = jest.fn(() => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  render(<Assistant />);
  await screen.findByText('● Жергиликтүү модель даяр');
  const input = screen.getByLabelText('Сурооңуз');
  fireEvent.change(input, { target: { value: 'Жазылып жаткан суроо' } });
  const toggle = screen.getByRole('button', { name: 'Чаттардын тарыхы' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  toggle.focus(); fireEvent.click(toggle);
  expect(screen.getByRole('dialog', { name: 'Чаттардын тарыхы' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(toggle).toHaveFocus();
  expect(input).toHaveValue('Жазылып жаткан суроо');
  delete window.matchMedia;
});
test('right functions panel toggles with the same button and keeps search settings and message draft', async () => {
  render(<Assistant />);
  await screen.findByText('● Жергиликтүү модель даяр');
  fireEvent.change(screen.getByLabelText('Сурооңуз'), { target: { value: 'Менин суроом' } });
  const toggle = screen.getByRole('button', { name: 'Жардамчынын настройкалары' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByLabelText('Интернеттен издөө'));
  fireEvent.change(screen.getByLabelText('Издөө сөздөрү'), { target: { value: 'Бишкек' } });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('complementary', { name: 'Жардамчынын функциялары' })).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(screen.getByLabelText('Издөө сөздөрү')).toHaveValue('Бишкек');
  expect(screen.getByLabelText('Интернеттен издөө')).toBeChecked();
  expect(screen.getByLabelText('Сурооңуз')).toHaveValue('Менин суроом');
});





