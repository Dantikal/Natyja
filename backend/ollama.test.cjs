const {test}=require('node:test');
const assert=require('node:assert/strict');
test('AI uses one configurable model, disables thinking and preserves report context and JSON schema',async()=>{
  const original=global.fetch;const calls=[];
  global.fetch=async(url,request)=>{calls.push({url,body:JSON.parse(request.body)});return{ok:true,status:200,json:async()=>({message:{content:'{"ok":true}'}}),arrayBuffer:async()=>new ArrayBuffer(0)};};
  try{
    const runtime=require('./src/config/ollama');
    await runtime.warmup();
    assert.equal(calls.length,new Set([runtime.model,runtime.supportModel]).size);
    const service=require('./src/services/supportAssistant');
    const schema={type:'object',properties:{ok:{type:'boolean'}},required:['ok']};
    await service.answer({message:'Test report',history:[],sources:[{title:'Report',text:'Report contents'}],lang:'ru',format:schema});
    const request=calls.at(-1).body;
    assert.equal(request.think,false);assert.equal(request.stream,false);assert.deepEqual(request.format,schema);
    assert.equal(request.model,runtime.supportModel);assert.equal(request.keep_alive,runtime.keepAlive);
    assert(request.options.num_ctx>=8192);assert(request.options.num_predict>=1200);
    assert(request.messages[0].content.includes('Report contents'));
    assert.equal(request.tools,undefined);
  }finally{global.fetch=original;}
});
