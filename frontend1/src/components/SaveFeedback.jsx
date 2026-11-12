import React,{useEffect,useRef,useState} from 'react';
import {useLanguage} from '../i18n.jsx';
export default function SaveFeedback(){
 const [message,setMessage]=useState(null),timer=useRef(null);const {language}=useLanguage();
 useEffect(()=>{const receive=e=>{clearTimeout(timer.current);setMessage({...e.detail,id:Date.now()});timer.current=setTimeout(()=>setMessage(null),e.detail.ok?3500:6000);};window.addEventListener('munara:save-feedback',receive);return()=>{window.removeEventListener('munara:save-feedback',receive);clearTimeout(timer.current);};},[]);
 if(!message)return null;
 return <div key={message.id} className={`document-save-feedback no-print${message.ok?'':' is-error'}`} role={message.ok?'status':'alert'}><span aria-hidden="true">{message.ok?'✓':'!'}</span>{message.ok?(language==='ru'?'Изменения сохранены':'Өзгөртүүлөр сакталды'):(language==='ru'?'Не удалось сохранить изменения. Повторите попытку.':'Өзгөртүүлөрдү сактоо мүмкүн болгон жок. Кайра аракет кылыңыз.')}</div>;
}
