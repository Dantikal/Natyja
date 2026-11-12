import JSZip from 'jszip';
// docx-preview uses the East Asian fallback even for Cyrillic runs. Preserve
// the document's Latin/Cyrillic font instead; only normalize the preview copy.
export async function prepareWordPreview(blob) {
 const zip=await JSZip.loadAsync(blob);
 const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 const styleFile=zip.file('word/styles.xml');
 const styles=styleFile?new DOMParser().parseFromString(await styleFile.async('string'),'application/xml'):null;
 const defaultParagraph=[...(styles?.getElementsByTagNameNS(ns,'style')||[])].find(style=>style.getAttributeNS(ns,'type')==='paragraph' && ['1','true'].includes(style.getAttributeNS(ns,'default')))?.getAttributeNS(ns,'styleId');
 for(const name of Object.keys(zip.files).filter(name=>/^word\/(document|styles|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(name))){
  const xml=new DOMParser().parseFromString(await zip.file(name).async('string'),'application/xml');
  if(defaultParagraph && name!=='word/styles.xml')for(const paragraph of xml.getElementsByTagNameNS(ns,'p')){
   let properties=[...paragraph.children].find(child=>child.localName==='pPr');
   if(!properties){properties=xml.createElementNS(ns,'w:pPr');paragraph.insertBefore(properties,paragraph.firstChild);}
   if(![...properties.children].some(child=>child.localName==='pStyle')){
    const style=xml.createElementNS(ns,'w:pStyle');style.setAttributeNS(ns,'w:val',defaultParagraph);properties.insertBefore(style,properties.firstChild);
   }
  }
  // Respect explicit section orientation in the viewing copy. Some Word files
  // declare landscape while keeping portrait-ordered dimensions (or vice versa).
  for(const size of xml.getElementsByTagNameNS(ns,'pgSz')){
   const width=Number(size.getAttributeNS(ns,'w')),height=Number(size.getAttributeNS(ns,'h'));
   const orientation=size.getAttributeNS(ns,'orient');
   if(width>0&&height>0&&((orientation==='landscape'&&width<height)||(orientation==='portrait'&&width>height))){
    size.setAttributeNS(ns,'w:w',String(height));size.setAttributeNS(ns,'w:h',String(width));
   }
  }
  for(const fonts of xml.getElementsByTagNameNS(ns,'rFonts')){
   const run=fonts.parentElement?.parentElement;
   if(run?.localName==='r' && /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(run.textContent))continue;
   const latin=fonts.getAttributeNS(ns,'hAnsi');
   if(latin)fonts.setAttributeNS(ns,'w:ascii',latin);
   const latinTheme=fonts.getAttributeNS(ns,'hAnsiTheme');
   if(!latin && !fonts.getAttributeNS(ns,'ascii') && latinTheme)fonts.setAttributeNS(ns,'w:asciiTheme',latinTheme);
   // When no explicit font is given, inherit the paragraph/theme font.
   fonts.removeAttributeNS(ns,'eastAsia');
  }
  zip.file(name,new XMLSerializer().serializeToString(xml));
 }
 return zip.generateAsync({type:'arraybuffer'});
}


