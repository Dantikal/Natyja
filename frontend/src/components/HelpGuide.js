import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { topics } from '../help/topics';
import './HelpGuide.css';

export default function HelpGuide() {
  const { lang } = useLang();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const ky = lang === 'ky';
  const eligible = topics.filter(item => !item.roles || item.roles.includes(user?.role));
  const normalize = value => value.toLocaleLowerCase().replace(/ё/g, 'е');
  const search = normalize(query.trim());
  const visible = eligible.filter(item => normalize([item[ky ? 'ky' : 'ru'], ...item[ky ? 'stepsKy' : 'stepsRu']].join(' ')).includes(search));
  return <div className="help-guide">
    <p className="help-intro">{ky ? 'Сайтты жаңы колдонуп жатасызбы? Өз задачаңызды ачыңыз → отчёт жазыңыз → сактаңыз → командирге жөнөтүңүз.' : 'Впервые на сайте? Начните с одной задачи: найдите её → подготовьте отчёт → сохраните → отправьте на проверку.'}</p>
    <label className="help-search">{ky ? 'Керектүү теманы издөө' : 'Поиск по руководству'}
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={ky ? 'Мисалы: пароль, отчёт, код' : 'Например: пароль, отчёт, код'} />
    </label>
    <p className="help-result-count" role="status">{ky ? 'Бөлүмдөр' : 'Разделов'}: {visible.length}</p>
    {visible.map((item, index) => <details className="help-topic" key={item.id} open={Boolean(search) || index === 0}>
      <summary>{item[ky ? 'ky' : 'ru']}</summary>
      <ol>{item[ky ? 'stepsKy' : 'stepsRu'].map(step => <li key={step}>{step}</li>)}</ol>
    </details>)}
    {!visible.length && <p className="help-empty">{ky ? 'Табылган жок. Башка сөз менен издеңиз же жазган сөздү өчүрүңүз.' : 'Ничего не найдено. Попробуйте другое слово или очистите поиск.'}</p>}
    <p className="help-contact">{ky ? 'Дагы суроо болсо, командириңизден же админден сураңыз. Паролуңузду эч кимге айтпаңыз.' : 'Если вопрос остался, обратитесь к своему командиру или администратору сайта. Не передавайте свой пароль другим людям.'}</p>
  </div>;
}
