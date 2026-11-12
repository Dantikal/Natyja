import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {advanceSnake,emptyFood,segmentHit,chooseChessMove,lockTetris,turnDelta,canMoveTank,clipTankShot,TANK_COVER} from '../src/utils/gameRules.js';
test('snake may enter the departing tail, but not occupied body or walls',()=>{
 const snake=[{x:1,y:1},{x:1,y:2},{x:0,y:2},{x:0,y:1}];
 assert.equal(advanceSnake(snake,{x:-1,y:0},{x:3,y:3}).dead,false);
 assert.equal(advanceSnake(snake,{x:0,y:1},{x:3,y:3}).dead,true);
 assert.equal(advanceSnake([{x:0,y:0}],{x:-1,y:0},{x:3,y:3}).dead,true);
 const meal=advanceSnake([{x:0,y:0}],{x:1,y:0},{x:1,y:0});assert.equal(meal.snake.length,2);
 assert.equal(emptyFood([{x:0,y:0}],1),null);
 assert.deepEqual(emptyFood([{x:0,y:0},{x:1,y:0},{x:0,y:1}],2),{x:1,y:1});
});
test('projectiles hit only their travelled segment',()=>{
 assert.equal(segmentHit({x:0,y:0},{x:10,y:0},{x:5,y:1},2),true);
 assert.equal(segmentHit({x:0,y:0},{x:10,y:0},{x:50,y:0},2),false);
 assert.equal(segmentHit({x:0,y:0},{x:10,y:0},{x:5,y:5},2),false);
});
test('chess bot finds mate and leaves its input position unchanged',()=>{
 const chess=new Chess();for(const m of ['f3','e5','g4'])chess.move(m);
 const before=chess.fen(),move=chooseChessMove(chess);assert.equal(chess.fen(),before);
 chess.move(move);assert.equal(chess.isCheckmate(),true);
});
test('chess rules forbid ignoring check and support castling and promotion',()=>{
 const chess=new Chess('4r1k1/8/8/8/8/8/P7/4K3 w - - 0 1');
 assert.equal(chess.moves({square:'a2'}).length,0);
 const castle=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');castle.move('O-O');assert.equal(castle.get('f1').type,'r');
 const promotion=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');promotion.move({from:'a7',to:'a8',promotion:'n'});assert.equal(promotion.get('a8').type,'n');
});

test('tetris locks into a new board and clears consecutive complete lines',()=>{
 const board=[[null,null,null],[null,'red','red'],[null,'red','red']];
 const result=lockTetris(board,{shape:[[1],[1]],color:'blue'},{x:0,y:1});
 assert.equal(result.lines,2);assert.deepEqual(result.board,Array.from({length:3},()=>[null,null,null]));
 assert.equal(board[2][0],null);
 assert.equal(lockTetris(board,{shape:[[1]],color:'red'},{x:0,y:-1}).overflow,true);
});

test('tank turns use the shortest arc instead of spinning through 270 degrees',()=>{
 assert.equal(turnDelta(270,0),90);assert.equal(turnDelta(0,270),-90);
 assert.equal(Math.abs(turnDelta(0,180)),180);assert.equal(turnDelta(720,90),90);
});
test('cover prevents tanks tunnelling through it, including at maximum speed',()=>{
 const cover=[{x:40,y:40,w:20,h:10}];
 assert.equal(canMoveTank({x:50,y:60},{x:50,y:52},cover),false);
 assert.equal(canMoveTank({x:30,y:60},{x:30,y:52},cover),true);
 assert.equal(canMoveTank({x:50,y:60},{x:50,y:20},cover),false);
 assert.equal(canMoveTank({x:10,y:10},{x:5,y:10},cover),false);
 for(const point of [{x:50,y:78},{x:22,y:22},{x:50,y:34},{x:78,y:20}])assert.equal(canMoveTank(point,point,TANK_COVER),true);
});
test('shell stops at the nearest cover, while an open lane remains clear',()=>{
 const cover=[{x:40,y:40,w:20,h:10},{x:40,y:20,w:20,h:10}];
 assert.deepEqual(clipTankShot({x:50,y:80},{x:50,y:0},cover),{x:50,y:50,blocked:true});
 assert.deepEqual(clipTankShot({x:20,y:80},{x:20,y:0},cover),{x:20,y:0,blocked:false});
});
