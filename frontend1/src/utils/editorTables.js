export function tableGrid(table){
 const grid=[],positions=new Map();
 [...table.rows].forEach((row,r)=>{grid[r]??=[];let c=0;for(const cell of row.cells){while(grid[r][c])c++;positions.set(cell,{r,c});for(let y=r;y<r+cell.rowSpan;y++){grid[y]??=[];for(let x=c;x<c+cell.colSpan;x++)grid[y][x]=cell;}c+=cell.colSpan;}});
 return {grid,positions,width:Math.max(0,...grid.map(row=>row.length))};
}
export function newCell(doc){const cell=doc.createElement('td');cell.style.cssText='border:1px solid #333;padding:8px';cell.innerHTML='<br>';return cell;}
export function splitCell(cell){const table=cell.closest('table'),{positions}=tableGrid(table),pos=positions.get(cell),rs=cell.rowSpan,cs=cell.colSpan;cell.rowSpan=1;cell.colSpan=1;for(let y=pos.r;y<pos.r+rs;y++){let previous=y===pos.r?cell:null;for(let x=pos.c+(y===pos.r?1:0);x<pos.c+cs;x++){const next=newCell(table.ownerDocument);if(previous)previous.after(next);else{const map=tableGrid(table).positions;const ref=[...table.rows[y].cells].find(c=>map.get(c)?.c>=pos.c);table.rows[y].insertBefore(next,ref||null);}previous=next;}}}
export function mergeCells(cells){
 const table=cells[0]?.closest('table');if(!table||cells.length<2)return false;const {grid,positions}=tableGrid(table);if(cells.some(c=>c.closest('table')!==table))return false;
 const top=Math.min(...cells.map(c=>positions.get(c).r)),left=Math.min(...cells.map(c=>positions.get(c).c)),bottom=Math.max(...cells.map(c=>positions.get(c).r+c.rowSpan-1)),right=Math.max(...cells.map(c=>positions.get(c).c+c.colSpan-1));
 const set=new Set(cells);for(let r=top;r<=bottom;r++)for(let c=left;c<=right;c++)if(!set.has(grid[r]?.[c]))return false;
 const first=grid[top][left];for(const cell of cells)if(cell!==first){if(cell.textContent.trim())first.insertAdjacentHTML('beforeend','<br>'+cell.innerHTML);cell.remove();}first.rowSpan=bottom-top+1;first.colSpan=right-left+1;return true;
}
export function editTableStructure(cell,kind){
 const table=cell.closest('table');if(kind==='split'){if(cell.colSpan===1&&cell.rowSpan===1){cell.colSpan=2;const {grid}=tableGrid(table);for(const row of table.rows)for(const other of row.cells)if(other!==cell&&grid[other.parentElement.rowIndex]?.includes(cell)===false)other.colSpan*=2;}splitCell(cell);return;}
 // Expand merged cells before structural changes so all rows stay rectangular.
 const pos=tableGrid(table).positions.get(cell);for(const row of [...table.rows])for(const item of [...row.cells])if(item.rowSpan>1||item.colSpan>1)splitCell(item);
 const current=tableGrid(table).grid[pos.r][pos.c],row=current.parentElement,index=current.cellIndex;
 if(kind==='deleteTable'){table.remove();return;}
 if(kind==='rowBefore'||kind==='row'){const next=table.insertRow(row.rowIndex+(kind==='row'?1:0));for(let i=0;i<row.cells.length;i++)next.append(newCell(table.ownerDocument));}
 if(kind==='columnBefore'||kind==='column')for(const tr of table.rows)tr.insertBefore(newCell(table.ownerDocument),tr.cells[index+(kind==='column'?1:0)]||null);
 if(kind==='deleteRow'){if(table.rows.length===1)table.remove();else row.remove();}
 if(kind==='deleteColumn'){if(row.cells.length===1)table.remove();else for(const tr of table.rows)tr.cells[index]?.remove();}
}
