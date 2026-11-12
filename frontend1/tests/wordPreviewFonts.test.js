import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {prepareWordPreview} from '../src/utils/wordPreviewFonts.js';
const dom=new JSDOM('');globalThis.DOMParser=dom.window.DOMParser;globalThis.XMLSerializer=dom.window.XMLSerializer;
const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
test('Word preview inherits the original default style and preserves explicit fonts and source bytes',async()=>{
 const zip=new JSZip();zip.file('word/styles.xml',`<w:styles xmlns:w="${ns}"><w:style w:type="paragraph" w:default="1" w:styleId="normal"><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr></w:style></w:styles>`);
 const xml=`<w:document xmlns:w="${ns}"><w:body><w:p><w:r><w:rPr><w:rFonts w:eastAsia="Calibri"/></w:rPr><w:t>Кыргызча</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="heading"/></w:pPr><w:r><w:rPr><w:rFonts w:hAnsi="Arial"/></w:rPr><w:t>Русский</w:t></w:r></w:p></w:body></w:document>`;zip.file('word/document.xml',xml);
 const source=await zip.generateAsync({type:'arraybuffer'});const output=await JSZip.loadAsync(await prepareWordPreview(source));const doc=new DOMParser().parseFromString(await output.file('word/document.xml').async('string'),'application/xml');
 assert.deepEqual([...doc.getElementsByTagNameNS(ns,'pStyle')].map(n=>n.getAttributeNS(ns,'val')),['normal','heading']);
 const fonts=[...doc.getElementsByTagNameNS(ns,'rFonts')];assert.equal(fonts[0].hasAttributeNS(ns,'eastAsia'),false);assert.equal(fonts[1].getAttributeNS(ns,'ascii'),'Arial');
 assert.equal(await (await JSZip.loadAsync(source)).file('word/document.xml').async('string'),xml);
});
test('theme font and East Asian runs retain their intended font choices',async()=>{
 const zip=new JSZip();zip.file('word/document.xml',`<w:document xmlns:w="${ns}"><w:body><w:p><w:r><w:rPr><w:rFonts w:hAnsiTheme="majorHAnsi"/></w:rPr><w:t>Текст</w:t></w:r><w:r><w:rPr><w:rFonts w:eastAsia="MS Mincho"/></w:rPr><w:t>日本語</w:t></w:r></w:p></w:body></w:document>`);
 const output=await JSZip.loadAsync(await prepareWordPreview(await zip.generateAsync({type:'arraybuffer'})));const doc=new DOMParser().parseFromString(await output.file('word/document.xml').async('string'),'application/xml');const fonts=doc.getElementsByTagNameNS(ns,'rFonts');assert.equal(fonts[0].getAttributeNS(ns,'asciiTheme'),'majorHAnsi');assert.equal(fonts[1].getAttributeNS(ns,'eastAsia'),'MS Mincho');
});
