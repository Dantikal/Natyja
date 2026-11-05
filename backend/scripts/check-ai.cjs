require('dotenv').config();
const runtime=require('../src/config/ollama');
(async()=>{
  const response=await fetch(runtime.origin+'/api/tags',{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Ollama is unavailable');
  const {models=[]}=await response.json();
  for(const name of new Set([runtime.model,runtime.supportModel])){
    if(!models.some(item=>item.name===name||item.model===name))throw new Error('Missing model: '+name);
  }
  const start=Date.now();await runtime.warmup();
  const result=await require('../src/services/supportAssistant').answer({message:'Ответь одним словом: готово.',history:[],sources:[],lang:'ru'});
  console.log(JSON.stringify({ready:true,model:runtime.supportModel,totalSeconds:(Date.now()-start)/1000,testAnswer:result.answer}));
})().catch(error=>{console.error('AI check failed:',error.message);process.exitCode=1;});
