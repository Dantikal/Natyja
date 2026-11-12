import React,{useEffect,useState} from 'react';
import {useSelector} from 'react-redux';
import {useLanguage} from '../i18n.jsx';
import {getMemoLetterIndex} from '../api/dashboard.js';
import {playMessageSound} from '../utils/messageSound.js';
export default function MemoNotifications(){
 const user=useSelector(state=>state.auth.user),{language}=useLanguage(),[notice,setNotice]=useState(null);
 useEffect(()=>{setNotice(null);if(!['admin','regional'].includes(user?.role))return;let active=true,running=false,seen=null;const controller=new AbortController();
 const poll=async()=>{if(running)return;running=true;try{const items=await getMemoLetterIndex(controller.signal);if(!active)return;const incoming=items.filter(item=>item.senderId!==user.id && (user.role==='admin'||item.senderRole==='outpost'));const fresh=seen?incoming.filter(item=>!item.isRead&&seen.get(item.id)!==item.updatedAt):[];seen=new Map(incoming.map(item=>[item.id,item.updatedAt]));if(fresh.length){const newest=fresh.sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0];setNotice(newest);playMessageSound(`memo:${user.id}:${newest.id}:${newest.updatedAt}`);window.dispatchEvent(new Event('memo-letter-arrived'));}}catch{}finally{running=false;}};
 poll();const timer=setInterval(poll,7000);window.addEventListener('memo-letter-read',poll);return()=>{active=false;clearInterval(timer);controller.abort();window.removeEventListener('memo-letter-read',poll);};
 },[user?.id,user?.role]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(null),9000);return()=>clearTimeout(timer);},[notice]);
 if(!notice)return null;const ru=language==='ru';
 return <div className="chat-incoming-notice memo-incoming-notice" role="status"><button type="button" onClick={()=>{sessionStorage.setItem(`munara:open-memo:${user.id}`,String(notice.id));window.dispatchEvent(new Event('munara:open-memo'));setNotice(null);}}><strong>▤ {ru?'Новое письмо':'Жаңы кат'} · {notice.unitNumber}</strong><span>{notice.documentTitle}</span><small>{notice.outpostName||notice.senderName} · {ru?'Открыть документ':'Документти ачуу'}</small></button><button type="button" aria-label={ru?'Закрыть':'Жабуу'} onClick={()=>setNotice(null)}>✕</button></div>;
}
