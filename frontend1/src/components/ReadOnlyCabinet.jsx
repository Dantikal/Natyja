import React,{useEffect} from 'react';
// The server also rejects every mutation carrying the observation header.
export default function ReadOnlyCabinet({children}) {
 useEffect(()=>{
  const mutation=/созда|сохранить|сактоо|измен|редакт|удал|отправить|добав|загруз|прикреп|подпис|принять|отклон|одобр|түзүү|сактоо|өзгөрт|өчүр|жөнөт|кошуу|жүктөө|тирке|кабыл|бекит/i;
  const update=()=>{
   document.querySelectorAll('.dashboard-content button,[role="dialog"] button').forEach(button=>{
    if((button.type==='submit'||mutation.test([button.textContent,button.title,button.getAttribute('aria-label')].join(' ')))&&!/скач|жүктөп алуу/i.test(button.textContent)) {if(!button.disabled){button.disabled=true;button.dataset.observerDisabled='1';}}
   });
   document.querySelectorAll('.dashboard-content textarea,.dashboard-content input[type="file"],[role="dialog"] textarea,[role="dialog"] input[type="file"]').forEach(node=>{if(!node.disabled){node.disabled=true;node.dataset.observerDisabled='1';}});
   document.querySelectorAll('.dashboard-content [contenteditable="true"],[role="dialog"] [contenteditable="true"]').forEach(node=>{node.contentEditable='false';});
  };
  const block=event=>event.preventDefault();
  document.addEventListener('submit',block,true);
  const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','contenteditable']});update();
  return()=>{observer.disconnect();document.removeEventListener('submit',block,true);document.querySelectorAll('[data-observer-disabled]').forEach(node=>{node.disabled=false;delete node.dataset.observerDisabled;});};
 },[]);
 return <>{children}</>;
}
