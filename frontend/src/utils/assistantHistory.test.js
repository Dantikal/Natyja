import { chatKey, loadChats, saveChats } from './assistantHistory';
beforeEach(() => localStorage.clear());
test('history is scoped to the current account and malformed storage is ignored', () => {
  saveChats(1, [{ id: 'a', title: 'Private', messages: [{ role: 'user', content: 'Personal text' }] }]);
  expect(loadChats(1)[0].messages[0].content).toBe('Personal text');
  expect(loadChats(2)).toEqual([]);
  localStorage.setItem(chatKey(2), '{invalid');
  expect(loadChats(2)).toEqual([]);
  localStorage.setItem(chatKey(2), JSON.stringify([{ id: 'b', title: 'Test', messages: [{ role: 'system', content: 'bad' }, null] }]));
  expect(loadChats(2)[0].messages).toEqual([]);
});
test('history capacity errors preserve the previously saved conversations', () => {
  saveChats(1, [{ id: 'a', title: 'Saved', messages: [] }]);
  expect(() => saveChats(1, [{ content: 'x'.repeat(1800001) }])).toThrow('HISTORY_FULL');
  expect(loadChats(1)[0].title).toBe('Saved');
});
