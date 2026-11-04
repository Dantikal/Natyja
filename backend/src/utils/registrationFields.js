const fields=[['rankId','customRank','ranks'],['positionId','customPosition','positions'],['unitId','customUnit','military_units']];
async function registrationFields(body,connection){
 const values=[];
 for(const [idKey,textKey,table]of fields){
  const id=body[idKey],text=typeof body[textKey]==='string'?body[textKey].trim().replace(/\s+/g,' '):'';
  if(id&&text)throw Object.assign(new Error('Выберите значение из списка или введите вручную'),{status:400});
  if(text){if(text.length>100)throw Object.assign(new Error('Название должно быть не длиннее 100 символов'),{status:400});values.push(null,text);}
  else{if(!id||!Number.isInteger(Number(id))||Number(id)<=0)throw Object.assign(new Error('Укажите звание, должность и войсковую часть'),{status:400});const [[row]]=await connection.execute(`SELECT id FROM ${table} WHERE id=?`,[id]);if(!row)throw Object.assign(new Error('Выбранное значение не найдено'),{status:400});values.push(row.id,null);}
 }
 return values;
}
module.exports=registrationFields;
