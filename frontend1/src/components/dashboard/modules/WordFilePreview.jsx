import {useSelector} from "react-redux";
import {createPortal} from "react-dom";
import {loadWordPreview} from '../../../utils/wordPreviewCache.js';
import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useLanguage} from '../../../i18n.jsx';
export default function WordFilePreview({url,title}) {
 const viewer=useSelector(state=>state.auth.user);
 const mark=`КҮЖҮРМӨН АСКЕР · ${viewer?.full_name||viewer?.email||''} · ID ${viewer?.id||''} · ${new Date().toLocaleDateString()}`;
 const anchor=useRef(null);
 const [portalRoot]=useState(()=>document.createElement("div"));
 const host=useRef(null),root=useRef(null),[state,setState]=useState('loading'),[attempt,setAttempt]=useState(0);
 const [zoom,setZoom]=useState(100),[fit,setFit]=useState("page"),[full,setFull]=useState(false),[pages,setPages]=useState(0),[page,setPage]=useState(1);
 const {language}=useLanguage();const ru=language==='ru';
 useLayoutEffect(()=>{const parent=full?document.body:anchor.current;if(parent)parent.appendChild(portalRoot);},[full,portalRoot]);
 useEffect(()=>()=>portalRoot.remove(),[portalRoot]);
 useEffect(()=>{
  let active=true;
  const shadow=host.current.shadowRoot||host.current.attachShadow({mode:'open'});shadow.replaceChildren();setState('loading');setPage(1);setPages(0);
  const content=document.createElement('div');shadow.append(content);
  (async()=>{try{
   const template=await loadWordPreview(url);if(!active)return;
   content.replaceWith(template.cloneNode(true));
   const style=document.createElement('style');style.textContent=':host{display:block;color:#111;font:12pt "Times New Roman",serif}.docx-wrapper{background:#e1e5e9!important;padding:24px!important;align-items:start!important;align-content:start!important;gap:24px!important}section.docx{content-visibility:auto;contain-intrinsic-size:auto 1123px;flex-shrink:0;align-self:start!important;color:#111;background:white;box-shadow:0 2px 10px #0003;margin:0!important;outline:1px solid #c3c7cc} @media print{.docx-wrapper{zoom:1!important;display:block!important;width:auto!important;padding:0!important;background:white!important;gap:0!important}section.docx{content-visibility:visible;box-shadow:none;outline:0;margin:0!important;break-after:page}}';shadow.append(style);
   const watermarkStyle=document.createElement('style');watermarkStyle.textContent='section.docx{position:relative}.view-watermark{position:absolute;inset:0;pointer-events:none;z-index:20;display:flex;flex-direction:column;justify-content:space-around;overflow:hidden}.view-watermark span{display:block;text-align:center;transform:rotate(-25deg);font:11px Arial,sans-serif;color:rgba(40,65,50,.18);white-space:nowrap}';shadow.append(watermarkStyle);
   for(const page of shadow.querySelectorAll('section.docx')){const overlay=document.createElement('div');overlay.className='view-watermark';overlay.setAttribute('aria-hidden','true');for(let i=0;i<5;i++){const text=document.createElement('span');text.textContent=mark;overlay.append(text)}page.append(overlay)}
   if(active){setPages(shadow.querySelectorAll('section.docx').length);setState('ready');host.current.scrollTop=0;}
  }catch{if(active)setState('error');}})();
  return()=>{active=false;};
 },[url,attempt]);
 useLayoutEffect(()=>{
  if(state!=='ready')return;
  const container=host.current,shadow=container.shadowRoot,wrapper=shadow.querySelector('.docx-wrapper');if(!wrapper)return;
  const apply=()=>{let scale=zoom/100;if(fit){const widths=[...shadow.querySelectorAll('section.docx')].map(e=>e.offsetWidth);const firstPage=shadow.querySelector("section.docx");const widthScale=(container.clientWidth-48)/Math.max(1,...widths);const heightScale=(container.clientHeight-48)/Math.max(1,firstPage?.offsetHeight||1123);scale=Math.min(1,Math.max(.2,fit==="page"?Math.min(widthScale,heightScale):widthScale));setZoom(Math.round(scale*100));}const sheets=[...shadow.querySelectorAll('section.docx')];
   const widest=Math.max(1,...sheets.map(e=>e.offsetWidth));
   const count=fit?1:Math.max(1,Math.min(sheets.length,Math.floor((container.clientWidth/scale-24)/(widest+24))));
   wrapper.style.zoom=String(scale);
   wrapper.style.display='grid';wrapper.style.gridTemplateColumns='repeat('+count+', max-content)';
   wrapper.style.justifyContent='center';wrapper.style.alignItems='start';wrapper.style.alignContent='start';wrapper.style.gridAutoFlow='row';
   wrapper.style.boxSizing='border-box';wrapper.style.width=Math.max(container.clientWidth/scale,widest+48)+'px';};
  apply();const observer=new ResizeObserver(apply);observer.observe(container);return()=>observer.disconnect();
 },[state,zoom,fit,full]);
 useEffect(()=>{
  const container=host.current;
  const wheel=event=>{if(!event.ctrlKey||state!=='ready'||event.deltaY===0)return;event.preventDefault();event.stopPropagation();setFit(false);setZoom(current=>Math.max(25,Math.min(200,current+(event.deltaY<0?5:-5))));};
  container.addEventListener('wheel',wheel,{passive:false});return()=>container.removeEventListener('wheel',wheel);
 },[state]);
 // Handle two-finger document zoom without changing one-finger scrolling.
 const zoomRef=useRef(zoom);zoomRef.current=zoom;
 useEffect(()=>{
  const container=host.current;if(!container||state!=='ready')return;
  let pinch=null,frame=0;
  const distance=touches=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
  const start=event=>{
   if(event.touches.length!==2)return;
   const rect=container.getBoundingClientRect();
   const x=(event.touches[0].clientX+event.touches[1].clientX)/2-rect.left;
   const y=(event.touches[0].clientY+event.touches[1].clientY)/2-rect.top;
   pinch={distance:distance(event.touches),zoom:zoomRef.current,x,y,left:container.scrollLeft,top:container.scrollTop};
  };
  const move=event=>{
   if(event.touches.length!==2||!pinch)return;
   event.preventDefault();
   const next=Math.max(25,Math.min(200,Math.round(pinch.zoom*distance(event.touches)/Math.max(1,pinch.distance))));
   setFit(false);setZoom(next);
   cancelAnimationFrame(frame);
   const current=pinch;
   frame=requestAnimationFrame(()=>{const ratio=next/current.zoom;container.scrollLeft=(current.left+current.x)*ratio-current.x;container.scrollTop=(current.top+current.y)*ratio-current.y});
  };
  const end=()=>{pinch=null};
  container.addEventListener('touchstart',start,{passive:true});
  container.addEventListener('touchmove',move,{passive:false});
  container.addEventListener('touchend',end,{passive:true});container.addEventListener('touchcancel',end,{passive:true});
  return()=>{cancelAnimationFrame(frame);container.removeEventListener('touchstart',start);container.removeEventListener('touchmove',move);container.removeEventListener('touchend',end);container.removeEventListener('touchcancel',end)};
 },[state]);
 useEffect(()=>{if(!full)return;const key=e=>{if(e.key==='Escape')setFull(false);};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[full]);
 const go=number=>{const next=Math.max(1,Math.min(pages,number));const target=host.current.shadowRoot?.querySelectorAll('section.docx')[next-1];if(target){host.current.scrollLeft+=target.getBoundingClientRect().left-host.current.getBoundingClientRect().left-20;host.current.scrollTop+=target.getBoundingClientRect().top-host.current.getBoundingClientRect().top-20;setPage(next);}};
 const changeZoom=value=>{setFit(false);setZoom(Math.max(25,Math.min(200,value)));};
 return <><div ref={anchor} />{createPortal(<div ref={root} className={`word-file-viewer${full?' is-expanded':''}`}>
  <div className="word-viewer-toolbar no-print" role="toolbar" aria-label={ru?'Просмотр Word':'Word көрүү'}>
   <div><button type="button" disabled={state!=='ready'||page<=1} onClick={()=>go(page-1)} aria-label={ru?'Предыдущая страница':'Мурунку барак'}>‹</button><label>{ru?'Страница':'Барак'} <input aria-label={ru?'Номер страницы':'Барактын номери'} type="number" min="1" max={pages||1} value={page} disabled={!pages} onChange={e=>go(Number(e.target.value)||1)}/><span>/ {pages}</span></label><button type="button" disabled={state!=='ready'||page>=pages} onClick={()=>go(page+1)} aria-label={ru?'Следующая страница':'Кийинки барак'}>›</button></div>
   <div><button type="button" disabled={zoom<=25||state!=='ready'} onClick={()=>changeZoom(zoom-10)} aria-label={ru?'Уменьшить':'Кичирейтүү'}>−</button><select aria-label={ru?'Масштаб':'Масштаб'} value={fit||zoom} onChange={e=>['page','width'].includes(e.target.value)?setFit(e.target.value):changeZoom(+e.target.value)}><option value="page">{ru?'Целая страница':'Барак толугу менен'}</option><option value="width">{ru?'По ширине':'Туурасына'}</option>{[...new Set([25,50,75,100,125,150,175,200,zoom])].sort((a,b)=>a-b).map(z=><option key={z} value={z}>{z}%</option>)}</select><button type="button" disabled={zoom>=200||state!=='ready'} onClick={()=>changeZoom(zoom+10)} aria-label={ru?'Увеличить':'Чоңойтуу'}>+</button><button type="button" onClick={()=>{setFit(false);setZoom(100);}}>100%</button></div>
   <button type="button" aria-pressed={full} onClick={()=>setFull(!full)}>{full?(ru?'✕ Закрыть полный экран':'✕ Толук экрандан чыгуу'):(ru?'⛶ Полный экран':'⛶ Толук экран')}</button>
  </div>
  {state==='loading'&&<p role="status">{ru?'Загрузка Word-документа…':'Word документи жүктөлүүдө…'}</p>}
  {state==='error'&&<div role="alert"><p>{ru?'Не удалось открыть предпросмотр. Оригинальный файл можно скачать кнопкой выше.':'Алдын ала көрүү ачылган жок. Түпнуска файлды жүктөп алсаңыз болот.'}</p><button type="button" onClick={()=>setAttempt(n=>n+1)}>{ru?'Повторить':'Кайра аракет кылуу'}</button></div>}
  <div ref={host} className="word-file-preview" aria-label={title} style={{visibility:state==='ready'?'visible':'hidden',height:state==='ready'?undefined:0}} onScroll={()=>{const sections=[...(host.current.shadowRoot?.querySelectorAll('section.docx')||[])],top=host.current.getBoundingClientRect().top;const index=sections.findIndex(section=>section.getBoundingClientRect().bottom>top+100);setPage(index<0?1:index+1);}}/>
 </div>,portalRoot)}</>;
}
