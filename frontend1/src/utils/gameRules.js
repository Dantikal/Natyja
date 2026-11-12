export function advanceSnake(snake, direction, food, size=20) {
 const head={x:snake[0].x+direction.x,y:snake[0].y+direction.y};
 const eats=head.x===food.x&&head.y===food.y;
 const body=eats?snake:snake.slice(0,-1);
 if(head.x<0||head.y<0||head.x>=size||head.y>=size||body.some(s=>s.x===head.x&&s.y===head.y)) return {snake,dead:true,eats:false};
 return {snake:[head,...(eats?snake:snake.slice(0,-1))],dead:false,eats};
}
export function emptyFood(snake,size=20,random=Math.random){
 const free=[];for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!snake.some(s=>s.x===x&&s.y===y))free.push({x,y});
 return free.length?free[Math.floor(random()*free.length)]:null;
}
export function segmentHit(start,end,target,radius){
 const dx=end.x-start.x,dy=end.y-start.y,d=dx*dx+dy*dy;
 const t=d?Math.max(0,Math.min(1,((target.x-start.x)*dx+(target.y-start.y)*dy)/d)):0;
 return Math.hypot(target.x-start.x-t*dx,target.y-start.y-t*dy)<=radius;
}
const values={p:100,n:320,b:330,r:500,q:900,k:0};
function evaluate(chess){
 if(chess.isCheckmate())return -100000;
 if(chess.isDraw())return 0;
 let score=0;for(const row of chess.board())for(const p of row)if(p){
 const center=3.5-Math.abs(3.5-'abcdefgh'.indexOf(p.square[0]));
 score+=(p.color===chess.turn()?1:-1)*(values[p.type]+center*5);
 }return score;
}
export function chooseChessMove(chess,depth=2){
 function search(d,alpha,beta){
 if(!d||chess.isGameOver())return evaluate(chess);
 let best=-Infinity;
 for(const m of chess.moves({verbose:true}).sort((a,b)=>(values[b.captured]||0)-(values[a.captured]||0))){
 chess.move(m);const score=-search(d-1,-beta,-alpha);chess.undo();
 best=Math.max(best,score);alpha=Math.max(alpha,score);if(alpha>=beta)break;
 }return best;
 }
 let chosen=null,best=-Infinity;
 for(const move of chess.moves({verbose:true})){
 chess.move(move);const score=-search(depth-1,-Infinity,Infinity);chess.undo();
 if(score>best){best=score;chosen=move;}
 }return chosen;
}

export function lockTetris(board,piece,position){
 const next=board.map(row=>[...row]);
 for(let y=0;y<piece.shape.length;y++)for(let x=0;x<piece.shape[y].length;x++)if(piece.shape[y][x]){
  const row=position.y+y,col=position.x+x;
  if(row<0)return {board:next,lines:0,overflow:true};
  next[row][col]=piece.color;
 }
 const rows=next.filter(row=>row.some(cell=>cell===null)),lines=board.length-rows.length;
 return {board:[...Array.from({length:lines},()=>Array(board[0].length).fill(null)),...rows],lines,overflow:false};
}

// All tank geometry uses the same 0–100 arena coordinates.
export const TANK_COVER = [
 {id:'north',x:43,y:16,w:14,h:6,kind:'steel'},
 {id:'west',x:17,y:39,w:17,h:7,kind:'brick'},
 {id:'east',x:66,y:39,w:17,h:7,kind:'brick'},
 {id:'center',x:43,y:57,w:14,h:7,kind:'steel'},
 {id:'southwest',x:18,y:70,w:13,h:7,kind:'rock'},
 {id:'southeast',x:69,y:70,w:13,h:7,kind:'rock'},
];
export function turnDelta(current,target){return ((target-current)%360+540)%360-180;}
export function segmentRectFraction(start,end,rect,padding=0){
 let near=0,far=1;
 for(const [axis,size] of [['x','w'],['y','h']]){
  const delta=end[axis]-start[axis],low=rect[axis]-padding,high=rect[axis]+rect[size]+padding;
  if(Math.abs(delta)<1e-9){if(start[axis]<low||start[axis]>high)return null;continue;}
  let a=(low-start[axis])/delta,b=(high-start[axis])/delta;
  if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;
 }
 return near;
}
export function canMoveTank(start,end,cover=TANK_COVER){
 return end.x>=8&&end.x<=92&&end.y>=8&&end.y<=92&&cover.every(rect=>segmentRectFraction(start,end,rect,6)===null);
}
export function clipTankShot(start,end,cover=TANK_COVER){
 let fraction=1;
 for(const rect of cover){const t=segmentRectFraction(start,end,rect);if(t!==null)fraction=Math.min(fraction,t);}
 return {x:start.x+(end.x-start.x)*fraction,y:start.y+(end.y-start.y)*fraction,blocked:fraction<1};
}
