import { useEffect, useRef, useState } from 'react';

export default function AssistantVoice({ ky, busy, lastAnswer, errorMessage, onSend, onClose }) {
  const [listening, setListening] = useState(false), [transcript, setTranscript] = useState(''), [error, setError] = useState(''), [speaking, setSpeaking] = useState(false);
  const recognition = useRef(null), dialog = useRef(null), close = useRef(null), waiting = useRef(false);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synthesis = window.speechSynthesis;
  useEffect(() => {
    const previous = document.activeElement; close.current?.focus();
    const keyboard = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const elements = [...dialog.current.querySelectorAll('button:not(:disabled),textarea:not(:disabled)')];
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { recognition.current?.abort(); synthesis?.cancel(); document.removeEventListener('keydown', keyboard); if (previous?.isConnected) previous.focus(); };
  }, [onClose, synthesis]);
  useEffect(() => {
    if (busy || !waiting.current) return;
    const previous = waiting.current.answer;
    waiting.current = false;
    if (lastAnswer === previous) return;
    setTranscript('');
    if (!lastAnswer || !synthesis || !window.SpeechSynthesisUtterance) return;
    const utterance = new window.SpeechSynthesisUtterance(lastAnswer.replace(/[`*#]/g, '').slice(0, 6000));
    const voices = synthesis.getVoices();
    const voice = voices.find(item => item.lang.startsWith(ky ? 'ky' : 'ru'));
    utterance.lang = voice?.lang || 'ru-RU'; if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeaking(true); utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => { setSpeaking(false); setError(ky ? 'Үн менен окуу мүмкүн эмес.' : 'Не удалось озвучить ответ. Он доступен в чате.'); };
    synthesis.speak(utterance);
  }, [busy, lastAnswer, ky, synthesis]);
  function start() {
    if (!Recognition) return;
    synthesis?.cancel(); setSpeaking(false); setError('');
    const instance = new Recognition(); recognition.current = instance;
    instance.lang = 'ru-RU'; instance.continuous = false; instance.interimResults = true;
    instance.onresult = event => setTranscript(Array.from(event.results).map(result => result[0].transcript).join(' ').slice(0, 4000));
    instance.onend = () => setListening(false);
    instance.onerror = event => { setListening(false); setError(event.error === 'not-allowed' ? (ky ? 'Микрофонго уруксат бериңиз.' : 'Разрешите доступ к микрофону в браузере.') : (ky ? 'Үн таанылган жок. Кайра аракет кылыңыз.' : 'Не удалось распознать речь. Проверьте интернет и попробуйте снова.')); };
    try { instance.start(); setListening(true); } catch { setError(ky ? 'Микрофон жеткиликсиз.' : 'Микрофон сейчас недоступен.'); }
  }
  return <div className="assistant-voice-overlay"><section ref={dialog} className="assistant-voice-dialog" role="dialog" aria-modal="true" aria-labelledby="voice-title">
    <button ref={close} type="button" className="assistant-voice-close" onClick={onClose} aria-label={ky ? 'Үн режимин жабуу' : 'Закрыть голосовой чат'}>×</button>
    <div className={'assistant-voice-orb' + (listening || speaking ? ' active' : '')} aria-hidden="true">◉</div>
    <h2 id="voice-title">{ky ? 'Үн менен сүйлөшүү' : 'Голосовой чат'}</h2>
    <p role="status">{listening ? (ky ? 'Угуп жатам…' : 'Слушаю…') : busy ? (ky ? 'Жооп даярдалууда…' : 'Готовлю ответ…') : speaking ? (ky ? 'Жоопту окуп жатам…' : 'Озвучиваю ответ…') : (ky ? 'Сүйлөп, текстти текшерип жөнөтүңүз.' : 'Продиктуйте вопрос, проверьте текст и отправьте.')}</p>
    <p className="assistant-voice-disclosure">{ky ? 'Үн таануу браузердин интернет кызматына жөнөтүлүшү мүмкүн. Азырынча орусча сүйлөңүз. Кыргызча үн жок болсо, жооп орусча үн менен окулат.' : 'Браузер может отправлять звук своему сервису распознавания; нужен интернет. Пока диктуйте по-русски. Для озвучивания используется голос устройства.'}</p>
    {!Recognition && <p role="alert">{ky ? 'Бул браузер үн таанууну колдобойт. Chrome же Edge колдонуңуз.' : 'Этот браузер не поддерживает распознавание речи. Откройте сайт в Chrome или Edge.'}</p>}
    {error && <p role="alert">{error}</p>}
    {errorMessage && <p role="alert">{errorMessage}</p>}
    <textarea aria-label={ky ? 'Үн аркылуу жазылган суроо' : 'Распознанный вопрос'} value={transcript} maxLength={4000} onChange={event => setTranscript(event.target.value)} disabled={busy || listening} rows={3} />
    <div className="assistant-voice-actions"><button type="button" disabled={!Recognition || busy} onClick={() => listening ? recognition.current?.stop() : start()}>{listening ? (ky ? 'Токтотуу' : 'Закончить запись') : (ky ? 'Микрофонду күйгүзүү' : 'Включить микрофон')}</button><button type="button" disabled={busy || listening || !transcript.trim()} onClick={() => { synthesis?.cancel(); setSpeaking(false); waiting.current = { answer: lastAnswer }; onSend(transcript); }}>{ky ? 'Жөнөтүү' : 'Отправить вопрос'}</button>
    {speaking && <button type="button" onClick={() => { synthesis.cancel(); setSpeaking(false); }}>{ky ? 'Үндү токтотуу' : 'Остановить озвучивание'}</button>}</div>
  </section></div>;
}
