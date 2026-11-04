export function remaining(due, now = Date.now(), ky = false) {
  const deadline = new Date(due).getTime();
  if (!due || !Number.isFinite(deadline)) return ky ? 'Срок көрсөтүлгөн эмес' : 'Срок не указан';
  const difference = deadline - now;
  const minutes = Math.ceil(Math.abs(difference) / 60000);
  const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60), mins = minutes % 60;
  const value = days ? `${days} ${ky ? 'күн' : 'дн.'} ${hours} ${ky ? 'саат' : 'ч.'}` : hours ? `${hours} ${ky ? 'саат' : 'ч.'} ${mins} ${ky ? 'мүн.' : 'мин.'}` : `${Math.max(1, mins)} ${ky ? 'мүн.' : 'мин.'}`;
  return difference <= 0 ? (ky ? 'Срок өтүп кетти: ' : 'Просрочено: ') + value : (ky ? 'Калды: ' : 'Осталось: ') + value;
}
export function reminderKey(task, now) {
  if (!['новая','в_работе'].includes(task.status) || !task.due_date) return null;
  const difference = new Date(task.due_date).getTime() - now;
  if (!Number.isFinite(difference) || difference > 86400000) return null;
  const level = difference <= 0 ? 'overdue:' + new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bishkek' }).format(new Date(now)) : difference <= 3600000 ? 'hour' : 'day';
  return `${task.id}:${task.due_date}:${level}`;
}
