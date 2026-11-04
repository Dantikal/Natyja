const {test}=require('node:test');
const assert=require('node:assert/strict');
const {periodRange}=require('./src/services/rating');
const {parseAssessment}=require('./src/services/ideaReview');
test('period boundaries use Bishkek day and clamp leap-year month ends',()=>{
  assert.deepEqual(periodRange('week',new Date('2026-11-02T19:00:00Z')),{from:'2026-10-28',to:'2026-11-03'});
  assert.deepEqual(periodRange('1',new Date('2024-03-31T10:00:00Z')),{from:'2024-02-29',to:'2024-03-31'});
  assert.deepEqual(periodRange('12',new Date('2024-02-29T10:00:00Z')),{from:'2023-02-28',to:'2024-02-29'});
  assert.throws(()=>periodRange('invalid'));
});
test('AI criteria are validated and priority is computed by the server, never by submitted instructions',()=>{
  const valid={criteria:{usefulness:25,feasibility:20,clarity:20,novelty:15},summary:'Нужно проверить эффект.',strengths:['Понятный результат'],concerns:['Нет бюджета'],nextSteps:['Пилот']};
  const result=parseAssessment('```json\n'+JSON.stringify(valid)+'\n```');assert.equal(result.score,80);assert.equal(result.priority,'high');
  assert.throws(()=>parseAssessment(JSON.stringify({...valid,criteria:{...valid.criteria,usefulness:100}})));
  assert.throws(()=>parseAssessment(JSON.stringify({...valid,criteria:{...valid.criteria,usefulness:'25'}})));
  assert.throws(()=>parseAssessment('Некорректный ответ'));
});
