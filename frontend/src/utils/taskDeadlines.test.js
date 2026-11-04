import { remaining, reminderKey } from './taskDeadlines';
const now = Date.parse('2026-10-30T06:00:00Z');
test('deadline calculations handle overdue, hour/day thresholds, missing dates and reviewed tasks', () => {
  const task = { id: 7, status: 'в_работе', due_date: '2026-10-30T06:30:00Z' };
  expect(remaining(task.due_date, now)).toBe('Осталось: 30 мин.');
  expect(reminderKey(task, now)).toContain(':hour');
  expect(reminderKey({ ...task, due_date: '2026-10-31T05:00:00Z' }, now)).toContain(':day');
  expect(reminderKey({ ...task, due_date: '2026-11-02T05:00:00Z' }, now)).toBeNull();
  expect(reminderKey({ ...task, status: 'на_проверке' }, now)).toBeNull();
  expect(remaining(null, now)).toBe('Срок не указан');
  expect(reminderKey({ ...task, due_date: 'invalid' }, now)).toBeNull();
  expect(remaining('2026-10-30T05:00:00Z', now)).toContain('Просрочено');
  expect(reminderKey(task, now + 3600000)).toContain('overdue:');
  expect(remaining(task.due_date, now, true)).toBe('Калды: 30 мүн.');
});
