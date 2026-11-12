export function journalArchiveGroups(items){
 const groups=new Map();
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bishkek',year:'numeric',month:'2-digit',day:'2-digit'});
 for(const item of [...items].sort((a,b)=>new Date(b.archivedAt)-new Date(a.archivedAt)||b.id-a.id)){
  const stamp=new Date(item.archivedAt);if(!Number.isFinite(+stamp))continue;
  const p=Object.fromEntries(parts.formatToParts(stamp).map(p=>[p.type,p.value]));
  const day=new Date(Date.UTC(+p.year,+p.month-1,+p.day));
  const monday=new Date(+day-((day.getUTCDay()+6)%7)*86400000);
  const end=new Date(+monday+6*86400000);
  const year=p.year,month=p.month,week=monday.toISOString().slice(0,10);
  if(!groups.has(year))groups.set(year,new Map());
  if(!groups.get(year).has(month))groups.get(year).set(month,new Map());
  const weeks=groups.get(year).get(month);
  if(!weeks.has(week))weeks.set(week,{start:monday,end,documents:[]});
  weeks.get(week).documents.push(item);
 }
 return groups;
}
