import {resetPageScroll} from "../hooks/usePageScrollReset.js";
import {useEffect} from 'react';

// The visible back action defines the current module's parent, even when the
// user arrived through a notification rather than the preceding history entry.
export function findPageBack(root=document){
 const content=root.querySelector('#dashboard-main')||root.querySelector('.management-dashboard');
 if(!content)return null;
 return [...content.querySelectorAll('button,a')].find(el=>
  !el.disabled&&el.getClientRects().length>0&&
  /^(?:[←↶]\s*)?(?:Артка|Оюндар|Игры|Назад|Назад к .+|Чаттарга кайтуу|Заставаларга кайтуу)$/i.test((el.getAttribute('aria-label')||el.textContent).trim())
 )||null;
}
export default function HierarchicalBack(){
 useEffect(()=>{
  let snapshot=window.history.state,guarded=false,handling=false;
  const refresh=()=>{
   if(handling)return;
   const back=findPageBack();
   const inside=document.querySelector("#dashboard-main,.management-dashboard");
   if(inside&&!guarded){
    snapshot=window.history.state;
    window.history.pushState({...snapshot,munaraBackGuard:true},'');
    guarded=true;
   }else if(!inside)guarded=false;
   snapshot=window.history.state;
  };
  const overlay=()=>document.querySelector('dialog[open],.dashboard-sidebar.is-menu-open,[aria-modal="true"]');
  const pop=event=>{
   const back=findPageBack();
   const modal=overlay();
   if(!document.querySelector("#dashboard-main,.management-dashboard")&&!modal)return;
   event.stopImmediatePropagation();
   handling=true;
   window.history.pushState(snapshot||{},'');
   if(modal){
    if(modal.tagName==='DIALOG')modal.close();
    else if(modal.matches('.dashboard-sidebar'))modal.querySelector('.mobile-menu-toggle')?.click();
    else modal.querySelector('button')?.focus();
   }else if(back)back.click();
   else window.dispatchEvent(new Event("munara:navigate-home"));
   handling=false;
   queueMicrotask(refresh);
   requestAnimationFrame(resetPageScroll);
  };
  const escape=event=>{
   if(event.key!=='Escape'||event.defaultPrevented||overlay()||document.fullscreenElement||document.querySelector('.word-preview--fullscreen'))return;
   const back=findPageBack();if(!back)return;
   event.preventDefault();back.click();requestAnimationFrame(resetPageScroll);
  };
  const observer=new MutationObserver(refresh);
  observer.observe(document.getElementById('root'),{childList:true,subtree:true});
  refresh();
  window.addEventListener('popstate',pop,true);
  window.addEventListener('keydown',escape);
  return()=>{observer.disconnect();window.removeEventListener('popstate',pop,true);window.removeEventListener('keydown',escape);};
 },[]);
 return null;
}
