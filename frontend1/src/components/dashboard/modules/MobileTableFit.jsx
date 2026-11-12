import React,{useLayoutEffect,useRef,useState} from 'react';
import {useLanguage} from '../../../i18n.jsx';
export default function MobileTableFit({children}){
 const host=useRef(null),[actual,setActual]=useState(false),{language}=useLanguage();
 useLayoutEffect(()=>{
  const node=host.current,table=node.querySelector('table');if(!table)return;
  const fit=()=>{table.style.zoom='1';if(window.innerWidth<=1100&&!actual){const width=table.scrollWidth;table.style.zoom=String(Math.min(1,node.clientWidth/width));}};
  fit();const observer=new ResizeObserver(fit);observer.observe(node);window.addEventListener('resize',fit);
  return()=>{observer.disconnect();window.removeEventListener('resize',fit);table.style.zoom='';};
 },[actual,children]);
 return <div className="mobile-table-fit" ref={host}><button className="mobile-table-fit__toggle no-print" type="button" onClick={()=>setActual(v=>!v)}>{actual?(language==='ru'?'Вместить всю таблицу':'Таблицаны толук көрсөтүү'):(language==='ru'?'Увеличить до 100%':'100% чейин чоңойтуу')}</button>{children}</div>;
}
