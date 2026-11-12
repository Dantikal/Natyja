// Keep a bounded, shared preview cache. Pending requests are coalesced too.
const cache=new Map();
export function loadWordPreview(url) {
 if(cache.has(url)){const result=cache.get(url);cache.delete(url);cache.set(url,result);return result;}
 const task=(async()=>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);
  try {
   const [response,renderer,fonts]=await Promise.all([fetch(url,{signal:controller.signal}),import('docx-preview'),import('./wordPreviewFonts.js')]);
   if(!response.ok)throw Error('download');
   const data=await fonts.prepareWordPreview(await response.blob());
   // Let the loading indicator paint before the synchronous document layout.
   await new Promise(resolve=>setTimeout(resolve,0));
   const content=document.createElement('div');
   await renderer.renderAsync(data,content,content,{inWrapper:true,ignoreWidth:false,ignoreHeight:false,ignoreFonts:false,breakPages:true,ignoreLastRenderedPageBreak:false,renderHeaders:true,renderFooters:true,renderFootnotes:true,renderEndnotes:true,renderAltChunks:false,useBase64URL:true});
   return content;
  }finally{clearTimeout(timer);}
 })();
 cache.set(url,task);while(cache.size>3)cache.delete(cache.keys().next().value);
 task.catch(()=>{if(cache.get(url)===task)cache.delete(url);});return task;
}
