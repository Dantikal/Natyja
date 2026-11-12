import React, {useEffect,useState} from "react";
import {api} from "../../../api/client.js";
import WordFilePreview from "./WordFilePreview.jsx";

export default function LegacyWordPreview({document}) {
 const [url,setUrl]=useState(null),[error,setError]=useState("");
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let objectUrl;
  setError("");setUrl(null);
  const ext=(document.originalName||'').split('.').pop().toLowerCase();
  api.get(`/dashboard/methodical-subjects/${document.subject}/documents/${document.id}/${ext==='doc'?'preview':'marked'}/`,{responseType:'blob',signal:controller.signal,timeout:100000})
   .then(({data})=>{if(controller.signal.aborted)return;objectUrl=URL.createObjectURL(data);setUrl(objectUrl);})
   .catch(async err=>{if(controller.signal.aborted)return;let message='Не удалось открыть документ. Файл может быть повреждён.';
    try {const data=JSON.parse(await err.response.data.text());message=data.detail||message;}catch{/* Network error. */}
    if(!controller.signal.aborted)setError(message);
   });
  return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[document.id,document.subject,attempt]);
 if(error)return <div className="dashboard-error" role="alert"><p>{error}</p><button type="button" onClick={()=>setAttempt(a=>a+1)}>Повторить просмотр</button></div>;
 if(!url)return <p role="status" className="dashboard-state">Подготавливаем документ для просмотра…</p>;
 const extension=(document.originalName||'').split('.').pop().toLowerCase();
 return extension==='doc' ? <WordFilePreview url={url} title={document.title}/> : <iframe className="methodical-media methodical-media--pdf" style={{width:'100%',minHeight:'70vh',border:0}} src={url} title={document.title}/>;
}
