import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useLang} from '../context/LanguageContext';
export default function RatingList({soldiers}){
 const {t,tr}=useLang();const [open,setOpen]=useState(null);
 if(!soldiers.length)return <div className="empty-state">{t('noData')}</div>;
 return <div className="rating-list">{soldiers.map((s,index)=><article className="rating-person" key={s.id}><button className="rating-person-trigger" aria-expanded={open===s.id} aria-controls={`rating-details-${s.id}`} onClick={()=>setOpen(open===s.id?null:s.id)}><span className="rating-place">{index+1}</span><span className="rating-avatar">{s.photo_file?<img src={`/uploads/${s.photo_file}`} alt=""/>:s.full_name?.trim()[0]}</span><span className="rating-identity"><strong>{s.full_name}</strong><small>{s.rank_name||'—'}</small></span><span className="rating-score"><b>{s.task_rating??'—'}</b><small>{t('pointsShort')}</small></span><span className="rating-chevron" aria-hidden="true">{open===s.id?'−':'+'}</span></button>
 {open===s.id&&<div id={`rating-details-${s.id}`} className="rating-person-details"><dl>{[[t('colPosition'),s.position_name||'—'],[t('colUnit'),s.military_unit_name||'—'],[t('colService'),s.years_of_service||0],[t('colReprimands'),s.reprimands||0],[tr('Начислено'),`+${s.earned_points||0}`],[tr('За идеи'),`+${s.idea_points||0}`],[tr('Удержано'),`−${s.penalty_points||0}`],[t('completedTasks'),s.completed_tasks||0]].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>{s.characteristic&&<p>{s.characteristic}</p>}<Link className="btn-secondary" to={`/soldier/${s.id}`}>{tr('Открыть личную карточку')}</Link></div>}
 </article>)}</div>;
}
