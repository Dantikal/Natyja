import {useEffect,useLayoutEffect,useRef} from 'react';
let origin=null;
export function useSectionEntrance(view){
 const previous=useRef(view);
 const transitionUntil=useRef(0);
 useEffect(()=>{
  const capture=e=>{const button=e.target.closest('.dashboard-sidebar__nav button,.dashboard-home__quick-grid>button');if(button){const r=button.getBoundingClientRect();origin={x:r.right,y:r.top+r.height/2,time:Date.now(),sidebar:!!button.closest('.dashboard-sidebar')}}};
  document.addEventListener('click',capture,true);return()=>document.removeEventListener('click',capture,true);
 },[]);
 useEffect(()=>{
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');svg.classList.add('section-connector');
  const clipId='connector-clip-'+Math.random().toString(36).slice(2);
  const defs=document.createElementNS(ns,'defs'),clip=document.createElementNS(ns,'clipPath'),clipRect=document.createElementNS(ns,'rect');
  clip.id=clipId;clip.append(clipRect);defs.append(clip);svg.append(defs);
  const path=document.createElementNS(ns,'path');path.setAttribute('clip-path',`url(#${clipId})`);path.setAttribute('fill','none');path.setAttribute('stroke-width','1.25');svg.append(path);document.body.append(svg);
  let frame=0;
  const draw=()=>{
   frame=0;
   const button=document.querySelector('.dashboard-sidebar__nav button[aria-current="page"]');
   const panel=document.querySelector('.dashboard-content');const sidebar=document.querySelector('.dashboard-sidebar');
   if(!button||!panel||!sidebar){svg.style.display='none';return;}
   const b=button.getBoundingClientRect(),panelRect=panel.getBoundingClientRect(),m=sidebar.getBoundingClientRect();
   // Follow visible module surfaces, excluding toolbars and the tall scroll container.
   const surfaces=[...panel.querySelectorAll('.module-panel,.dashboard-home__section,.home-welcome,.module-metric-grid,.about-platform,.messenger-chat,.games-hub')].filter(el=>!el.closest('[hidden]')&&el.getClientRects().length);
   const rects=surfaces.map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
   const p=rects.length?{left:Math.min(...rects.map(r=>r.left)),top:Math.min(...rects.map(r=>r.top)),bottom:Math.max(...rects.map(r=>r.bottom))}:[...panel.children].filter(el=>el.getBoundingClientRect().height>60&&!el.matches('.page-help,.dashboard-print-toolbar,.document-tools-host')).at(-1)?.getBoundingClientRect()||panelRect;
   if(m.width===0||(!transitionUntil.current&&p.left<=m.right-4)){svg.style.display='none';return;}
   svg.style.display='block';svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
   const header=document.querySelector('.app-shell>.topbar')?.getBoundingClientRect();
   const visibleTop=Math.max(8,panelRect.top,m.top,header?.bottom||0);
   const visibleBottom=Math.min(innerHeight-8,panelRect.bottom,m.bottom);
   if(visibleBottom<=visibleTop){svg.style.display='none';return;}
   const min=visibleTop+4,max=visibleBottom-4;
   const y=Math.max(min,Math.min(max,b.top+b.height/2));
   const x=Math.min(m.right,b.right),end=p.left+1;
   const top=Math.max(visibleTop+3,Math.min(visibleBottom-3,p.top+10));
   const bottom=Math.max(top,Math.min(visibleBottom-3,p.bottom-10));
   clipRect.setAttribute('x',String(Math.min(x,end)-1));clipRect.setAttribute('y',String(visibleTop));
   clipRect.setAttribute('width',String(Math.max(1,Math.abs(end-x)+2)));clipRect.setAttribute('height',String(visibleBottom-visibleTop));
   path.setAttribute('stroke',document.documentElement.dataset.theme==='blue'?'#a7d1ff':document.documentElement.dataset.theme==='light'?'#427956':'#b9efcf');
   path.setAttribute('d',`M ${x} ${y} Q ${(x+end)/2} ${y} ${end} ${top} M ${x} ${y} Q ${(x+end)/2} ${y} ${end} ${bottom}`);
   if(performance.now()<transitionUntil.current)frame=requestAnimationFrame(draw);else transitionUntil.current=0;
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(draw)};
  document.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
  const observer=new MutationObserver(schedule);observer.observe(document.getElementById('root'),{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-current']});
  const resize=new ResizeObserver(schedule);const panel=document.querySelector('.dashboard-content');if(panel)resize.observe(panel);schedule();
  return()=>{resize.disconnect();cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);svg.remove()};
 },[view]);
 useLayoutEffect(()=>{
  if(previous.current===view)return;previous.current=view;
  if(!origin||Date.now()-origin.time>1000)return;
  const source=origin;origin=null;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='off')return;
  const content=document.querySelector('.dashboard-content');if(!content)return;
  const r=content.getBoundingClientRect();
  const y=Math.max(0,Math.min(r.height,source.y-r.top));
  content.classList.add('has-section-entrance');
  transitionUntil.current=performance.now()+720;
  // Reveal the panel from a narrow hinge at the pressed button's height.
  const animation=content.animate([
   {opacity:.2,transform:'scale(.06,.08)',transformOrigin:`0px ${y}px`},
   {opacity:1,transform:'scale(1)',transformOrigin:`0px ${y}px`}
  ],{duration:720,easing:'cubic-bezier(.22,.65,.25,1)'});
  const clean=()=>content.classList.remove('has-section-entrance');animation.onfinish=clean;animation.oncancel=clean;
  return()=>{animation.cancel();clean();};
 },[view]);
}
