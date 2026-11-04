import { useEffect,useState } from 'react';
import api from '../api/axios';
import { useLang } from '../context/LanguageContext';
import { ratingPeriods } from '../utils/ratingPeriods';
import './PointsSummary.css';
export default function PointsSummary() {
  const {lang}=useLang(),ky=lang==='ky'; const [periods,setPeriods]=useState(null),[error,setError]=useState('');
  useEffect(()=>{ const controller=new AbortController(); api.get('/rating/my',{signal:controller.signal}).then(res=>setPeriods(res.data.periods)).catch(error=>{if(error.code!=='ERR_CANCELED')setError(ky?'Упайларды жүктөө мүмкүн эмес.':'Не удалось загрузить баллы.');}); return()=>controller.abort(); },[ky]);
  return <section className="points-summary" aria-label={ky?'Мезгилдер боюнча упайлар':'Баллы по периодам'}><h2>{ky?'Менин упайларым':'Мои баллы'}</h2><p>{ky?'Акыркы 7 күн, 1, 3, 6 жана 12 ай. Эсеп кабыл алынган күн боюнча жүргүзүлөт.':'За последние 7 дней, 1, 3, 6 и 12 месяцев. Начисления учитываются по дате принятия.'}</p>
    {error&&<p role="alert">{error}</p>}{!periods&&!error&&<p role="status">{ky?'Жүктөлүүдө…':'Загружаем баллы…'}</p>}
    <div className="points-period-grid">{periods?.map(period=>{const label=ratingPeriods.find(item=>item[0]===period.key)?.[ky?2:1];return <article key={period.key}><h3>{label}</h3><strong>{period.total}</strong><span>{ky?'упай':'баллов'}</span><small>{period.from.split('-').reverse().join('.')} — {period.to.split('-').reverse().join('.')}</small><p>{ky?'Тапшырмалар':'Задачи'}: +{period.taskPoints}<br/>{ky?'Идеялар':'Идеи'}: +{period.ideaPoints}<br/>{ky?'Кармалды':'Удержано'}: −{period.penalties}</p></article>;})}</div>
  </section>;
}
