export const ratingPeriods = [ ['week','Неделя','Жума'],['1','Месяц','Ай'],['3','Квартал','Квартал'],['6','6 месяцев','6 ай'],['12','Год','Жыл'] ];
export function ratingRange(key, now = new Date()) {
  const to = new Date(now.getTime()+6*3600000).toISOString().slice(0,10), start = new Date(to+'T00:00:00Z');
  if(key==='week') start.setUTCDate(start.getUTCDate()-6);
  else { const day=start.getUTCDate(); start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth()-Number(key)); const last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate(); start.setUTCDate(Math.min(day,last)); }
  return { from:start.toISOString().slice(0,10),to };
}
