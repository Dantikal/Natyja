import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Explicit pointer targets also work where Safari's overlay scrollbar is not draggable.
export default function DragScrollbars(){
 const [bars,setBars]=useState([]);
 useEffect(()=>{
  let frame=0;const marked=new Set();
  const measure=()=>{
   frame=0;
   const next=[];
   for(const el of document.querySelectorAll('.dashboard-sidebar,.dashboard-content')){
    const style=getComputedStyle(el),rect=el.getBoundingClientRect();
    const scrollable=['auto','scroll'].includes(style.overflowY)&&el.scrollHeight>el.clientHeight+2&&rect.height>60&&rect.width>0;
    if(!scrollable){if(el.classList.contains('has-drag-scrollbar'))el.classList.remove('has-drag-scrollbar');continue;}
    if(!el.classList.contains('has-drag-scrollbar'))el.classList.add('has-drag-scrollbar');marked.add(el);
    const top=Math.max(0,rect.top)+8,bottom=Math.min(innerHeight,rect.bottom)-8,height=bottom-top;
    if(height<50)continue;
    const thumb=Math.min(height,Math.max(44,height*el.clientHeight/el.scrollHeight));
    next.push({el,key:el.classList.contains('dashboard-sidebar')?'menu':'content',top,left:rect.right-15,height,thumb,offset:(height-thumb)*el.scrollTop/(el.scrollHeight-el.clientHeight)});
   }
   setBars(next);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure)};
  const observer=new MutationObserver(schedule);observer.observe(document.getElementById('root'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  const resize=new ResizeObserver(schedule);resize.observe(document.documentElement);
  document.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
  const timer=setInterval(schedule,500);schedule();
  return()=>{observer.disconnect();resize.disconnect();clearInterval(timer);cancelAnimationFrame(frame);document.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);for(const el of marked)el.classList.remove('has-drag-scrollbar')};
 },[]);
 return createPortal(bars.map(bar=><ScrollTrack key={bar.key} bar={bar}/>),document.body);
}
function ScrollTrack({bar}){
 const [drag,setDrag]=useState(null);
 const setPosition=(y,start)=>{const max=bar.el.scrollHeight-bar.el.clientHeight;const travel=bar.height-bar.thumb;if(travel>0)bar.el.scrollTop=Math.max(0,Math.min(max,start.scroll+(y-start.y)*max/travel))};
 return <div className="glass-scroll-track" style={{top:bar.top,left:bar.left,height:bar.height}} onPointerDown={e=>{if(e.target!==e.currentTarget)return;const y=e.clientY-bar.top-bar.thumb/2;bar.el.scrollTop=y/(bar.height-bar.thumb)*(bar.el.scrollHeight-bar.el.clientHeight)}}>
  <div role="scrollbar" aria-label={bar.key==='menu'?'Прокрутка меню / Менюну жылдыруу':'Прокрутка страницы / Баракты жылдыруу'} aria-orientation="vertical" aria-valuemin={0} aria-valuemax={Math.max(0,bar.el.scrollHeight-bar.el.clientHeight)} aria-valuenow={Math.round(bar.el.scrollTop)} tabIndex={0} className={`glass-scroll-thumb${drag?' is-dragging':''}`} style={{height:bar.thumb,transform:`translateY(${bar.offset}px)`}}
   onPointerDown={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);setDrag({y:e.clientY,scroll:bar.el.scrollTop})}}
   onPointerMove={e=>{if(drag)setPosition(e.clientY,drag)}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);setDrag(null)}} onPointerCancel={()=>setDrag(null)} onLostPointerCapture={()=>setDrag(null)}
   onKeyDown={e=>{const delta={ArrowDown:40,ArrowUp:-40,PageDown:bar.el.clientHeight*.85,PageUp:-bar.el.clientHeight*.85}[e.key];if(delta!==undefined){e.preventDefault();bar.el.scrollTop+=delta}else if(e.key==='Home'||e.key==='End'){e.preventDefault();bar.el.scrollTop=e.key==='Home'?0:bar.el.scrollHeight}}}
  />
 </div>;
}

