const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseAssessment,plain,evaluate}=require('./src/services/reportAssessment');
const report='Подготовлен шаблон отчёта. Проведена проверка на одном примере. Замечания внесены в чек-лист.';
function answer(scores){return JSON.stringify({canAssess:true,summary:'Документ соответствует требованиям.',criteria:Object.fromEntries(['completeness','compliance','clarity'].map((key,index)=>[key,{score:scores[index],reason:'Проверено по тексту',quote:report.slice(0,25)}])),improvements:['Уточнить результаты пилота']});}
test('uses fixed 3/5/7 rubric and rejects unsupported quotes instead of inventing points',()=>{
 for(const [scores,points] of [[[2,2,2],7],[[2,1,1],5],[[1,1,1],3],[[0,0,0],0]]){const value=parseAssessment(answer(scores),report);assert.equal(value.points,points);assert.equal(value.decision,points?'accept':'revise');}
 const bad=JSON.parse(answer([2,2,2]));bad.criteria.clarity.quote='В отчёте этой цитаты нет';assert.throws(()=>parseAssessment(JSON.stringify(bad),report),/EVIDENCE/);
 bad.canAssess=false;assert.equal(parseAssessment(JSON.stringify(bad),report).points,null);
 const contradictory=JSON.parse(answer([0,2,2]));contradictory.criteria.completeness.reason='План содержит все явные этапы задания.';assert.equal(parseAssessment(JSON.stringify(contradictory),report).points,null);
});
test('does not guess a grade from missing, oversized, or image-only content',async()=>{
 assert.equal((await evaluate({title:'Кратко',description:'',report_html:'<p>да</p>'})).points,null);
 const result=await evaluate({title:'Подготовить отчёт по пилоту',description:'Описать цель и итоги.',report_html:'<img src="image.png"><p>Результаты пилота изложены в изображении.</p>'});assert.equal(result.state,'needs_review');
 assert.equal(plain('<script>alert(1)</script><p>Текст &amp; отчёт</p>'),'Текст & отчёт');
});
