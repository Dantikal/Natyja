import {unlockMessageAudio,playMessageSound} from "../utils/messageSound.js";
import React,{useEffect,useRef,useState} from 'react';
import {useSelector} from 'react-redux';
import {useLanguage} from '../i18n.jsx';
import {getChatPartners} from '../api/dashboard.js';
export default function ChatNotifications(){
 useEffect(()=>{window.addEventListener('pointerdown',unlockMessageAudio);window.addEventListener('keydown',unlockMessageAudio);return()=>{window.removeEventListener('pointerdown',unlockMessageAudio);window.removeEventListener('keydown',unlockMessageAudio);};},[]);
 const user=useSelector(state=>state.auth.user),{language}=useLanguage(),[notice,setNotice]=useState(null),seen=useRef(new Map());
 useEffect(()=>{seen.current=new Map();setNotice(null);if(!user?.id)return;let active=true,running=false,initialized=false;
  const check=async()=>{if(running)return;running=true;try{const partners=await getChatPartners();if(!active)return;let newest=null;for(const partner of partners){const previous=seen.current.get(partner.id);if(initialized&&partner.unreadChatCount>0&&partner.lastMessageAt&&previous!==partner.lastMessageAt&&!partner.lastMessageFromMe){if(!newest||Date.parse(partner.lastMessageAt)>Date.parse(newest.lastMessageAt))newest=partner;}seen.current.set(partner.id,partner.lastMessageAt);}initialized=true;if(newest){setNotice(newest);playMessageSound(`${user.id}:${newest.id}:${newest.lastMessageAt}`);}}catch{}finally{running=false;}};
  check();const timer=setInterval(check,5000);window.addEventListener('chat-messages-read',check);return()=>{active=false;clearInterval(timer);window.removeEventListener('chat-messages-read',check);};
 },[user?.id]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(null),7000);return()=>clearTimeout(timer);},[notice]);
 if(!notice)return null;
 const open=()=>{sessionStorage.setItem(`munara:open-chat:${user.id}`,String(notice.id));window.dispatchEvent(new Event('munara:open-chat'));setNotice(null);};
 return <div className="chat-incoming-notice" role="status"><button type="button" onClick={open}><strong>✉ {notice.full_name||notice.email}</strong><span>{notice.lastMessagePreview|| (language==='ru'?'Новое сообщение':'Жаңы билдирүү')}</span><small>{language==='ru'?'Открыть чат':'Чатты ачуу'} · {notice.unreadChatCount}</small></button><button type="button" aria-label={language==='ru'?'Закрыть уведомление':'Билдирмени жабуу'} onClick={()=>setNotice(null)}>✕</button></div>;
}
