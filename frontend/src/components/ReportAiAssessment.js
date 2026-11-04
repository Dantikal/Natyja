import {useCallback,useEffect,useState} from 'react';
import api from '../api/axios';
import {useLang} from '../context/LanguageContext';
import './ReportAiAssessment.css';
export function useReportAssessments(mine=false){
 const [reviews,setReviews]=useState({});
 const refresh=useCallback(async(signal)=>{const {data}=await api.get('/report-assessments',{signal,params:mine?{mine:1}:{}});if(Array.isArray(data))setReviews(Object.fromEntries(data.map(item=>[item.task_id,item])));},[mine]);
 useEffect(()=>{const controller=new AbortController();const update=()=>refresh(controller.signal).catch(()=>{});update();const timer=setInterval(()=>{if(!document.hidden)update();},15000);return()=>{controller.abort();clearInterval(timer);};},[refresh]);
 return {reviews,refresh};
}
export default function ReportAiAssessment({review,taskId,submitted,own,onUpdated}){
 const {lang}=useLang(),ky=lang==='ky';const [error,setError]=useState(''),[busy,setBusy]=useState(false),[appealing,setAppealing]=useState(false),[text,setText]=useState('');
 async function action(appeal){setBusy(true);setError('');try{await api.post(appeal?`/report-assessments/${review.id}/appeal`:`/report-assessments/task/${taskId}/analyze`,appeal?{text}:{});setAppealing(false);await onUpdated?.();}catch(error){setError(error.response?.data?.error||(ky?'Аракет аткарылган жок.':'Не удалось выполнить действие.'));}finally{setBusy(false);}}
 if(!review&&!submitted)return null;
 const labels={completeness:ky?'Толуктук':'Полнота',compliance:ky?'Талаптарга шайкештик':'Соответствие заданию',clarity:ky?'Тактык':'Ясность'};
 return <section className="report-ai-assessment" aria-label={ky?'ИИнин отчётко баасы':'Оценка отчёта ИИ'}><header><h3>{ky?'Отчётту ИИ текшерүүсү':'Проверка отчёта ИИ'}</h3>{review?.state==='ready'&&<strong>{review.points?`+${review.points}`:'0'} {ky?'упай':'баллов'}</strong>}</header>
 <p className="report-ai-note">{ky?'ИИнин ички алдын ала баасы. Бекитилген рейтингге автоматтык кошулбайт.':'Внутренняя предварительная оценка ИИ. Учитывается отдельно от подтверждённого рейтинга.'}</p>
 {!review?<p>{ky?'Бул версия текшериле элек.':'Эта версия ещё не проверялась автоматически.'}</p>:['queued','running'].includes(review.state)?<p role="status">{review.state==='running'?(ky?'ИИ отчётту окуп жатат…':'ИИ читает задание и отчёт…'):(ky?'Текшерүү кезекте…':'Проверка в очереди…')}</p>:review.state==='error'?<p>{review.error_message}</p>:<>
 {review.state==='ready'&&<p><b>{review.decision==='revise'?(ky?'Оңдоолор керек':'Нужны исправления'):(ky?'ИИ баасы':'Оценка ИИ')}: </b>{review.points===7?(ky?'Эң жакшы':'Отлично'):review.points===5?(ky?'Жакшы':'Хорошо'):review.points===3?(ky?'Канааттандырарлык':'Удовлетворительно'):ky?'Азырынча упай жок':'Пока без баллов'}</p>}
 {review.analysis&&<><p>{review.analysis.summary}</p><details><summary>{ky?'Баанын негиздемеси':'Почему такая оценка'}</summary>{Object.entries(review.analysis.criteria||{}).map(([key,value])=><div key={key} className="report-ai-criterion"><b>{labels[key]||key}: {value.score}/2</b><p>{value.reason}</p>{value.quote&&<blockquote>{value.quote}</blockquote>}</div>)}{!!review.analysis.improvements?.length&&<><h4>{ky?'Эмнени оңдоо керек':'Что исправить'}</h4><ul>{review.analysis.improvements.map((item,index)=><li key={index}>{item}</li>)}</ul></>}</details></>}
 </>}
 {submitted&&(!review||['error','needs_review'].includes(review.state))&&<button type="button" className="btn-secondary" disabled={busy} onClick={()=>action(false)}>{ky?'ИИ текшерүүсүн баштоо':'Запустить проверку ИИ'}</button>}
 {review?.appeal_text&&<div className="report-ai-appeal"><b>{ky?'Автордун кайрылуусу':'Обращение автора'}</b><p>{review.appeal_text}</p></div>}
 {own&&submitted&&review?.state==='ready'&&!appealing&&<button type="button" className="btn-secondary" onClick={()=>{setText(review.appeal_text||'');setAppealing(true);}}>{ky?'Баа боюнча кайрылуу':'Не согласен с оценкой'}</button>}
 {appealing&&<form onSubmit={event=>{event.preventDefault();action(true);}}><label>{ky?'Эмне туура эмес?':'Что оценено неправильно?'}<textarea value={text} onChange={event=>setText(event.target.value)} required minLength={10} maxLength={2000} rows={3}/></label><button className="btn-primary" disabled={busy}>{ky?'Жетекчиге жөнөтүү':'Отправить руководителю'}</button>{' '}<button type="button" className="btn-secondary" onClick={()=>setAppealing(false)}>{ky?'Жабуу':'Закрыть'}</button></form>}
 {error&&<p role="alert">{error}</p>}
 </section>;
}
