import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import './Assistant.css';
import { loadChats, saveChats } from '../utils/assistantHistory';
import AssistantContext from '../components/AssistantContext';
import AssistantMessage from '../components/AssistantMessage';
import AssistantVoice from '../components/AssistantVoice';
import { remaining } from '../utils/taskDeadlines';

export default function Assistant() {
  const { user } = useAuth();
  return <ChatWorkspace key={user.id} user={user} />;
}
function ChatWorkspace({ user }) {
  const { lang } = useLang();
  const ky = lang === 'ky';
  const [ready, setReady] = useState(null);
  const [chats, setChats] = useState(() => loadChats(user.id));
  const [activeId, setActiveId] = useState(() => loadChats(user.id)[0]?.id || null);
  const active = chats.find(chat => chat.id === activeId);
  const messages = active?.messages || [];
  const [search, setSearch] = useState('');
  const [attachOpen, setAttachOpen] = useState(false), [voiceOpen, setVoiceOpen] = useState(false);
  const contextControls = useRef(null), documentPicker = useRef(null), photoPicker = useRef(null), attachmentMenu = useRef(null), plusButton = useRef(null);
  const closeVoice = useCallback(() => setVoiceOpen(false), []);
  const [pending, setPending] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [tools, setTools] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(max-width: 760px), (max-height: 500px) and (max-width: 1100px)').matches || false);
  const shell = useRef(null), sidebar = useRef(null), panelToggle = useRef(null);
  const [context, setContext] = useState({ documentIds: [] });
  const [confirmMemory, setConfirmMemory] = useState(false);
  const input = useRef(null);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [correction, setCorrection] = useState(null);
  const [answer, setAnswer] = useState('');
  const [documents, setDocuments] = useState([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const controller = useRef(null);
  const end = useRef(null);
  const drawerOpen = tools || !!correction;
  const settingsToggle = useRef(null);
  useEffect(() => {
    if (!attachOpen) return;
    attachmentMenu.current?.querySelector('button')?.focus();
    const close = event => {
      if (event.key === 'Escape') { setAttachOpen(false); plusButton.current?.focus(); }
      else if (event.type === 'pointerdown' && !attachmentMenu.current?.contains(event.target) && !plusButton.current?.contains(event.target)) setAttachOpen(false);
    };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [attachOpen]);
  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 760px), (max-height: 500px) and (max-width: 1100px)');
    const update = () => { setMobile(query?.matches || false); const navbar = document.querySelector('.navbar'); const height = window.visualViewport?.height || window.innerHeight; const toolbar = shell.current?.querySelector('.assistant-page>header')?.getBoundingClientRect().height || 54; const navHeight = navbar?.getBoundingClientRect().height || 0; shell.current?.style.setProperty('--ai-viewport-height', height + 'px'); shell.current?.style.setProperty('--ai-height', `${Math.max(0, height - navHeight)}px`); shell.current?.style.setProperty('--ai-toolbar-height', toolbar + 'px'); shell.current?.style.setProperty('--ai-panel-top', (navHeight + toolbar) + 'px'); };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    const navbar = document.querySelector('.navbar'); if (navbar) observer?.observe(navbar);
    const toolbar = shell.current?.querySelector('.assistant-page>header'); if (toolbar) observer?.observe(toolbar);
    query?.addEventListener('change', update); window.addEventListener('resize', update); window.visualViewport?.addEventListener('resize', update);
    return () => { observer?.disconnect(); query?.removeEventListener('change', update); window.removeEventListener('resize', update); window.visualViewport?.removeEventListener('resize', update); };
  }, []);
  useEffect(() => {
    if (!mobile || !panelOpen) return;
    const previous = document.activeElement;
    sidebar.current?.querySelector('button')?.focus();
    function keyboard(event) {
      if (event.key === 'Escape') { event.preventDefault(); setPanelOpen(false); }
      if (event.key !== 'Tab') return;
      const controls = [...sidebar.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], summary')].filter(element => element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); if (previous?.isConnected) previous.focus(); };
  }, [mobile, panelOpen]);
  useEffect(() => {
    if (!drawerOpen) return;
    const close = event => { if (event.key === 'Escape') { setCorrection(null); setTools(false); settingsToggle.current?.focus(); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [drawerOpen]);
  function toggleTools() { setPanelOpen(false); setCorrection(null); setTools(!drawerOpen); }
  useEffect(() => {
    const abort = new AbortController();
    api.get('/assistant-support/status', { signal: abort.signal }).then(res => setReady(res.data.ready)).catch(() => {});
    if (user?.role === 'admin') api.get('/assistant/knowledge', { signal: abort.signal }).then(res => setDocuments(res.data)).catch(() => {});
    return () => { abort.abort(); controller.current?.abort(); };
  }, [user?.role]);
  useEffect(() => {
    const scroll = () => { const chat = end.current?.parentElement; if (chat) chat.scrollTop = chat.scrollHeight; };
    const frame = window.requestAnimationFrame ? window.requestAnimationFrame(scroll) : setTimeout(scroll, 0);
    return () => { if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame); else clearTimeout(frame); };
  }, [activeId, messages.length, busy]);
  useEffect(() => {
    if (input.current) { input.current.style.height = 'auto'; input.current.style.height = Math.min(160, Math.max(48, input.current.scrollHeight)) + 'px'; }
  }, [question]);
  function commit(next) {
    setChats(next);
    try { saveChats(user.id, next); }
    catch { setError(ky ? 'Тарых сакталган жок: браузердин эс тутуму толду. Эски чаттарды өчүрүңүз.' : 'История не сохранена: память браузера заполнена. Удалите ненужные беседы.'); }
  }
  function select(id) {
    if (busy) return;
    setActiveId(id); setQuestion(''); setError(''); setNotice(''); setCorrection(null); setDeleteId(null);
    setPanelOpen(false);
    if (!mobile || (!id && !panelOpen)) input.current?.focus();
  }
  async function copy(content) {
    try { await navigator.clipboard.writeText(content); setNotice(ky ? 'Жооп көчүрүлдү.' : 'Ответ скопирован.'); }
    catch { setError(ky ? 'Текстти белгилеп, Ctrl+C басыңыз.' : 'Выделите текст и нажмите Ctrl+C.'); }
  }
  const failure = err => setError(err.response?.data?.error || (ky ? 'Байланыш жок. Кайра аракет кылыңыз.' : 'Нет связи. Попробуйте ещё раз.'));
  async function send(event, retry = false, spoken = '') {
    event.preventDefault();
    const attachmentPrompt = context.documentIds?.length ? (ky ? 'Тиркелген файлдарды окуп, мазмунун кыскача түшүндүрүп бер.' : 'Прочитай прикреплённые файлы и кратко объясни их содержание.') : '';
    const message = (spoken || (retry ? messages[messages.length - 2]?.content : question.trim() || attachmentPrompt))?.trim();
    if (busy || !message) return;
    if (context.uploading) { setError(ky ? 'Файл жүктөлгөнчө күтө туруңуз.' : 'Дождитесь загрузки документа.'); return; }
    if (context.webEnabled && !context.webQuery) { setError(ky ? 'Интернеттен издөө сөздөрүн жазыңыз.' : 'Укажите отдельные слова для интернет-поиска.'); return; }
    const baseMessages = retry ? messages.slice(0, -2) : messages;
    const history = baseMessages.slice(-6).map(({ role, content }) => ({ role, content: content.slice(0, 2400) }));
    setDeleteId(null); setAttachOpen(false); setBusy(true); setPending(message); if (!retry && !spoken) setQuestion(''); setError(''); setNotice('');
    controller.current = new AbortController();
    try {
      const { webEnabled, uploading, attachments, ...selectedContext } = context;
      const { data } = await api.post('/assistant-support/chat', { message, history, lang, ...selectedContext }, { signal: controller.current.signal, timeout: 210000 });
      const id = activeId || crypto.randomUUID();
      const updated = { id, title: active?.title || message.slice(0, 70), updatedAt: new Date().toISOString(), messages: [...baseMessages, { role: 'user', content: message }, { role: 'assistant', content: data.answer, sources: data.sources, task: data.task, question: message }] };
      commit([updated, ...chats.filter(chat => chat.id !== id)]); setActiveId(id); setReady(true);
    } catch (err) { if (err.code !== 'ERR_CANCELED') { failure(err); if (!retry && !spoken) setQuestion(message); } }
    finally { setBusy(false); setPending(''); }
  }
  async function saveCorrection(event) {
    event.preventDefault(); setError('');
    try {
      await api.post('/assistant/corrections', { question: correction.question.slice(0, 2000), answer });
      setCorrection(null); setAnswer(''); setNotice(ky ? 'Эске сакталды. Бул маалымат өзүңүзгө гана колдонулат.' : 'Запомнил. Эта запись доступна только вашему аккаунту и может использоваться в следующих беседах.');
    } catch (err) { failure(err); }
  }
  async function addDocument(event) {
    event.preventDefault(); setError('');
    try {
      await api.post('/assistant/knowledge', { title, text });
      setDocuments((await api.get('/assistant/knowledge')).data); setTitle(''); setText('');
      setNotice(ky ? 'Документ кошулду.' : 'Документ добавлен.');
    } catch (err) { failure(err); }
  }
  async function removeDocument(id) {
    try { await api.delete('/assistant/knowledge/' + id); setDocuments(items => items.filter(item => item.id !== id)); }
    catch (err) { failure(err); }
  }
  async function clearMemory() {
    try { await api.delete('/assistant/corrections'); setConfirmMemory(false); setNotice(ky ? 'Жеке оңдоолор өчүрүлдү.' : 'Личные исправления удалены.'); }
    catch (err) { failure(err); }
  }
  return <main className={'assistant-shell' + (drawerOpen ? ' tools-open' : '')} ref={shell}>
    {mobile && panelOpen && <button className="assistant-sidebar-backdrop" type="button" tabIndex={-1} aria-label={ky ? 'Панелди жабуу' : 'Закрыть панель'} onClick={() => setPanelOpen(false)} />}
    <aside id="assistant-sidebar" ref={sidebar} className={'assistant-sidebar' + (panelOpen ? ' is-open' : '')} role={mobile ? 'dialog' : undefined} aria-modal={mobile && panelOpen ? true : undefined} aria-hidden={mobile && !panelOpen ? true : undefined} aria-label={ky ? 'Чаттардын тарыхы' : 'История бесед'}>
      <button className="assistant-panel-close" type="button" aria-label={ky ? 'Жабуу' : 'Закрыть'} onClick={() => setPanelOpen(false)}>×</button>
      <div className="assistant-brand"><span aria-hidden="true">✦</span> Натыйжа <small>AI</small></div>
      <button className="assistant-new" type="button" disabled={busy} onClick={() => select(null)}>＋ {ky ? 'Жаңы чат' : 'Новый чат'}</button>
      <h2>{ky ? 'Сиздин чаттар' : 'Ваши беседы'}</h2>
      <input className="assistant-history-search" type="search" aria-label={ky ? 'Чат издөө' : 'Поиск бесед'} placeholder={ky ? 'Чат издөө…' : 'Поиск бесед…'} value={search} onChange={event => setSearch(event.target.value)} />
      <div className="assistant-chat-list">{!chats.length && <p>{ky ? 'Бул жерде чаттарыңыз болот.' : 'Здесь появятся ваши разговоры.'}</p>}{chats.filter(chat => (chat.title + ' ' + chat.messages.map(item => item.content).join(' ')).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(chat => <div className={'assistant-chat-row' + (chat.id === activeId ? ' selected' : '')} key={chat.id}>
        <button type="button" className="assistant-chat-title" disabled={busy} aria-current={chat.id === activeId ? 'page' : undefined} onClick={() => select(chat.id)} title={chat.title}>{chat.title}</button>
        <button type="button" className="assistant-delete" disabled={busy} aria-label={(ky ? 'Чатты өчүрүү: ' : 'Удалить беседу: ') + chat.title} onClick={() => setDeleteId(chat.id)}>×</button>
      </div>)}</div>
      {deleteId && <div className="assistant-confirm"><p>{ky ? 'Бул чатты өчүрөсүзбү?' : 'Удалить эту беседу?'}</p><button type="button" className="btn-secondary" onClick={() => { commit(chats.filter(chat => chat.id !== deleteId)); if (activeId === deleteId) select(null); setDeleteId(null); }}>{ky ? 'Өчүрүү' : 'Удалить'}</button>{' '}<button type="button" className="btn-secondary" onClick={() => setDeleteId(null)}>{ky ? 'Жокко чыгаруу' : 'Отмена'}</button></div>}
      <div className="assistant-sidebar-bottom"><button type="button" className="assistant-tools" onClick={toggleTools} aria-expanded={drawerOpen} aria-controls="assistant-functions">{ky ? 'Жардамчынын функциялары' : 'Функции помощника'}</button><a className="assistant-help-link" href="/help">? {ky ? 'Сайт боюнча жардам' : 'Руководство по сайту'}</a><p>{ky ? 'Тарых ушул браузерде аккаунтуңуз үчүн сакталат.' : 'История сохраняется в этом браузере отдельно для вашего аккаунта.'}</p></div>
    </aside><section className="assistant-page">
    <header data-ready={ready ? 'true' : 'false'}><button ref={panelToggle} className="assistant-mobile-toggle" type="button" aria-label={ky ? 'Чаттардын тарыхы' : 'История бесед'} aria-controls="assistant-sidebar" aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg></button><h1>{ky ? 'ИИ жардамчы' : 'ИИ помощник'}</h1>
      <p>{ky ? 'Документ, отчёт, котормо жана сайт боюнча жардам.' : 'Помощь с документами, отчётами, переводом и сайтом.'}</p>
      <p role="status">{ready === null ? (ky ? 'Текшерилүүдө…' : 'Проверяем модель…') : ready ? (ky ? '● Жергиликтүү модель даяр' : '● Локальная модель готова') : (ky ? 'Модель азыр жеткиликсиз. Ollama иштеп турганын текшериңиз.' : 'Модель недоступна. Проверьте, что Ollama запущена.')}</p>
      <button type="button" className="assistant-mobile-new" disabled={busy} aria-label={ky ? 'Жаңы чат' : 'Новый чат'} onClick={() => select(null)}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M14 5H5v14h14v-9M14 4l6 6M11 13l1-4 6-6 4 4-6 6Z"/></svg></button>
      <button ref={settingsToggle} type="button" className={'assistant-settings-toggle' + (context.documentIds?.length || context.taskId || context.webEnabled ? ' has-context' : '')} aria-label={ky ? 'Жардамчынын настройкалары' : 'Настройки помощника'} title={ky ? 'Жардамчынын настройкалары' : 'Настройки помощника'} aria-expanded={drawerOpen} aria-controls="assistant-functions" onClick={toggleTools}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--surface,#fff)"/><circle cx="15" cy="17" r="3" fill="var(--surface,#fff)"/></svg></button>
    </header>
    {error && <p role="alert" className="assistant-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <section className="assistant-chat" aria-label={ky ? 'Сүйлөшүү' : 'Переписка'} aria-live="polite">
      {!messages.length && !busy && <div className="assistant-welcome"><div className="assistant-spark" aria-hidden="true">✦</div><h2>{ky ? 'Кантип жардам берейин?' : 'Чем могу помочь?'}</h2><p>{ky ? 'Сурооңузду жазыңыз же мисалды тандаңыз.' : 'Задайте вопрос своими словами или выберите пример.'}</p><div className="assistant-suggestions">{(ky ? ['Отчёттун планын түзүп бер', 'Сайтта отчётту кантип жөнөтөм?', 'Текстти которууга жардам бер'] : ['Составь план отчёта', 'Как отправить отчёт на сайте?', 'Помоги перевести текст']).map(example => <button type="button" key={example} onClick={() => { setQuestion(example); input.current?.focus(); }}>{example}<span aria-hidden="true">↗</span></button>)}</div></div>}
      {messages.map((item, index) => <article className={'assistant-message ' + item.role} key={index}>
        <strong>{item.role === 'user' ? (ky ? 'Сиз' : 'Вы') : (ky ? 'Жардамчы' : 'Помощник')}</strong>
        <div className="assistant-content">{item.role === 'assistant' ? <AssistantMessage text={item.content} onCopy={copy} ky={ky} /> : item.content}</div>
        {item.task && <div className="assistant-task-card"><strong>{ky ? 'Жооп берилген учурда сайттагы маалымат' : 'Данные сайта на момент ответа'}: {item.task.title}</strong><p>{item.task.status?.replace(/_/g, ' ')} · {remaining(item.task.due_date, new Date(item.task.serverNow).getTime(), ky)}</p>{item.task.due_date && <p>{new Date(item.task.due_date).toLocaleString(ky ? 'ky-KG' : 'ru-RU', { timeZone: 'Asia/Bishkek' })} · Бишкек</p>}</div>}
        {item.sources?.length > 0 && <details className="assistant-sources"><summary>{ky ? 'Булактар' : 'Источники'} · {item.sources.length}</summary>{item.sources.map((source, i) => <p key={i}>[{i + 1}] {typeof source.url === 'string' && /^https:\/\/(ru|ky)\.wikipedia\.org\//.test(source.url) ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}</p>)}</details>}
        {item.role === 'assistant' && <div className="assistant-message-actions"><button type="button" onClick={() => copy(item.content)}>{ky ? 'Көчүрүү' : 'Копировать'}</button>{index === messages.length - 1 && <button type="button" disabled={busy} onClick={event => send(event, true)}>{ky ? 'Кайра жооп берүү' : 'Ответить заново'}</button>}<button type="button" disabled={busy} onClick={() => { setCorrection({ ...item, question: item.question || messages[index - 1]?.content || item.content }); setAnswer(item.content.slice(0, 4000)); }}>{ky ? 'Эске сактоо / оңдоо' : 'Запомнить / исправить'}</button></div>}
      </article>)}
      {busy && <><article className="assistant-message user"><strong>{ky ? 'Сиз' : 'Вы'}</strong><div className="assistant-content">{pending}</div></article><p role="status" className="assistant-thinking">✦ {ky ? 'Жооп даярдап жатат…' : 'Готовит ответ…'}</p></>}<div ref={end} />
    </section>
    <form onSubmit={send} className="assistant-form">
      {!!context.attachments?.length && <div className="assistant-attachment-chips">{context.attachments.map(file => <span key={file.id} title={file.name}>▧ {file.name}<button type="button" disabled={busy} aria-label={(ky ? 'Алып салуу: ' : 'Убрать вложение: ') + file.name} onClick={() => contextControls.current?.removeSelection(file.id)}>×</button></span>)}</div>}
      <button ref={plusButton} type="button" className="assistant-compose-icon assistant-plus" aria-label={ky ? 'Файл кошуу' : 'Прикрепить файл'} aria-expanded={attachOpen} aria-controls="assistant-attachment-menu" disabled={busy || context.uploading} onClick={() => setAttachOpen(value => !value)}>+</button>
      {attachOpen && <div ref={attachmentMenu} id="assistant-attachment-menu" className="assistant-attachment-menu"><button type="button" onClick={() => { setAttachOpen(false); documentPicker.current?.click(); }}>▤ {ky ? 'Документ жүктөө' : 'Отправить документ'}<small>TXT, DOCX, PDF · 5 МБ</small></button><button type="button" onClick={() => { setAttachOpen(false); photoPicker.current?.click(); }}>▧ {ky ? 'Сүрөт жүктөө' : 'Отправить фото'}<small>{ky ? 'JPG, PNG · сүрөттөгү текст' : 'JPG, PNG · прочитать текст на фото'}</small></button></div>}
      <input ref={documentPicker} type="file" hidden accept=".txt,.docx,.pdf" aria-label={ky ? 'Документ тандоо' : 'Выбрать документ'} onChange={event => contextControls.current?.upload(event)} />
      <input ref={photoPicker} type="file" hidden accept=".jpg,.jpeg,.png" aria-label={ky ? 'Сүрөт тандоо' : 'Выбрать фото'} onChange={event => contextControls.current?.upload(event)} />
      {context.uploading && <span className="assistant-upload-progress" role="status">{ky ? 'Файлды окуп жатам…' : 'Читаю файл…'}</span>}
      <label htmlFor="assistant-question">{ky ? 'Сурооңуз' : 'Ваш вопрос'}</label>
      <textarea ref={input} id="assistant-question" placeholder={context.documentIds?.length ? (ky ? 'Файл боюнча суроо (милдеттүү эмес)…' : 'Вопрос по файлу (необязательно)…') : (ky ? 'Билдирүү жазыңыз…' : 'Напишите сообщение…')} value={question} onChange={event => setQuestion(event.target.value)} maxLength={4000} rows={2} disabled={busy} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if ((question.trim() || context.documentIds?.length) && !busy) send(event); } }} />
      <button type="button" className="assistant-compose-icon" aria-label={ky ? 'Үн менен сүйлөшүү' : 'Голосовой чат'} title={ky ? 'Үн менен сүйлөшүү' : 'Голосовой чат'} disabled={busy || context.uploading} onClick={() => { setAttachOpen(false); setVoiceOpen(true); }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></button>
      <button className="assistant-send" aria-label={ky ? 'Жөнөтүү' : 'Отправить'} title={ky ? 'Жөнөтүү' : 'Отправить'} disabled={busy || context.uploading || (!question.trim() && !context.documentIds?.length)}>↑</button>
    </form>
    <p className="assistant-footer-note">{ky ? 'Enter — жөнөтүү · Shift+Enter — жаңы сап. Маанилүү жоопторду текшериңиз. Азырынча орусча жакшыраак иштейт.' : 'Enter — отправить · Shift+Enter — новая строка. Проверяйте важные ответы. Кыргызский пока работает хуже русского.'}</p>
    </section>
    {mobile && drawerOpen && <button type="button" className="assistant-functions-backdrop" tabIndex={-1} aria-label={ky ? 'Функцияларды жабуу' : 'Закрыть функции'} onClick={() => { setCorrection(null); setTools(false); }} />}
    <aside id="assistant-functions" className="assistant-drawer" hidden={!drawerOpen} aria-label={ky ? 'Жардамчынын функциялары' : 'Функции помощника'}><div className="assistant-functions-heading"><h2>{ky ? 'Функциялар' : 'Функции помощника'}</h2><button type="button" className="assistant-drawer-close" aria-label={ky ? 'Функцияларды жабуу' : 'Закрыть функции'} onClick={() => { setCorrection(null); setTools(false); settingsToggle.current?.focus(); }}>×</button></div>
    <div hidden={!!correction}><AssistantContext ref={contextControls} onChange={setContext} onUploadError={setError} disabled={busy} /></div>
    {correction && <form onSubmit={saveCorrection} className="assistant-panel">
      <h2>{ky ? 'Эмнени эске сактайын?' : 'Что запомнить?'}</h2>
      <p>{ky ? 'Текстти текшерип, оңдоңуз. Бул жеке маалымат катары сакталат. Модель кайра үйрөтүлбөйт.' : 'Проверьте текст перед сохранением. Он станет личной справочной записью. Веса модели не изменяются.'}</p>
      <label htmlFor="assistant-correction">{ky ? 'Туура жооп' : 'Правильный ответ'}</label>
      <textarea id="assistant-correction" required maxLength={4000} rows={5} value={answer} onChange={event => setAnswer(event.target.value)} />
      <button className="btn-primary">{ky ? 'Сактоо' : 'Сохранить'}</button>{' '}
      <button type="button" className="btn-secondary" onClick={() => setCorrection(null)}>{ky ? 'Жокко чыгаруу' : 'Отмена'}</button>
    </form>}
    <details className="assistant-panel"><summary>{ky ? 'Жеке эс тутум' : 'Личная память'}</summary><p>{ky ? 'Башка чаттарда колдонуу үчүн жооптун алдындагы «Эске сактоо / оңдоо» басыңыз.' : 'Чтобы использовать сведения в следующих беседах, нажмите «Запомнить / исправить» под ответом.'}</p><button className="btn-secondary" onClick={() => setConfirmMemory(true)}>{ky ? 'Эс тутумду тазалоо' : 'Очистить память'}</button>{confirmMemory && <div className="assistant-confirm"><p>{ky ? 'Бардык жеке жазууларды өчүрөсүзбү? Чаттар калат.' : 'Удалить все личные записи? Беседы останутся.'}</p><button className="btn-secondary" onClick={clearMemory}>{ky ? 'Өчүрүү' : 'Удалить'}</button>{' '}<button className="btn-secondary" onClick={() => setConfirmMemory(false)}>{ky ? 'Жокко чыгаруу' : 'Отмена'}</button></div>}</details>
    {user?.role === 'admin' && <details className="assistant-panel"><summary>{ky ? 'Жалпы документтерди кошуу (админ)' : 'Общие документы (администратор)'}</summary>
      <p>{ky ? 'Бардык колдонуучуларга көрсөтүүгө уруксат берилген текстти гана кошуңуз. Жеке жана жашыруун маалыматтарды кошпоңуз.' : 'Добавляйте только проверенные тексты, разрешённые всем пользователям. Не добавляйте персональные и секретные сведения.'}</p>
      <form onSubmit={addDocument}><label htmlFor="knowledge-title">{ky ? 'Аталышы' : 'Название'}</label><input id="knowledge-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required />
        <label htmlFor="knowledge-text">{ky ? 'Документтин тексти' : 'Текст документа'}</label><textarea id="knowledge-text" value={text} onChange={event => setText(event.target.value)} rows={8} maxLength={40000} required />
        <button className="btn-primary">{ky ? 'Документти кошуу' : 'Добавить документ'}</button></form>
      <ul>{documents.map(item => <li key={item.id}>{item.title} <button className="btn-secondary" onClick={() => removeDocument(item.id)}>{ky ? 'Өчүрүү' : 'Удалить'}</button></li>)}</ul>
    </details>}
    </aside>{voiceOpen && <AssistantVoice ky={ky} busy={busy} lastAnswer={messages.filter(item => item.role === 'assistant').at(-1)?.content || ''} errorMessage={error} onSend={text => send({ preventDefault() {} }, false, text)} onClose={closeVoice} />}</main>;
}



