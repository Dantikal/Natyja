import React,{useEffect} from 'react';
import {useLanguage} from '../i18n.jsx';
export default function KeyboardNavigation(){
 const {language}=useLanguage();
 const content=()=>document.querySelector('#dashboard-main')?.focus();
 useEffect(()=>{
  const handle=event=>{
   if(!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||document.querySelector('dialog[open]'))return;
   if(event.code==='Digit1'){event.preventDefault();content();}
   if(event.code==='KeyM'){event.preventDefault();window.dispatchEvent(new Event('munara:keyboard-menu'));}
   if(event.code==='KeyH'){event.preventDefault();document.querySelector('.page-help-trigger')?.click();}
   if(event.code==='Comma'){event.preventDefault();document.querySelector('.site-settings-trigger')?.click();}
  };
  window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);
 },[]);
 return <button className="keyboard-skip" type="button" onClick={content}>{language==='ru'?'Перейти к содержимому (Alt+1)':'Мазмунга өтүү (Alt+1)'}</button>;
}
