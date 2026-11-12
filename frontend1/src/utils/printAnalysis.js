let printAncestors=[];
export function clearAnalysisPrint(){
 document.body.classList.remove('analysis-document-print');
 for(const node of printAncestors)node.classList.remove('analysis-print-path');
 printAncestors=[];
}
export function prepareAnalysisPrint(root){
 if(!root)return;
 clearAnalysisPrint();
 document.body.classList.add('analysis-document-print');
 for(let node=root.parentElement;node;node=node.parentElement){node.classList.add('analysis-print-path');printAncestors.push(node);}
}
export function buildAnalysisPrintHtml(root){
 const sources=[...root.querySelectorAll('.monthly-analysis-page')];
 const pages=sources.map(source=>{
  const page=source.cloneNode(true);
  // The standalone print frame does not inherit the editor's table styles.
  const originalTables=[...source.querySelectorAll('.document-rich-body table')];
  page.querySelectorAll('.document-rich-body table').forEach((table,index)=>{
   const original=originalTables[index];
   const container=original?.closest('.document-rich-body');
   const containerWidth=container?.getBoundingClientRect().width||0;
   const tableWidth=original?.getBoundingClientRect().width||0;
   if(containerWidth&&tableWidth)table.style.width=`${Math.min(100,tableWidth/containerWidth*100)}%`;
   else if(!table.style.width&&!table.getAttribute('width'))table.style.width='100%';
   table.style.borderCollapse='collapse';
  });
  const sourceFields=[...source.querySelectorAll('input,textarea')];
  [...page.querySelectorAll('input,textarea')].forEach((field,index)=>{
   const original=sourceFields[index],value=original?.value||'';
   if(!value.trim()){field.remove();return;}
   const text=document.createElement('div');text.textContent=value;text.style.cssText=field.style.cssText;
   Object.assign(text.style,{height:'auto',minHeight:'0',maxHeight:'none',border:'0',boxShadow:'none',outline:'none',background:'transparent',whiteSpace:'pre-wrap',overflow:'visible'});
   field.replaceWith(text);
  });
  page.querySelectorAll('.no-print,.document-tools,.analysis-signature-print,button,script,style').forEach(node=>node.remove());
  page.querySelectorAll('[contenteditable]').forEach(node=>{node.removeAttribute('contenteditable');node.removeAttribute('data-placeholder');Object.assign(node.style,{height:'auto',minHeight:'0',maxHeight:'none',boxShadow:'none',border:'0',outline:'none',background:'transparent',overflow:'visible'});});
  Object.assign(page.style,{width:'100%',height:'auto',minHeight:'0',maxHeight:'none',padding:'0',margin:'0',border:'0',borderRadius:'0',boxShadow:'none',zoom:'1',transform:'none',background:'white',color:'black',overflow:'visible',boxSizing:'border-box'});
  return page.outerHTML;
 });
 const landscape=sources[0]?.style.width==='297mm';
 return `<!doctype html><html><head><meta charset="utf-8"><title>КҮЖҮРМӨН АСКЕР · Документ</title><style>
 @page{size:A4 ${landscape?'landscape':'portrait'};margin:15mm}
 html,body{margin:0;padding:0;background:white;color:black;font:12pt "Times New Roman",serif;height:auto;overflow:visible}
 *,*::before,*::after{box-sizing:border-box;box-shadow:none!important;text-shadow:none!important;outline:none!important}
 .monthly-analysis-page{break-after:auto;page-break-after:auto}
 .monthly-analysis-page+.monthly-analysis-page{break-before:page;page-break-before:always}
 .document-rich-body{min-height:0!important;height:auto!important;overflow:visible!important;overflow-wrap:break-word}
 .monthly-analysis-page__extra-text-print{display:none}
 .monthly-analysis-signature-block:empty{display:none}
 table{max-width:100%;border-collapse:collapse}td,th{padding:8px;border:1px solid #333;overflow-wrap:anywhere}img{max-width:100%;print-color-adjust:exact;-webkit-print-color-adjust:exact}
 </style></head><body>${pages.join('')}</body></html>`;
}
let activePrintFrame=null;
export function printAnalysisDocument(root){
 if(!root)return;
 activePrintFrame?.remove();
 const frame=document.createElement('iframe');activePrintFrame=frame;
 frame.title='Печать документа';frame.setAttribute('aria-hidden','true');
 Object.assign(frame.style,{position:'fixed',right:'0',bottom:'0',width:'0',height:'0',border:'0'});
 frame.onload=async()=>{
  const target=frame.contentWindow,doc=frame.contentDocument;
  if(!target||!doc)return;
  await doc.fonts?.ready;
  await Promise.all([...doc.images].map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.onload=resolve;image.onerror=resolve;})));
  target.addEventListener('afterprint',()=>{clearAnalysisPrint();setTimeout(()=>{frame.remove();if(activePrintFrame===frame)activePrintFrame=null;},0);},{once:true});
  try{target.focus();target.print();}catch(error){frame.remove();clearAnalysisPrint();throw error;}
 };
 frame.srcdoc=buildAnalysisPrintHtml(root);
 document.body.append(frame);
}
export function installAnalysisPrinting(print=printAnalysisDocument){
 const current=()=>[...document.querySelectorAll('.monthly-analysis-print-root')].find(root=>root.getClientRects().length);
 const before=()=>{const root=current();if(root)prepareAnalysisPrint(root);};
 const keyboard=event=>{if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='p'){const root=current();if(root){event.preventDefault();print(root);}}};
 window.addEventListener('beforeprint',before);
 window.addEventListener('afterprint',clearAnalysisPrint);
 window.addEventListener('keydown',keyboard);
 return()=>{window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',clearAnalysisPrint);window.removeEventListener('keydown',keyboard);clearAnalysisPrint();};
}
