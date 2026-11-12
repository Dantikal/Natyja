import {useLanguage as useCopyLanguage} from "../../../i18n.jsx";
import React from 'react';
export default function StudyNumberFooter({value,onChange,style,rows}) {
 const {t:copyT,language}=useCopyLanguage();

 const lines=value.split('\n').map(line=>/Чаз башчысы \(топ|Чаз башчысынын орун басары \(топ/.test(line)?'Окуу номери №':line);
 const indices=lines.map((line,i)=>/^(Окуу номери №)$/.test(line.trim())?i+2:-1).filter(i=>i>=0&&i<lines.length);
 if(indices.length!==2)return <textarea aria-label={copyT("Таблицанын жыйынтык бөлүгү")} className="module-table-footer" value={value} onChange={onChange} style={style} rows={rows}/>;
 const update=(start,end,text)=>onChange({target:{value:[...lines.slice(0,start),text,...lines.slice(end)].join('\n')}});
 let cursor=0;const parts=[];
 for(const [n,index] of indices.entries()){
 const start=cursor;const text=lines.slice(start,index).join('\n');
 parts.push(<textarea key={'text'+n} aria-label={`Жыйынтык бөлүгү ${n+1}`} className="module-table-footer" style={{...style,minHeight:0,height:'auto'}} rows={Math.max(2,text.split('\n').length)} value={text} onChange={e=>update(start,index,e.target.value)}/>);
 const old=/^(капитан\s+А\.А\. Асанов|лейтенант\s+Д\.А\. Сайфудинов)$/.test(lines[index].trim());
 const people=old?['']:lines[index].split(' | ');
 const savePeople=next=>update(index,index+1,next.join(' | '));
 parts.push(<div key={'signature'+n} className="study-signature-people">{people.map((person,personIndex)=>{const fields=person.split('\t');return <div className="study-signature-row" key={personIndex}>{['Окуу номери №','М: К-115'].map((hint,j)=><input key={j} className="commander-study-number" aria-label={`${hint} ${n+1}.${personIndex+1}`} placeholder={hint} value={fields[j]||''} onChange={e=>{const next=[fields[0]||'',fields[1]||''];next[j]=e.target.value.replace(/[\n\t|]/g,' ');savePeople(people.map((item,i)=>i===personIndex?next.join('\t'):item));}}/>)}{n===1&&people.length>1&&<button className="no-print" type="button" aria-label={language==='ru'?'Убрать человека':'Адамды алып салуу'} onClick={()=>savePeople(people.filter((_,i)=>i!==personIndex))}>×</button>}</div>;})}{n===1&&<button type="button" className="study-person-add no-print" onClick={()=>savePeople([...people,'\t'])}>{language==='ru'?'+ Добавить человека':'+ Адам кошуу'}</button>}</div>);
 cursor=index+1;
 }
 if(cursor<lines.length){const start=cursor;parts.push(<textarea key="tail" className="module-table-footer" style={style} value={lines.slice(start).join('\n')} onChange={e=>update(start,lines.length,e.target.value)}/>);}
 return <div className="study-number-footer-layout"><div>{parts}</div><aside className="study-number-privacy-notice no-print" role="note"><strong>{language==='ru'?'Используйте учебный номер':'Окуу номерин колдонуңуз'}</strong><p>{language==='ru'?'Не указывайте ФИО и воинское звание. Впишите только выданный вам учебный номер, например К-115.':'Аты-жөнүңүздү, аскердик наамыңызды жазбаңыз. Сизге берилген окуу номерин гана жазыңыз, мисалы К-115.'}</p></aside></div>;
}
