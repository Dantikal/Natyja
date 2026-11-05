function integer(name, fallback, minimum, maximum) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error('Invalid ' + name);
  return value;
}
const model = process.env.ASSISTANT_MODEL || 'qwen3:4b-instruct';
const supportModel = process.env.SUPPORT_MODEL || model;
const origin = (process.env.OLLAMA_ORIGIN || 'http://127.0.0.1:11434').replace(/\/$/,'');
const keepAlive = process.env.OLLAMA_KEEP_ALIVE || '30m';
const context = integer('AI_CONTEXT_TOKENS',8192,8192,32768);
const timeout = integer('ASSISTANT_TIMEOUT_MS',180000,10000,600000);
function options(structured = false) {
  return {num_ctx:context,num_predict:integer(structured?'AI_STRUCTURED_TOKENS':'AI_CHAT_TOKENS',structured?1200:600,256,4096)};
}
async function warmup() {
  for (const name of new Set([model,supportModel])) {
    const response = await fetch(origin+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(timeout),body:JSON.stringify({model:name,messages:[],stream:false,think:false,keep_alive:keepAlive,options:options()})});
    if (!response.ok) throw new Error('AI_WARMUP_FAILED_' + response.status);
    await response.arrayBuffer();
  }
}
module.exports={model,supportModel,origin,keepAlive,timeout,options,warmup};
