import { exportDocx } from './documents';
import mammoth from 'mammoth/mammoth.browser';
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

test('DOCX export preserves Cyrillic report text, formatting, tables, and lists', async () => {
  const blob = await exportDocx('<h1>Отчёт — Кыргызча</h1><p><strong>Выполнено</strong> <em>Бүттү</em></p><ol><li>Первый пункт</li><li>Экинчи пункт</li></ol><table><tbody><tr><th>Иш</th><th>Саны</th></tr><tr><td>Проверка</td><td>12</td></tr></tbody></table>');
  const arrayBuffer = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsArrayBuffer(blob); });
  const result = await mammoth.convertToHtml({ arrayBuffer });
  expect(result.value).toContain('Отчёт — Кыргызча');
  expect(result.value).toContain('<strong>Выполнено</strong>');
  expect(result.value).toContain('<em>Бүттү</em>');
  expect(result.value).toContain('<table>');
  expect(result.value).toContain('<ol>');
  expect(result.value).toContain('Экинчи пункт');
  expect(result.value).toContain('12');
});
