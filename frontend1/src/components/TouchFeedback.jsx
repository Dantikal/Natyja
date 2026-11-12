import { useEffect } from 'react';
export default function TouchFeedback(){
 useEffect(()=>{
  const timers=new Map();
  const onPointer=e=>{
   if(e.pointerType==='mouse')return;
   const button=e.target.closest('button,[role="button"],.rating-bars,.about-platform__emblem-wrap,.about-platform__function');
   if(!button||button.disabled)return;
   clearTimeout(timers.get(button));
   button.classList.remove('is-touch-feedback');
   requestAnimationFrame(()=>{
    if(!button.isConnected)return;
    button.classList.add('is-touch-feedback');
    timers.set(button,setTimeout(()=>{button.classList.remove('is-touch-feedback');timers.delete(button)},700));
   });
  };
  const cancelFeedback=()=>{for(const [button,timer] of timers){clearTimeout(timer);button.classList.remove('is-touch-feedback')}timers.clear()};
  document.addEventListener('pointermove',cancelFeedback,{passive:true});
  document.addEventListener('pointercancel',cancelFeedback,{passive:true});
  document.addEventListener('scroll',cancelFeedback,{passive:true,capture:true});
  document.addEventListener('pointerdown',onPointer,{passive:true});
  return()=>{document.removeEventListener('pointermove',cancelFeedback);document.removeEventListener('pointercancel',cancelFeedback);document.removeEventListener('scroll',cancelFeedback,true);document.removeEventListener('pointerdown',onPointer);for(const [button,timer] of timers){clearTimeout(timer);button.classList.remove('is-touch-feedback')}};
 },[]);
 return null;
}
