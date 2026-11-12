import React,{useEffect,useState} from 'react';
import {useLanguage} from '../i18n.jsx';
import {getSubmissionEditRequests} from '../api/dashboard.js';
export default function PendingEditRequestsBanner({onOpen}){
 const [count,setCount]=useState(0),{language}=useLanguage();
 useEffect(()=>{let active=true;
  getSubmissionEditRequests().then(items=>{if(active)setCount(items.filter(i=>i.status==='pending').length);}).catch(()=>{});
  const update=e=>setCount(e.detail);window.addEventListener('edit-requests:count',update);
  return()=>{active=false;window.removeEventListener('edit-requests:count',update);};
 },[]);
 if(!count)return null;
 return <button type="button" className="pending-request-banner" onClick={onOpen}><span className="pending-request-banner__count">{count}</span><span><strong>{language==='ru'?'Запросы ожидают вашего решения':'Сурамдар чечимиңизди күтүп жатат'}</strong><small>{language==='ru'?'Проверьте разрешения на редактирование документов':'Документтерди оңдоого уруксат сурамдарын караңыз'}</small></span><b aria-hidden="true">→</b></button>;
}
