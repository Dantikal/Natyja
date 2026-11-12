import React,{useEffect,useState} from 'react';
import {useLanguage} from '../../i18n.jsx';
import {api} from '../../api/client.js';
import JournalSubjectHistory from '../../components/dashboard/modules/JournalSubjectHistory.jsx';
const sections=['combat-training-personnel-journal','combat-training-command-journal'];
export default function DeletedJournalSubjects({user,onBack}){
 const {language}=useLanguage(),l=(ru,ky)=>language==='ru'?ru:ky;
 const [items,setItems]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[opened,setOpened]=useState(null),[busy,setBusy]=useState(null);
 const load=async()=>{setLoading(true);setError('');try{const {data}=await api.get('/dashboard/combat-training-journal-subjects/',{params:{deleted:1}});setItems(data);}catch{setError(l('Не удалось загрузить удалённые предметы.','Өчүрүлгөн предметтер жүктөлгөн жок.'));}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const action=async(subject,permanent)=>{
  if(permanent&&!window.confirm(l(`Окончательно удалить пустой предмет «${subject.title}»? Восстановить его будет нельзя.`,`Бош «${subject.title}» предметин биротоло өчүрөсүзбү? Калыбына келтирүү мүмкүн эмес.`)))return;
  setBusy(subject.id);setError('');try{if(permanent)await api.delete(`/dashboard/combat-training-journal-subjects/${subject.id}/`,{params:{permanent:1}});else await api.patch(`/dashboard/combat-training-journal-subjects/${subject.id}/`,{restore:true});await load();}catch(e){setError(e.response?.data?.[0]||e.response?.data?.detail||l('Действие не выполнено. Документы сохранены.','Аракет аткарылган жок. Документтер сакталды.'));}finally{setBusy(null);}
 };
 if(opened)return <JournalSubjectHistory subject={opened} unitNumber={opened.unitNumber} outpostName="" allOutposts sectionId={sections} user={user} onBack={()=>setOpened(null)}/>;
 return <section className="module-panel"><button className="module-back-button" type="button" onClick={onBack}>← {l('Назад в архив','Архивге кайтуу')}</button><h2>{l('Удалённые предметы','Өчүрүлгөн предметтер')}</h2>
  <p>{l('Документы сохраняются. Окончательно удалить можно только пустой предмет.','Документтер сакталат. Бош предметти гана биротоло өчүрүүгө болот.')}</p>
  {loading&&<p role="status">{l('Загрузка…','Жүктөлүүдө…')}</p>}{error&&<p role="alert">{error}</p>}
  {!loading&&!items.length&&<p>{l('Удалённых предметов пока нет.','Өчүрүлгөн предметтер азырынча жок.')}</p>}
  <div className="saved-table-list">{items.map(subject=><article className="saved-table-card" key={subject.id}><strong>{subject.title} · {subject.unitNumber}</strong><p>{l('Удалён: ','Өчүрүлгөн: ')}{subject.deleted_at?new Date(subject.deleted_at).toLocaleString(language==='ru'?'ru-RU':'ky-KG'):'—'} · {subject.deleted_by_name||'—'}</p>
   <p>{subject.hasDocuments?l('Документы сохранены','Документтер сакталды'):l('Предмет пустой','Предмет бош')}</p>
   <div className="module-actions"><button type="button" onClick={()=>setOpened(subject)}>{l('Открыть документы','Документтерди ачуу')}</button>
   {user?.is_superuser&&<><button type="button" disabled={busy===subject.id} onClick={()=>action(subject,false)}>{l('Восстановить предмет','Предметти калыбына келтирүү')}</button><button type="button" disabled={subject.hasDocuments||busy===subject.id} title={subject.hasDocuments?l('Удаление запрещено: есть документы','Документтер бар: өчүрүүгө болбойт'):''} onClick={()=>action(subject,true)}>{l('Удалить навсегда','Биротоло өчүрүү')}</button></>}
   </div></article>)}</div>
 </section>;
}
