import {formatOutpostName} from '../../../data/militaryUnits.js';
import React,{useEffect,useState} from 'react';
import {useLanguage,T} from '../../../i18n.jsx';
import {getSubmissionArchivePage,getArchivedCopy} from '../../../api/dashboard.js';
import {ArchivedDocumentView} from './DocumentYearArchive.jsx';
import {journalArchiveGroups} from '../../../utils/journalArchive.js';
export default function JournalSubjectHistory({subject,unitNumber,outpostName,sectionId,current,user,status,onBack,onOpenCurrent,allOutposts=false,matchSubject=true,kind="journal"}){
 const {language}=useLanguage(),ru=language==='ru',copy=(a,b)=>ru?a:b;
 const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[opened,setOpened]=useState(null),[opening,setOpening]=useState(null);
 const scope=user?.role==='admin'?'admin':user?.role==='regional'?'unit':null;
 const locale=ru?'ru-RU':'ky-KG';
 const date=value=>new Date(value).toLocaleString(locale,{timeZone:'Asia/Bishkek'});
 useEffect(()=>{let active=true;const controller=new AbortController();
  (async()=>{try{let cursor,all=[];do{const page=await getSubmissionArchivePage(cursor,controller.signal,scope,Array.isArray(sectionId)?sectionId:[sectionId],{unitNumber:String(unitNumber)});all.push(...page.results);cursor=page.nextCursor;}while(cursor&&!controller.signal.aborted);
   if(active)setItems(all.filter(item=>(!matchSubject||item.periodId?.endsWith(`:subject:${subject.id}`))&&(allOutposts||(!outpostName?!item.outpostName:formatOutpostName(item.outpostName)===formatOutpostName(outpostName)))).sort((a,b)=>new Date(b.archivedAt)-new Date(a.archivedAt)||b.id-a.id));
  }catch(e){if(active)setError(copy('Не удалось загрузить архив.','Архив жүктөлгөн жок.'));}finally{if(active)setLoading(false);}})();return()=>{active=false;controller.abort();};
 },[subject.id,unitNumber,outpostName,sectionId,scope]);
 const open=async item=>{setOpening(item.id);setError('');try{setOpened(await getArchivedCopy(item.id,undefined,scope));}catch{setError(copy('Не удалось открыть документ.','Документ ачылган жок.'));}finally{setOpening(null);}};
 const latestCopy=current?items.find(item=>item.sourceSubmissionId===current.id):items[0];
 const older=items.filter(item=>item.id!==latestCopy?.id);
 if(opened)return <ArchivedDocumentView copy={opened} user={user} onBack={()=>setOpened(null)}/>;
 const groups=journalArchiveGroups(older);
 return <section className="module-panel journal-subject-history">
  <button type="button" className="module-back-button" onClick={onBack}>{kind==='journal'?copy('Назад к предметам','Предметтерге кайтуу'):copy('Назад к документам','Документтерге кайтуу')}</button>
  <h2><T>{subject.title}</T></h2><p>{unitNumber} · {outpostName||copy('Воинская часть','Аскер бөлүгү')}</p>
  <h3>{copy('Текущий документ','Учурдагы документ')}</h3>{status}
  {current?<button type="button" className="saved-table-card" onClick={()=>onOpenCurrent(current)}><strong>{current.documentTitle}</strong><span>{date(current.updatedAt||current.createdAt)}</span><span>{copy('Открыть текущий документ','Учурдагы документти ачуу')} →</span></button>:latestCopy?<button type="button" className="saved-table-card" onClick={()=>open(latestCopy)} disabled={opening===latestCopy.id}><strong>{latestCopy.documentTitle}</strong><span>{date(latestCopy.archivedAt)}</span></button>:!loading&&<p>{copy('Документ ещё не отправлен.','Документ жөнөтүлө элек.')}</p>}
  {loading&&<p role="status">{copy('Загрузка архива…','Архив жүктөлүүдө…')}</p>}{error&&<p role="alert">{error}</p>}
  <details className="journal-history-folder"><summary>📁 {copy('Архив — предыдущие документы','Архив — мурунку документтер')} ({older.length})</summary>
   {!loading&&!older.length&&<p>{copy('Предыдущих документов пока нет.','Мурунку документтер азырынча жок.')}</p>}
   {[...groups].map(([year,months])=><details key={year}><summary>📁 {year}</summary>{[...months].map(([month,weeks])=><details key={month}><summary>📁 {new Date(Date.UTC(+year,+month-1,15)).toLocaleString(locale,{month:'long',timeZone:'UTC'})}</summary>{[...weeks].map(([key,week])=><details key={key}><summary>📁 {copy('Неделя','Апта')}: {week.start.toLocaleDateString(locale,{timeZone:'UTC'})} – {week.end.toLocaleDateString(locale,{timeZone:'UTC'})}</summary>{week.documents.map(item=><button type="button" key={item.id} className="saved-table-card" disabled={opening===item.id} onClick={()=>open(item)}><strong>{item.documentTitle}</strong><span>{copy('Предыдущая версия','Мурунку нуска')} · {date(item.archivedAt)}</span></button>)}</details>)}</details>)}</details>)}
  </details>
 </section>;
}
