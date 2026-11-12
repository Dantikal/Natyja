import React,{useEffect,useState} from 'react';
import {useSelector} from 'react-redux';
import {useLanguage} from '../i18n.jsx';
import {getSubmissionEditRequests} from '../api/dashboard.js';
import {playMessageSound} from '../utils/messageSound.js';
export default function EditRequestNotifications(){
 const user=useSelector(s=>s.auth.user),{language}=useLanguage(),[notice,setNotice]=useState(null);
 useEffect(()=>{
  setNotice(null);if(user?.role!=='admin')return;
  let active=true,busy=false,seen=null;
  const poll=async()=>{if(busy)return;busy=true;try{
   const items=await getSubmissionEditRequests();if(!active)return;
   const pending=items.filter(i=>i.status==='pending');
   window.dispatchEvent(new CustomEvent('edit-requests:count',{detail:pending.length}));
   setNotice(current=>current&&!pending.some(i=>i.id===current.id)?null:current);
   const initial=seen===null;
   const fresh=seen?pending.filter(i=>seen.get(i.id)!==i.updatedAt):pending;
   seen=new Map(items.map(i=>[i.id,i.updatedAt]));
   if(fresh.length){const latest=fresh.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];setNotice(latest);if(!initial)playMessageSound(`edit-request:${user.id}:${latest.id}:${latest.updatedAt}`);}
  }catch{}finally{busy=false;}};
  poll();const timer=setInterval(poll,5000);window.addEventListener('edit-requests:changed',poll);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('edit-requests:changed',poll);};
 },[user?.id,user?.role]);

 if(!notice)return null;
 return <div className="chat-incoming-notice memo-incoming-notice" role="status"><button type="button" onClick={()=>{sessionStorage.setItem('munara:open-edit-request',String(notice.id));window.dispatchEvent(new Event('munara:open-edit-requests'));setNotice(null);}}><strong>{language==='ru'?'Запрос на редактирование':'Оңдоого уруксат сурамы'}</strong><span>{notice.submission.documentTitle}</span><small>{notice.requesterName} · {notice.requesterUnitNumber||notice.submission.unitNumber} · {notice.requesterOutpostName||notice.submission.outpostName}</small></button><button type="button" aria-label={language==='ru'?'Закрыть':'Жабуу'} onClick={()=>setNotice(null)}>✕</button></div>;
}
