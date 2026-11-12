import React, { useEffect, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import {tableGrid,mergeCells,editTableStructure} from '../../../utils/editorTables.js';
import DOMPurify from 'dompurify';
import { useLanguage } from '../../../i18n.jsx';
const PREFIX = '<!--munara-rich-->';
const V2 = '<!--munara-rich-v2-->';
const clean = html => DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['video','audio','iframe','form','input','button'], FORBID_ATTR: ['id'] });
const escape = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n','<br>');
const defaults = { orientation:'portrait', margin:'normal' };
function decode(value) {
  if (value.startsWith(V2)) { try { const data=JSON.parse(value.slice(V2.length)); return {html:clean(data.html || ''),page:{orientation:data.page?.orientation==='landscape'?'landscape':'portrait',margin:['normal','narrow','wide'].includes(data.page?.margin)?data.page.margin:'normal'}}; } catch {} }
  return { html:value.startsWith(PREFIX)?clean(value.slice(PREFIX.length)):escape(value), page:defaults };
}
export function richTextToPlain(value){const node=document.createElement('div');node.innerHTML=decode(value).html;return node.textContent||'';}
export default function DocumentRichEditor({ value='', onChange, readOnly, placeholder,field='body',className='',style }) {
  const editorId=useId();
  const selectedCells=useRef([]),dragState=useRef(null);
  const [tablePickerOpen,setTablePickerOpen]=useState(false);
  const [gridHover,setGridHover]=useState({rows:1,cols:1});
  const clearCells=()=>{for(const cell of selectedCells.current)cell.classList.remove('editor-cell-selected');selectedCells.current=[];};

  const photoInput=useRef(null),selectedObject=useRef(null);
  const [objectSize,setObjectSize]=useState(null);
  const [active,setActive]=useState(field==='body');
  useEffect(()=>{const activate=event=>setActive(event.detail===editorId);document.addEventListener('munara:editor-focus',activate);return()=>document.removeEventListener('munara:editor-focus',activate);},[editorId]);
  const editor=useRef(null), selection=useRef(null), latest=useRef(value);
  const [tab,setTab]=useState('home'),[host,setHost]=useState(null);
  const [rows,setRows]=useState(3),[cols,setCols]=useState(3),[page,setPage]=useState(()=>decode(value).page);
  const [linkUrl,setLinkUrl]=useState('');
  const [find,setFind]=useState(''),[replacement,setReplacement]=useState(''),[notice,setNotice]=useState('');
  const {language}=useLanguage(); const l=(ru,ky)=>language==='ru'?ru:ky;
  useEffect(()=>{setHost(editor.current?.closest('.monthly-analysis-print-root')?.querySelector('.document-tools-host'));},[]);
  useEffect(()=>{if(editor.current && value!==latest.current){const data=decode(value);editor.current.innerHTML=data.html;setPage(data.page);latest.current=value;selection.current=null;}},[value]);
  useEffect(()=>{
    const paper=editor.current?.closest('.monthly-analysis-page'); if(!paper||field!=='body')return;
    const previous={width:paper.style.width,padding:paper.style.padding};
    paper.style.width=page.orientation==='landscape'?'297mm':'210mm';
    paper.style.padding={normal:'20mm',narrow:'10mm',wide:'28mm'}[page.margin];
    return ()=>Object.assign(paper.style,previous);
  },[page]);
  const remember=()=>{
    const root=editor.current,s=window.getSelection();
    if(!root||!s?.rangeCount)return;
    const range=s.getRangeAt(0);
    if(root.contains(range.startContainer)&&root.contains(range.endContainer)){
      // Focusing a select or a toolbar must not replace the document selection.
      if(document.activeElement?.closest?.('.document-tools')&&s.isCollapsed)return;
      selection.current=range.cloneRange();
    }
  };
  useEffect(()=>{
    const capture=()=>{
      const root=editor.current;
      if(root&&(document.activeElement===root||root.contains(document.activeElement)))remember();
    };
    document.addEventListener('selectionchange',capture);
    return()=>document.removeEventListener('selectionchange',capture);
  },[]);
  const restore=()=>{
    const root=editor.current;if(!root||readOnly)return null;
    const saved=selection.current?.cloneRange();
    root.focus({preventScroll:true});
    const s=window.getSelection();
    if(saved&&root.contains(saved.startContainer)&&root.contains(saved.endContainer)){
      s.removeAllRanges();s.addRange(saved);
    }
    return s;
  };
  const save=(nextPage=page)=>{const next=V2+JSON.stringify({html:clean(editor.current.innerHTML).replaceAll('editor-cell-selected',''),page:nextPage});latest.current=next;onChange({target:{value:next}});remember();};
  const command=(name,arg)=>{if(!restore())return;document.execCommand(name,false,arg);remember();save();};
  const chooseObject=node=>{selectedObject.current=node;setObjectSize(node?{width:Math.round(parseFloat(node.style.width)||node.offsetWidth),height:Math.round(parseFloat(node.style.height)||node.offsetHeight)}:null);};
  const resizeObject=(width,height)=>{const node=selectedObject.current;if(!node||!editor.current.contains(node))return;const size={width:Math.round(Math.max(20,Math.min(1200,width))),height:Math.round(Math.max(20,Math.min(1600,height)))};Object.assign(node.style,{width:`${size.width}px`,height:`${size.height}px`});setObjectSize(size);save();};
  const insertPhoto=async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>8*1024*1024){setNotice(l('Выберите фото PNG, JPG, WebP или GIF до 8 МБ.','8 МБга чейинки сүрөттү тандаңыз.'));return;}try{const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const image=new Image();image.src=url;await image.decode();const width=Math.min(400,image.naturalWidth),height=Math.round(width*image.naturalHeight/image.naturalWidth);command('insertHTML',`<img src="${url}" alt="Фото" style="width:${width}px;height:${height}px;max-width:100%;object-fit:contain"><p><br></p>`);}catch{setNotice(l('Не удалось открыть фото.','Сүрөт ачылган жок.'));}};
  const action=(text,fn,title=text)=><button type="button" title={title} aria-label={title} onMouseDown={e=>e.preventDefault()} onClick={fn}>{text}</button>;
  const tool=(text,name,arg,title=text)=>action(text,()=>command(name,arg),title);
  const cell=()=>{restore();let node=window.getSelection()?.anchorNode;return (node?.nodeType===1?node:node?.parentElement)?.closest('td,th');};
  const editTable=kind=>{
    const current=selectedCells.current.find(item=>editor.current.contains(item))||cell();if(!current||!editor.current.contains(current)){setNotice(l('Сначала поставьте курсор в ячейку таблицы.','Алгач курсорду таблицанын уячасына коюңуз.'));return;}
    if(kind==='merge'){if(!mergeCells(selectedCells.current)){setNotice('Выделите прямоугольную область: удерживайте Shift и нажмите последнюю ячейку.');return;}}
    else editTableStructure(current,kind);
    clearCells();
    selection.current=null;setNotice('');save();
  };
  const paragraphStyle=(property,value)=>{const s=restore();let node=s?.anchorNode;let block=(node?.nodeType===1?node:node?.parentElement)?.closest('p,div,li,h1,h2,h3,td');if(!block||block===editor.current){document.execCommand('formatBlock',false,'p');node=window.getSelection()?.anchorNode;block=(node?.nodeType===1?node:node?.parentElement)?.closest('p,div,li,h1,h2,h3,td');}if(block&&block!==editor.current)block.style[property]=value;save();};
  const replaceAll=()=>{
    if(!find)return;const walker=document.createTreeWalker(editor.current,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);let count=0;
    for(const node of nodes){const parts=node.nodeValue.split(find);count+=parts.length-1;if(parts.length>1)node.nodeValue=parts.join(replacement);}
    setNotice(l(`Заменено: ${count}`,`Алмаштырылды: ${count}`));selection.current=null;save();
  };
  const formatCells=(property,value)=>{const current=cell();const cells=selectedCells.current.length?selectedCells.current:current?[current]:[];for(const item of cells)item.style[property]=value;save();};
  const pointerDown=event=>{if(readOnly)return;const cell=event.target.closest('td,th');if(!cell||!editor.current.contains(cell))return;const rect=cell.getBoundingClientRect(),scale=rect.width/(cell.offsetWidth||rect.width);if(Math.abs(event.clientX-rect.right)<7){event.preventDefault();dragState.current={cell,start:event.clientX,width:cell.offsetWidth,scale};event.currentTarget.setPointerCapture(event.pointerId);return;}if(event.shiftKey){event.preventDefault();const first=selectedCells.current[0]||cell;if(first.closest('table')!==cell.closest('table'))return;const {grid,positions}=tableGrid(cell.closest('table')),a=positions.get(first),b=positions.get(cell);clearCells();const cells=new Set();for(let r=Math.min(a.r,b.r);r<=Math.max(a.r,b.r);r++)for(let c=Math.min(a.c,b.c);c<=Math.max(a.c,b.c);c++)cells.add(grid[r][c]);selectedCells.current=[...cells];for(const item of cells)item.classList.add('editor-cell-selected');}else{clearCells();selectedCells.current=[cell];}};
  const insertTable=(r,c)=>{setTablePickerOpen(false);command('insertHTML','<table style="width:100%;table-layout:fixed;border-collapse:collapse"><tbody>'+Array.from({length:r},()=>'<tr>'+Array.from({length:c},()=>'<td style="border:1px solid #333;padding:8px"><br></td>').join('')+'</tr>').join('')+'</tbody></table><p><br></p>')};
  const updatePage=(key,value)=>{const next={...page,[key]:value};setPage(next);save(next);};
  const group=(title,children)=><section className="word-tools-group"><div>{children}</div><small>{title}</small></section>;
  const ribbon=!readOnly&&active&&<div className="document-tools no-print" onPointerDownCapture={remember} onMouseDownCapture={remember}>
    <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={insertPhoto}/>
    {objectSize&&<div className="word-object-tools" role="toolbar" aria-label="Размер объекта">
      <label>Ширина<input aria-label="Ширина объекта" type="number" min="20" max="1200" value={objectSize.width} onChange={e=>resizeObject(+e.target.value,objectSize.height)}/></label>
      <label>Высота<input aria-label="Высота объекта" type="number" min="20" max="1600" value={objectSize.height} onChange={e=>resizeObject(objectSize.width,+e.target.value)}/></label>
      {action('−',()=>resizeObject(objectSize.width/1.1,objectSize.height/1.1),'Уменьшить объект')}{action('+',()=>resizeObject(objectSize.width*1.1,objectSize.height*1.1),'Увеличить объект')}
      {['left','center','right'].map((align,index)=><React.Fragment key={align}>{action(['Слева','По центру','Справа'][index],()=>{const node=selectedObject.current;if(node){Object.assign(node.style,{display:'block',marginLeft:align==='left'?'0':'auto',marginRight:align==='right'?'0':'auto'});save();}})}</React.Fragment>)}
      {action('Удалить объект',()=>{selectedObject.current?.remove();chooseObject(null);save();})}
    </div>}
    {<div className="word-ribbon word-ribbon--office">
      <div className="word-ribbon__tabs" role="tablist" aria-label={l('Разделы инструментов','Куралдар бөлүмдөрү')}>
        {[['home',l('Главная','Башкы')],['insert',l('Вставка','Кыстаруу')],['table',l('Таблица','Таблица')],['page',l('Макет страницы','Барак')]].map(([id,title])=><button type="button" role="tab" aria-selected={tab===id} key={id} onClick={()=>setTab(id)}>{title}</button>)}
      </div>
      <div className={`word-ribbon__body${tab==='page'?' word-ribbon__body--page':tab==='insert'?' word-ribbon__body--insert':''}`} role="tabpanel">
      {tab==='home'&&<>
        {group(l('Шрифт','Шрифт'),<>      <select aria-label={l('Шрифт','Шрифт')} defaultValue="Times New Roman" onChange={e=>command('fontName',e.target.value)}>{['Times New Roman','Arial','Calibri','Georgia','Verdana','Courier New'].map(font=><option key={font}>{font}</option>)}</select>
      <select aria-label={l('Размер шрифта','Шрифттин өлчөмү')} defaultValue="3" onChange={e=>command('fontSize',e.target.value)}>{[[1,8],[2,10],[3,12],[4,14],[5,18],[6,24],[7,36]].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select>
{tool('B','bold',null,l('Полужирный','Калың'))}{tool('I','italic',null,l('Курсив','Курсив'))}{tool('U','underline',null,l('Подчёркнутый','Асты сызылган'))}
          
          
          {tool('S̶','strikeThrough',null,l('Зачёркнутый','Сызылган'))}{tool('x₂','subscript')}{tool('x²','superscript')}
          <label>{l('Текст','Текст')}<input aria-label={l('Цвет текста','Тексттин түсү')} type="color" defaultValue="#111111" onChange={e=>command('foreColor',e.target.value)}/></label>
          <label>{l('Выделение','Белгилөө')}<input aria-label={l('Цвет выделения','Белгилөөнүн түсү')} type="color" defaultValue="#fff29b" onChange={e=>command('hiliteColor',e.target.value)}/></label>
          {tool(l('Очистить','Тазалоо'),'removeFormat')}
        </>)}
        {group(l('Абзац','Абзац'),<>{tool('≡ ←','justifyLeft',null,l('По левому краю','Солго'))}{tool('≡ ↔','justifyCenter',null,l('По центру','Ортого'))}{tool('≡ →','justifyRight',null,l('По правому краю','Оңго'))}
          {tool('☰','justifyFull',null,l('По ширине','Туурасы боюнча'))}
          {tool('• ≡','insertUnorderedList',null,l('Маркеры','Маркерлер'))}{tool('1. ≡','insertOrderedList',null,l('Нумерация','Номерлөө'))}{tool('⇤','outdent',null,l('Уменьшить отступ','Чегинүүнү азайтуу'))}{tool('⇥','indent',null,l('Увеличить отступ','Чегинүүнү көбөйтүү'))}
          <label>{l('Интервал','Аралык')}<select defaultValue="1.45" onChange={e=>paragraphStyle('lineHeight',e.target.value)}>{['1','1.15','1.45','1.5','2'].map(n=><option key={n}>{n}</option>)}</select></label>
          <label>{l('Стиль','Стиль')}<select defaultValue="p" onChange={e=>command('formatBlock',e.target.value)}><option value="p">{l('Обычный','Кадимки')}</option><option value="h1">{l('Заголовок 1','Баш ат 1')}</option><option value="h2">{l('Заголовок 2','Баш ат 2')}</option><option value="h3">{l('Заголовок 3','Баш ат 3')}</option></select></label>
        </>)}
        {group(l('Редактирование','Түзөтүү'),<>{tool('↶','undo',null,l('Отменить','Артка'))}{tool('↷','redo',null,l('Повторить','Алдыга'))}{action(l('Выделить всё','Баарын белгилөө'),()=>{editor.current.focus();const range=document.createRange();range.selectNodeContents(editor.current);const s=window.getSelection();s.removeAllRanges();s.addRange(range);remember();})}
          <input aria-label={l('Найти текст','Текстти издөө')} placeholder={l('Найти','Издөө')} value={find} onChange={e=>setFind(e.target.value)}/><input aria-label={l('Заменить на','Алмаштыруу')} placeholder={l('Заменить на','Алмаштыруу')} value={replacement} onChange={e=>setReplacement(e.target.value)}/>{action(l('Заменить все','Баарын алмаштыруу'),replaceAll)}
        </>)}
      </>}
      {tab==='insert'&&<>
        {group(l('Страницы','Барактар'),<>
          {action(<><span className="insert-icon">▤</span><span>Разрыв страницы</span></>,()=>command('insertHTML','<div style="break-before:page;page-break-before:always"><br></div>'),'Разрыв страницы')}
          {action(<><span className="insert-icon">▱</span><span>Пустая страница</span></>,()=>{editor.current.closest('.monthly-analysis-print-root')?.querySelector('[data-editor-action="add-page"]')?.click();},'Добавить пустую страницу')}
        </>)}
        {group(l('Таблица','Таблица'),<><button type="button" className="insert-table-toggle" aria-expanded={tablePickerOpen} onMouseDown={e=>e.preventDefault()} onClick={()=>setTablePickerOpen(!tablePickerOpen)}><span className="insert-icon">▦</span>Таблица ▾</button><div className={`insert-table-options${tablePickerOpen?' is-open':''}`}><div className="editor-table-picker" role="group" aria-label="Выбор размера таблицы">{Array.from({length:80},(_,i)=>{const r=Math.floor(i/10)+1,c=i%10+1;return <button key={i} type="button" aria-label={`Таблица ${r} × ${c}`} data-highlight={r<=gridHover.rows&&c<=gridHover.cols} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setGridHover({rows:r,cols:c})} onClick={()=>insertTable(r,c)}/>;})}<span>{gridHover.rows} × {gridHover.cols}</span></div><label>{l('Строки','Саптар')}<input type="number" min="1" max="20" value={rows} onChange={e=>setRows(Math.max(1,Math.min(20,+e.target.value||1)))}/></label><label>{l('Столбцы','Мамычалар')}<input type="number" min="1" max="10" value={cols} onChange={e=>setCols(Math.max(1,Math.min(10,+e.target.value||1)))}/></label>{tool(l('Вставить таблицу','Таблица кыстаруу'),'insertHTML','<table style="width:100%;border-collapse:collapse"><tbody>'+Array.from({length:rows},()=>'<tr>'+Array.from({length:cols},()=>'<td style="border:1px solid #333;padding:8px"><br></td>').join('')+'</tr>').join('')+'</tbody></table><p><br></p>')}</div></>)}
        
        {group(l('Иллюстрации','Сүрөттөр'),<>
          {action(<><span className="insert-icon">▧</span><span>Рисунки</span></>,()=>{remember();photoInput.current?.click();},'Вставить фото')}
          {action(<><span className="insert-icon">▭</span><span>Прямоугольник</span></>,()=>command('insertHTML','<p><span style="display:inline-block;width:110px;height:65px;border:2px solid #333;background:#e4eee8">&nbsp;</span></p><p><br></p>'),'Прямоугольник')}
          {action(<><span className="insert-icon">◯</span><span>Круг</span></>,()=>command('insertHTML','<p><span style="display:inline-block;width:80px;height:80px;border-radius:50%;border:2px solid #333;background:#e4eee8">&nbsp;</span></p><p><br></p>'),'Круг')}
          {action(<><span className="insert-icon">—</span><span>Линия</span></>,()=>command('insertHorizontalRule'),'Вставить линию')}
        </>)}
        {group(l('Ссылки','Шилтемелер'),<>
          <label>Адрес<input aria-label="Адрес ссылки" placeholder="https://…" value={linkUrl} onChange={e=>setLinkUrl(e.target.value)}/></label>
          {action('Вставить ссылку',()=>{if(!/^https?:\/\//i.test(linkUrl)){setNotice('Введите адрес, начинающийся с https://');return;}command('createLink',linkUrl);},'Вставить ссылку')}
          {tool('Убрать ссылку','unlink')}
        </>)}
        {group(l('Текст','Текст'),<>
          {action(<><span className="insert-icon">▣</span><span>Текстовое поле</span></>,()=>command('insertHTML','<div style="border:1px solid #555;padding:12px;min-height:50px;width:240px">Введите текст</div><p><br></p>'),'Вставить текстовое поле')}
          {action(<><span className="insert-icon">▦</span><span>Дата</span></>,()=>command('insertText',new Date().toLocaleDateString(language==='ru'?'ru-RU':'ky-KG')),'Вставить дату')}
          {action(<><span className="insert-icon">✎</span><span>Подпись</span></>,()=>command('insertHTML','<p>____________________ / ____________________</p><p><br></p>'),'Вставить строку подписи')}
        </>)}
        {group(l('Символы','Белгилер'),<>{['→','←','✓','№','§','±','©','°','×','÷','α','β','Σ','Ω'].map(symbol=><React.Fragment key={symbol}>{tool(symbol,'insertText',symbol)}</React.Fragment>)}</>)}
      </>}
      {tab==='table'&&group(l('Курсор должен находиться в таблице','Курсор таблицанын ичинде болушу керек'),<>{[['rowBefore','Строка сверху'],['columnBefore','Столбец слева'],['merge','Объединить ячейки'],['split','Разделить ячейку'],['row',l('+ Строка','+ Сап')],['column',l('+ Столбец','+ Мамыча')],['deleteRow',l('Удалить строку','Сапты өчүрүү')],['deleteColumn',l('Удалить столбец','Мамычаны өчүрүү')],['deleteTable',l('Удалить таблицу','Таблицаны өчүрүү')]].map(([kind,text])=><React.Fragment key={kind}>{action(text,()=>editTable(kind))}</React.Fragment>)}</>)}
      {tab==='table'&&group('Оформление ячеек',<><label>Заливка<input type="color" defaultValue="#ffffff" onChange={e=>formatCells('backgroundColor',e.target.value)}/></label><label>Границы<input type="color" defaultValue="#333333" onChange={e=>formatCells('borderColor',e.target.value)}/></label><label>Высота<input aria-label="Высота строки" type="number" min="20" defaultValue="40" onChange={e=>formatCells('height',`${Math.max(20,+e.target.value)}px`)}/></label><label>Вертикально<select defaultValue="top" onChange={e=>formatCells('verticalAlign',e.target.value)}><option value="top">Сверху</option><option value="middle">По центру</option><option value="bottom">Снизу</option></select></label>{action('Без границ',()=>formatCells('border','0'))}{action('Все границы',()=>formatCells('border','1px solid #333'))}</>)}
      {tab==='page'&&group(l('Параметры страницы','Барактын параметрлери'),<><label>{l('Ориентация','Багыты')}<select value={page.orientation} onChange={e=>updatePage('orientation',e.target.value)}><option value="portrait">{l('Книжная','Тик')}</option><option value="landscape">{l('Альбомная','Туурасынан')}</option></select></label><label>{l('Поля','Четтери')}<select value={page.margin} onChange={e=>updatePage('margin',e.target.value)}><option value="normal">{l('Обычные · 20 мм','Кадимки · 20 мм')}</option><option value="narrow">{l('Узкие · 10 мм','Кууш · 10 мм')}</option><option value="wide">{l('Широкие · 28 мм','Кең · 28 мм')}</option></select></label><span>A4</span></>)}
      </div>
      <p className="word-ribbon__hint" role="status">{notice||l('Выделите текст для форматирования. Ctrl+B / I / U · Ctrl+Z.','Форматтоо үчүн текстти белгилеңиз. Ctrl+B / I / U · Ctrl+Z.')}</p>
    </div>}
  </div>;
  return <>{host?createPortal(ribbon,host):ribbon}<style>{`@media print { @page { size: A4 ${page.orientation}; } }`}</style><div ref={node=>{editor.current=node;if(node&&node.dataset.initialized!=='yes'){node.innerHTML=decode(value).html;node.dataset.initialized='yes';}}} className={`document-rich-body ${field==='title'?'document-rich-title':field==='addressee'?'document-rich-addressee':''} ${className}`} style={style} onFocus={()=>document.dispatchEvent(new CustomEvent('munara:editor-focus',{detail:editorId}))} role="textbox" aria-multiline="true" aria-label={field==='title'?l('Заголовок документа','Документтин аталышы'):field==='addressee'?l('Адресат документа','Документтин алуучусу'):l('Текст документа','Документтин тексти')} contentEditable={!readOnly} suppressContentEditableWarning data-placeholder={placeholder} onClick={event=>{if(readOnly)return;const node=event.target.closest('img,span[style]');chooseObject(node&&editor.current.contains(node)&&(node.tagName==='IMG'||node.style.display==='inline-block'||node.style.border)?node:null);}} onPointerDown={pointerDown} onPointerMove={event=>{const drag=dragState.current;if(drag){const width=Math.max(30,drag.width+(event.clientX-drag.start)/drag.scale);const {positions,grid}=tableGrid(drag.cell.closest('table'));const col=positions.get(drag.cell).c;for(const row of grid)if(row[col])row[col].style.width=`${width}px`;}}} onPointerUp={()=>{if(dragState.current){dragState.current=null;save();}}} onInput={()=>save()} onMouseUp={remember} onKeyUp={remember} onBlur={event=>{if(!event.relatedTarget?.closest?.('.document-tools'))remember();}} onPaste={e=>{e.preventDefault();command('insertText',e.clipboardData.getData('text/plain'));}} /></>;
}


