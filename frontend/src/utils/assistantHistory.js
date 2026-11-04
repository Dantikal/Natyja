export const chatKey = id => `natyyzha:chats:v1:${id}`;
export function loadChats(id) {
  try {
    const value = JSON.parse(localStorage.getItem(chatKey(id)) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(chat => chat && typeof chat.id === 'string' && typeof chat.title === 'string' && Array.isArray(chat.messages))
      .map(chat => ({ ...chat, messages: chat.messages.filter(message => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string') }));
  } catch { return []; }
}
export function saveChats(id, chats) {
  const serialized = JSON.stringify(chats);
  if (serialized.length > 1800000) throw new Error('HISTORY_FULL');
  localStorage.setItem(chatKey(id), serialized);
}
