const {test}=require('node:test'),assert=require('node:assert/strict');
let claimed=true,calls=[],row={id:1,task_id:2,version_id:3};
require.cache[require.resolve('./src/config/db')]={exports:{execute:async(sql,params)=>{calls.push({sql,params});if(sql.startsWith('SELECT'))return [[row]];if(sql.includes("SET state='running'"))return [{affectedRows:claimed?1:0}];return [{affectedRows:1}];}}};
const worker=require('./src/services/reportAssessment');
test('background worker writes only provisional assessment, never official points or task status',async()=>{
 let evaluated=0;worker.evaluate=async()=>{evaluated++;return {state:'ready',decision:'accept',points:7,analysis:{summary:'Test'}};};
 await worker.tick();assert.equal(evaluated,1);assert(calls.some(call=>call.sql.includes('points=?')&&call.params[2]===7));
 assert(calls.every(call=>!/^UPDATE (tasks|report_versions)\b/.test(call.sql)));assert(!calls.some(call=>call.sql.includes('awarded_points')));
 calls=[];claimed=false;await worker.tick();assert.equal(evaluated,1);assert(!calls.some(call=>call.sql.includes('analysis=?')));
});
