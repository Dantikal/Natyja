import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {buildAnalysisPrintHtml,installAnalysisPrinting} from '../src/utils/printAnalysis.js';
function environment(html,run){
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 const dom=new JSDOM(html);globalThis.document=dom.window.document;globalThis.window=dom.window;
 try{run(dom.window);}finally{dom.window.close();globalThis.document=oldDocument;globalThis.window=oldWindow;}
}
test('isolated print contains one paper, live text and formatting, without editor controls or empty fields',()=>environment(`<nav>Menu</nav><section class="monthly-analysis-print-root"><div class="monthly-analysis-page" style="width:210mm;min-height:1123px"><h1>Header</h1><div class="document-rich-body" contenteditable="true" style="min-height:610px"><b>Formatted text</b></div><input value=""><textarea>old</textarea><div class="no-print">Upload tools</div><button>Delete</button><div class="analysis-signature-print">Duplicate signature</div><style>body{color:red}</style></div></section>`,()=>{
 const root=document.querySelector('section');root.querySelector('textarea').value='Live text';
 const output=new JSDOM(buildAnalysisPrintHtml(root));
 try{
  const doc=output.window.document;
  assert.equal(doc.querySelectorAll('.monthly-analysis-page').length,1);
  assert.equal(doc.querySelector('b').textContent,'Formatted text');
  assert.ok(doc.body.textContent.includes('Live text'));
  assert.equal(doc.querySelectorAll('input,textarea,button,nav,[contenteditable],.no-print,.analysis-signature-print').length,0);
  assert.equal(parseFloat(doc.querySelector('.monthly-analysis-page').style.minHeight),0);
  assert.equal(parseFloat(doc.querySelector('.document-rich-body').style.minHeight),0);
  assert.ok(!doc.body.textContent.includes('Upload tools'));
  assert.ok(!doc.body.textContent.includes('Duplicate signature'));
 }finally{output.window.close();}
}));
test('Ctrl+P and Cmd+P print the visible document; native printing has a cleanup path',()=>environment('<main><section class="monthly-analysis-print-root"></section></main>',win=>{
 const root=document.querySelector('section');let visible=true,calls=0;
 root.getClientRects=()=>visible?[{}]:[];
 const dispose=installAnalysisPrinting(target=>{assert.equal(target,root);calls++;});
 try{
  const key=new win.KeyboardEvent('keydown',{key:'p',ctrlKey:true,cancelable:true});win.dispatchEvent(key);assert.equal(calls,1);assert.ok(key.defaultPrevented);
  win.dispatchEvent(new win.KeyboardEvent('keydown',{key:'P',metaKey:true,cancelable:true}));assert.equal(calls,2);
  win.dispatchEvent(new win.Event('beforeprint'));assert.ok(document.body.classList.contains('analysis-document-print'));
  win.dispatchEvent(new win.Event('afterprint'));assert.ok(!document.querySelector('.analysis-print-path'));assert.ok(!document.body.classList.contains('analysis-document-print'));
  visible=false;win.dispatchEvent(new win.KeyboardEvent('keydown',{key:'p',ctrlKey:true,cancelable:true}));assert.equal(calls,2);
 }finally{dispose();}
}));
