import test from 'node:test';
import assert from 'node:assert/strict';
import {translate} from '../src/translations.js';
test('plan and document interface labels switch both languages',()=>{
 for(const [ky,ru] of [['Иш кагаздар','Документы'],['Башталыш убактысы','Время начала'],['Аяктоо убактысы','Время окончания'],['Аткарылган иш-чаралары','Выполняемые мероприятия'],['Даярдалган документтер','Подготовленные документы'],['Акыркы аракеттер','Последние действия'],['Маалымат киргизиңиз','Введите данные']]){
 assert.equal(translate(ky,'ru'),ru);assert.equal(translate(translate(ru,'ky'),'ru'),ru);
 }
});


test('visually discovered dynamic labels translate without changing proper names',()=>{
 for(const [ky,ru] of [
  ['Аткарылган эмес','Не выполнено'],
  ['Азыр жаңылоо керек','Требуется обновление'],
  ['Маалымат кошуу','Добавить информацию'],
  ['2026 ж Архиви','Архив за 2026 год'],
  ['КЖжАККДБ Аскер бөлүгү','КЖжАККДБ воинская часть'],
  ['Ак-Чечек чек ара заставасы','Ак-Чечек — пограничная застава'],
  ['бүтүндөй системанын аскер бөлүгү үчүн уруксат документтер','Документы всех воинских частей'],
 ]) assert.equal(translate(ky,'ru'),ru);
 assert.equal(translate('КҮЖҮРМӨН АСКЕР','ru'),'КҮЖҮРМӨН АСКЕР');
});
