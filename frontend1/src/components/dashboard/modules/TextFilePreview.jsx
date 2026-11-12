import React,{useEffect,useState} from 'react';
import {useLanguage} from '../../../i18n.jsx';
export default function TextFilePreview({url}){
 const {language}=useLanguage();const [text,setText]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{const c=new AbortController();setError(false);setText('');fetch(url,{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();const blob=await r.blob();if(blob.size>10*1024*1024)throw Error();setText(await blob.text())}).catch(()=>{if(!c.signal.aborted)setError(true)});return()=>c.abort()},[url]);
 return <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:20,maxHeight:'70vh',overflow:'auto'}}>{error?(language==='ru'?'Не удалось прочитать текстовый файл (максимум 10 МБ).':'Тексттик файлды окуу мүмкүн болгон жок (эң көп 10 МБ).'):text||(language==='ru'?'Загрузка…':'Жүктөлүүдө…')}</pre>;
}
