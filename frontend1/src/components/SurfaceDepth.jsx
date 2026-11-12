import {useEffect} from 'react';
const selector='.site-settings button,.dashboard-sidebar__nav button,.module-action-button,.module-back-button,.dashboard-print-button,.methodical-document-download,.rating-details-toggle';
export default function SurfaceDepth(){
 useEffect(()=>{
  let current=null,frame=0,x=0,y=0,bounds=null;const releases=new Map();
  const reset=()=>{if(current){const el=current;current=null;el.style.setProperty('--depth-x','0deg');el.style.setProperty('--depth-y','0deg');el.classList.add('is-depth-returning');clearTimeout(releases.get(el));releases.set(el,setTimeout(()=>{el.classList.remove('is-depth-hover','is-depth-returning');el.style.removeProperty('--depth-x');el.style.removeProperty('--depth-y');releases.delete(el)},450))}};
  const move=e=>{
   if(e.pointerType!=='mouse'||matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='off'){reset();return;}
   const target=e.target.closest(selector);
   if(target?.closest('.training-table,.word-file-preview,.word-ribbon,.chess-game,.tank-game,.tetris-game,.snake-game')){reset();return;}
   if(target!==current){reset();current=target;bounds=current?.getBoundingClientRect();if(current){clearTimeout(releases.get(current));releases.delete(current);current.classList.remove('is-depth-returning')}}
   if(!current)return;
   x=e.clientX;y=e.clientY;
   if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(!current)return;const rect=bounds||current.getBoundingClientRect();current.style.setProperty('--depth-x',`${(.5-(y-rect.top)/Math.max(1,rect.height))*7}deg`);current.style.setProperty('--depth-y',`${((x-rect.left)/Math.max(1,rect.width)-.5)*7}deg`);current.classList.add('is-depth-hover')});
  };
  document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',reset);document.addEventListener('scroll',reset,true);window.addEventListener('blur',reset);
  return()=>{cancelAnimationFrame(frame);reset();for(const [el,timer] of releases){clearTimeout(timer);el.classList.remove('is-depth-hover','is-depth-returning');el.style.removeProperty('--depth-x');el.style.removeProperty('--depth-y')}releases.clear();document.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',reset);document.removeEventListener('scroll',reset,true);window.removeEventListener('blur',reset)};
 },[]);return null;
}
