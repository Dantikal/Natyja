import "./GamesControls.css";
import { Chess } from "chess.js";
import { advanceSnake, emptyFood, segmentHit, chooseChessMove, lockTetris, TANK_COVER, turnDelta, canMoveTank, clipTankShot } from "../../../utils/gameRules.js";
import {useLanguage as useCopyLanguage} from "../../../i18n.jsx";
import { T } from "../../../i18n.jsx";
import React, { useEffect, useRef, useState } from "react";

const INITIAL_BOTS = [
  { id: 1, x: 22, y: 22, direction: 150, alive: true },
  { id: 2, x: 50, y: 34, direction: 180, alive: true },
  { id: 3, x: 78, y: 20, direction: 210, alive: true },
];

const DIRECTION_DATA = {
  up: { dx: 0, dy: -1, angle: 0 },
  right: { dx: 1, dy: 0, angle: 90 },
  down: { dx: 0, dy: 1, angle: 180 },
  left: { dx: -1, dy: 0, angle: 270 },
};

const SPEEDS = {
  1: { label: "Жай", step: 3 },
  2: { label: "Орточо", step: 5 },
  3: { label: "Тез", step: 8 },
};

const TopTank = ({ bot = false }) => (
  <div className={`top-tank${bot ? " top-tank--bot" : ""}`}>
    <span className="top-tank__track top-tank__track--left" />
    <span className="top-tank__track top-tank__track--right" />
    <span className="top-tank__body" />
    <span className="top-tank__turret" />
    <span className="top-tank__barrel" />
    <span className="top-tank__hatch" />
  </div>
);

const clamp = (value) => Math.max(8, Math.min(92, value));

const PIECE_SYMBOLS = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
};

const TETRIS_PIECES = {
  I: { shape: [[1, 1, 1, 1]], color: '#00f0f0' },
  O: { shape: [[1, 1], [1, 1]], color: '#f0f000' },
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: '#a000f0' },
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: '#00f000' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: '#f00000' },
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: '#0000f0' },
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: '#f0a000' },
};

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

function SnakeGame({ onBack }) {
 const {t}=useCopyLanguage();
 const initial=()=>({snake:[{x:10,y:10}],food:{x:15,y:15},direction:{x:1,y:0},score:0,dead:false,won:false,paused:true});
 const [state,setState]=useState(initial);
 const pending=useRef(null);
 const turn=(x,y)=>{if(!pending.current)pending.current={x,y};};
 const pause=()=>{pending.current=null;setState(s=>({...s,paused:!s.paused}));};
 const reset=()=>{pending.current=null;setState(initial());};
 useEffect(()=>{
  if(state.paused||state.dead||state.won)return;
  const timer=setInterval(()=>{const queued=pending.current;pending.current=null;setState(s=>{
   let dir=queued;
   if(!dir||dir.x===-s.direction.x&&dir.y===-s.direction.y)dir=s.direction;
   const next=advanceSnake(s.snake,dir,s.food);
   const food=next.eats?emptyFood(next.snake):s.food;
   return {...s,snake:next.snake,direction:dir,dead:next.dead,food,won:!food,score:s.score+(next.eats?10:0)};
  });},150);
  return()=>clearInterval(timer);
 },[state.paused,state.dead,state.won]);
 useEffect(()=>{
  const key=e=>{
   if(e.target.closest('input,textarea,select'))return;
   const map={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};
   if(map[e.key]){e.preventDefault();turn(...map[e.key]);}
   if(e.key===' '&&!e.repeat){e.preventDefault();pause();}
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[]);
 return <section className="snake-game"><header className="snake-game__header"><div><button className="snake-game__back" onClick={onBack}><T>← Оюндар</T></button><h1><T>Змейка</T></h1></div><strong>{t('УПАЙ')}: {state.score}</strong></header>
 <div className="snake-game__board-container">
 <div className="snake-game__board">{Array.from({length:20},(_,y)=><div className="snake-game__row" key={y}>{Array.from({length:20},(_,x)=><div key={x} className={`snake-game__cell ${state.snake.some(p=>p.x===x&&p.y===y)?'snake-game__cell--snake':''} ${state.snake[0].x===x&&state.snake[0].y===y?'snake-game__cell--head':''} ${state.food?.x===x&&state.food?.y===y?'snake-game__cell--food':''}`}/>)}</div>)}</div>
 <p role="status">{state.won?t('Победа! Поле заполнено'):state.dead?t('Оюн аяктады!'):state.paused?t('Нажмите «Играть», чтобы начать или продолжить'):t('Собирайте еду и избегайте стен')}</p>
 <div className="game-touch-controls"><button aria-label={t('Вверх')} onClick={()=>turn(0,-1)}>↑</button><button aria-label={t('Влево')} onClick={()=>turn(-1,0)}>←</button><button aria-label={t('Вниз')} onClick={()=>turn(0,1)}>↓</button><button aria-label={t('Вправо')} onClick={()=>turn(1,0)}>→</button></div>
 <div className="game-actions"><button disabled={state.dead||state.won} onClick={pause}>{t(state.paused?'Играть':'Пауза')}</button><button onClick={reset}><T>Кайра баштоо</T></button></div>
 </div></section>;
}

function TetrisGame({ onBack }) {
  const [board, setBoard] = useState(() => 
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(null))
  );
  const [currentPiece, setCurrentPiece] = useState(null);
  const [currentPosition, setCurrentPosition] = useState({ x: 0, y: 0 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const tickRef = useRef(null);
  const bagRef = useRef([]);

  const getRandomPiece = () => {
    const pieces = Object.keys(TETRIS_PIECES);
    if (!bagRef.current.length) bagRef.current = pieces.map(key=>({key,order:Math.random()})).sort((a,b)=>a.order-b.order).map(item=>item.key);
    const randomKey = bagRef.current.pop();
    return {
      shape: TETRIS_PIECES[randomKey].shape,
      color: TETRIS_PIECES[randomKey].color,
    };
  };

  const spawnPiece = (currentBoard = board) => {
    const piece = getRandomPiece();
    const x = Math.floor(BOARD_WIDTH / 2) - Math.floor(piece.shape[0].length / 2);
    const y = 0;
    
    if (checkCollision(piece.shape, x, y, currentBoard)) {
      setGameOver(true);
      return false;
    }
    
    setCurrentPiece(piece);
    setCurrentPosition({ x, y });
    return true;
  };

  const checkCollision = (shape, offsetX, offsetY, currentBoard) => {
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const newX = offsetX + col;
          const newY = offsetY + row;
          
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
            return true;
          }
          
          if (newY >= 0 && currentBoard[newY][newX]) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const rotatePiece = (shape) => {
    const rows = shape.length;
    const cols = shape[0].length;
    const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0));
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        rotated[col][rows - 1 - row] = shape[row][col];
      }
    }
    return rotated;
  };

  const lockPiece = (position = currentPosition) => {
    const result=lockTetris(board,currentPiece,position);
    if(result.overflow){setGameOver(true);return;}
    const newBoard=result.board,linesCleared=result.lines;
    setScore(prev => prev + [0,100,300,500,800][linesCleared]);
    setBoard(newBoard);
    
    if (!spawnPiece(newBoard)) {
      setGameOver(true);
    }
  };

  const moveDown = () => {
    if (!currentPiece || gameOver || isPaused) return;
    
    if (!checkCollision(currentPiece.shape, currentPosition.x, currentPosition.y + 1, board)) {
      setCurrentPosition({ ...currentPosition, y: currentPosition.y + 1 });
    } else {
      lockPiece();
    }
  };

  const moveLeft = () => {
    if (!currentPiece || gameOver || isPaused) return;
    
    if (!checkCollision(currentPiece.shape, currentPosition.x - 1, currentPosition.y, board)) {
      setCurrentPosition({ ...currentPosition, x: currentPosition.x - 1 });
    }
  };

  const moveRight = () => {
    if (!currentPiece || gameOver || isPaused) return;
    
    if (!checkCollision(currentPiece.shape, currentPosition.x + 1, currentPosition.y, board)) {
      setCurrentPosition({ ...currentPosition, x: currentPosition.x + 1 });
    }
  };

  const rotate = () => {
    if (!currentPiece || gameOver || isPaused) return;
    
    const rotated = rotatePiece(currentPiece.shape);
    
    if (!checkCollision(rotated, currentPosition.x, currentPosition.y, board)) {
      setCurrentPiece({ ...currentPiece, shape: rotated });
    } else {
      // Wall kick - try moving left or right
      if (!checkCollision(rotated, currentPosition.x - 1, currentPosition.y, board)) {
        setCurrentPiece({ ...currentPiece, shape: rotated });
        setCurrentPosition({ ...currentPosition, x: currentPosition.x - 1 });
      } else if (!checkCollision(rotated, currentPosition.x + 1, currentPosition.y, board)) {
        setCurrentPiece({ ...currentPiece, shape: rotated });
        setCurrentPosition({ ...currentPosition, x: currentPosition.x + 1 });
      }
    }
  };

  useEffect(() => {
    if (!currentPiece && !gameOver) {
      spawnPiece();
    }
  }, [currentPiece, gameOver]);

  tickRef.current = moveDown;
  useEffect(() => {
    if (gameOver || isPaused) return;
    
    const gameLoop = setInterval(() => {
      tickRef.current?.();
    }, 800);
    
    return () => clearInterval(gameLoop);
  }, [gameOver, isPaused]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.target.closest("input,textarea,select")) return;
      if (["ArrowLeft","ArrowRight","ArrowDown","ArrowUp"," "].includes(event.key)) event.preventDefault();
      if (event.key === " " && event.repeat) return;
      if (gameOver) {
        if (event.key === 'r' || event.key === 'к') {
          resetGame();
        }
        return;
      }
      
      switch (event.key) {
        case 'ArrowLeft':
        case 'a':
        case 'ф':
          moveLeft();
          break;
        case 'ArrowRight':
        case 'd':
        case 'в':
          moveRight();
          break;
        case 'ArrowDown':
        case 's':
        case 'ы':
          moveDown();
          break;
        case 'ArrowUp':
        case 'w':
        case 'ц':
          rotate();
          break;
        case ' ':
        case 'p':
        case 'з':
          setIsPaused(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPiece, currentPosition, board, gameOver, isPaused]);

  const resetGame = () => {
    setBoard(Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(null)));
    setCurrentPiece(null);
    setCurrentPosition({ x: 0, y: 0 });
    setScore(0);
    setGameOver(false);
    setIsPaused(true);
    bagRef.current = [];
  };

  const hardDrop = () => {
    if (!currentPiece || gameOver || isPaused) return;
    let y=currentPosition.y;
    while(!checkCollision(currentPiece.shape,currentPosition.x,y+1,board))y++;
    lockPiece({...currentPosition,y});
  };
  return (
    <section className="tetris-game">
      <header className="tetris-game__header">
        <div>
          <button className="tetris-game__back" onClick={onBack} type="button"><T>{"← Оюндар"}</T></button>
          <h1><T>{"Тетрис"}</T></h1>
        </div>
        <div className="tetris-game__stats">
          <span><small><T>{"УПАЙ"}</T></small><strong>{score}</strong></span>
        </div>
      </header>

      <div className="tetris-game__board-container">
        {isPaused && <div className="tetris-game__pause"><T>{"АЯЛДАЛДЫ"}</T></div>}
        {gameOver && (
          <div className="tetris-game__game-over">
            <h2><T>{"Оюн аяктады!"}</T></h2>
            <p><T>{"Упай: "}</T>{score}</p>
            <button onClick={resetGame} type="button"><T>{"Кайра баштоо"}</T></button>
          </div>
        )}
        <div className="tetris-game__board">
          {board.map((row, rowIndex) => (
            <div key={rowIndex} className="tetris-game__row">
              {row.map((cell, colIndex) => {
                const isCurrentPiece = currentPiece && 
                  currentPiece.shape.some((row, r) => 
                    row.some((cell, c) => 
                      cell && 
                      rowIndex === currentPosition.y + r && 
                      colIndex === currentPosition.x + c
                    )
                  );
                const color = isCurrentPiece ? currentPiece.color : cell;
                return (
                  <div
                    key={colIndex}
                    className={`tetris-game__cell ${color ? 'tetris-game__cell--filled' : ''}`}
                    style={{ backgroundColor: color || 'transparent' }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="game-touch-controls"><button onClick={moveLeft} aria-label="Влево">←</button><button onClick={rotate} aria-label="Повернуть">↻</button><button onClick={moveRight} aria-label="Вправо">→</button><button onClick={moveDown} aria-label="Вниз">↓</button><button onClick={hardDrop}>Сбросить фигуру</button></div>
        <div className="game-actions"><button disabled={gameOver} onClick={()=>setIsPaused(p=>!p)}>{isPaused?'Играть':'Пауза'}</button><button onClick={resetGame}><T>Кайра баштоо</T></button></div>
        <div className="tetris-game__controls">
          <p><T>{"Башкаруу:"}</T></p>
          <p><T>{"← → - Кыймыл"}</T></p>
          <p><T>{"↑ - Буруу"}</T></p>
          <p><T>{"↓ - Тез түшүрүү"}</T></p>
          <p><T>{"Пробел - Аялдатуу"}</T></p>
        </div>
      </div>
    </section>
  );
}

function ChessGame({ onBack }) {
 const {t}=useCopyLanguage();
 const [game]=useState(()=>new Chess());
 const [version,setVersion]=useState(0);
 const [selected,setSelected]=useState(null);
 const [gameMode,setGameMode]=useState(null);
 const [promotion,setPromotion]=useState(null);
 const [thinking,setThinking]=useState(false);
 const sync=()=>{setSelected(null);setPromotion(null);setVersion(v=>v+1);};
 useEffect(()=>{
  if(gameMode!=='bot'||game.turn()!=='b'||game.isGameOver())return;
  setThinking(true);
  const timer=setTimeout(()=>{const move=chooseChessMove(game,2);if(move)game.move(move);setThinking(false);sync();},450);
  return()=>clearTimeout(timer);
 },[version,gameMode,game]);
 const play=(from,to,piece)=>{try{game.move({from,to,promotion:piece||'q'});sync();}catch{/* Keep the selected legal source. */}};
 const click=square=>{
  if(game.isGameOver()||promotion||(gameMode==='bot'&&game.turn()==='b'))return;
  const piece=game.get(square);
  if(piece?.color===game.turn()){setSelected(selected===square?null:square);return;}
  if(!selected)return;
  const move=game.moves({square:selected,verbose:true}).find(m=>m.to===square);
  if(!move)return;
  if(move.promotion){setPromotion({from:selected,to:square});return;}
  play(selected,square);
 };
 const status=game.isCheckmate()?t(game.turn()==='w'?'Мат. Победили чёрные':'Мат. Победили белые'):game.isStalemate()?t('Ничья: пат'):game.isDraw()?t('Ничья'):thinking?t('Бот думает…'):`${t(game.turn()==='w'?'Ход белых':'Ход чёрных')}${game.isCheck()?' — '+t('Шах'):''}`;
 const legal=selected?game.moves({square:selected,verbose:true}).map(m=>m.to):[];
 const names={p:'Пешка',n:'Конь',b:'Слон',r:'Ладья',q:'Ферзь',k:'Король'};
 return <section className="chess-game">
  <header className="chess-game__header"><div><button className="chess-game__back" onClick={onBack}><T>← Оюндар</T></button><h1><T>Шахматы</T></h1></div></header>
  {!gameMode?<div className="chess-game__mode-selection"><h2><T>Оюн режимин тандаңыз</T></h2><div className="chess-game__mode-buttons"><button onClick={()=>setGameMode('player')}><T>Эки оюнчу</T></button><button onClick={()=>setGameMode('bot')}><T>Бот менен</T></button></div></div>:<div className="chess-game__board-container">
   <p className="chess-game__status" role="status">{status}</p>
   <div className="chess-game__board">{game.board().map((row,r)=><div className="chess-game__row" key={r}>{row.map((piece,c)=>{
    const square='abcdefgh'[c]+(8-r),symbol=piece?(piece.color==='w'?piece.type.toUpperCase():piece.type):'';
    return <button key={square} aria-label={`${square}: ${piece?t(piece.color==='w'?'Белые':'Чёрные')+' '+t(names[piece.type]):t('Пустая клетка')}`} aria-pressed={selected===square} className={`chess-game__square chess-game__square--${(r+c)%2?'dark':'light'}${selected===square?' is-selected':''}${legal.includes(square)?' is-legal':''}`} onClick={()=>click(square)}><span className={`chess-game__piece chess-game__piece--${piece?.color==='w'?'white':'black'}`}>{PIECE_SYMBOLS[symbol]}</span><small className="chess-coordinate">{square}</small></button>;
   })}</div>)}</div>
   {promotion&&<div className="game-promotion" role="group" aria-label={t('Превращение пешки')}><strong><T>Выберите фигуру</T></strong>{['q','r','b','n'].map(p=><button key={p} onClick={()=>play(promotion.from,promotion.to,p)}>{t(names[p])}</button>)}</div>}
   <div className="game-actions"><button onClick={()=>{game.reset();setThinking(false);sync();}}><T>Кайра баштоо</T></button><button onClick={()=>{game.reset();sync();setGameMode(null);}}><T>Сменить режим</T></button></div>
  </div>}
 </section>;
}

export default function Games() {
 const {t:copyT}=useCopyLanguage();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentGame, setCurrentGame] = useState(null);
  const [player, setPlayer] = useState({ x: 50, y: 78 });
  const [direction, setDirection] = useState("up");
  const [heading,setHeading]=useState(0);
  const [turnDuration,setTurnDuration]=useState(360);
  const steeringRef=useRef({direction:"up",angle:0,readyAt:0});
  const [speed, setSpeed] = useState(2);
  const [bots, setBots] = useState(INITIAL_BOTS);
  const [projectile, setProjectile] = useState(null);
  const [isReloading, setIsReloading] = useState(false);
  const [shots, setShots] = useState(0);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState("Үч ботту жок кылыңыз");
  const [botProjectiles, setBotProjectiles] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [playerDestroyed, setPlayerDestroyed] = useState(false);
  const [tankPaused,setTankPaused]=useState(true);
  const botsRef=useRef(bots);
  const reloadRef=useRef(false);
  const activeRef=useRef(false);
  botsRef.current=bots;
  activeRef.current=isPlaying&&currentGame==='tanks'&&!gameOver&&!tankPaused;
  const timersRef = useRef([]);
  const playerRef = useRef(player);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    if (!isPlaying || currentGame !== "tanks" || gameOver || tankPaused) return undefined;

    const movementInterval = window.setInterval(() => {
      setBots((currentBots) => currentBots.map((bot) => {
        if (!bot.alive) return bot;

        const botSpeed = 2;
        const currentAngle = (bot.direction * Math.PI) / 180;
        const nextX = clamp(bot.x + Math.sin(currentAngle) * botSpeed);
        const nextY = clamp(bot.y - Math.cos(currentAngle) * botSpeed);

        const blocked=!canMoveTank(bot,{x:nextX,y:nextY});
        const nextDirection=bot.direction+(blocked?90:Math.random()<.15?(Math.random()<.5?-30:30):0);

        return {
          ...bot,
          x: blocked?bot.x:nextX,
          y: blocked?bot.y:nextY,
          direction: nextDirection,
        };
      }));
    }, 620);

    return () => window.clearInterval(movementInterval);
  }, [isPlaying,currentGame,gameOver,tankPaused]);

  useEffect(() => {
    if (!isPlaying || currentGame !== "tanks" || gameOver || tankPaused) return undefined;

    const handleKeyDown = (event) => {
      if(event.target.closest('input,textarea,select'))return;
      const key = event.key.toLowerCase();
      if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))event.preventDefault();
      if (key === 'arrowup' || key === 'w' || key === 'ц') move('up');
      if (key === 'arrowdown' || key === 's' || key === 'ы') move('down');
      if (key === 'arrowleft' || key === 'a' || key === 'ф') move('left');
      if (key === 'arrowright' || key === 'd' || key === 'в') move('right');
      if (key === ' ' || key === 'e' || key === 'у') fire();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying,currentGame,gameOver,tankPaused,direction,speed,isReloading,player]);

  useEffect(() => {
    if (!isPlaying || currentGame !== 'tanks' || gameOver || tankPaused) return;
    const interval=setInterval(()=>{
      const alive=botsRef.current.filter(b=>b.alive);if(!alive.length)return;
      const bot=alive[Math.floor(Math.random()*alive.length)],target=playerRef.current;
      const dx=target.x-bot.x,dy=target.y-bot.y,length=Math.hypot(dx,dy)||1;
      const end=clipTankShot(bot,{x:clamp(bot.x+dx/length*100),y:clamp(bot.y+dy/length*100)});
      const shot={id:Date.now(),startX:bot.x,startY:bot.y,endX:end.x,endY:end.y};
      setBotProjectiles(p=>[...p,shot]);
      flyShot(shot,()=>[{...playerRef.current,id:'player'}],hit=>{
        if(hit){setPlayerDestroyed(true);setGameOver(true);setStatus('Сиз уулдунуз! Оюн аяктады.');}
        setBotProjectiles(p=>p.filter(b=>b.id!==shot.id));
      },800,4);
    },2400);
    return()=>clearInterval(interval);
  },[isPlaying,currentGame,gameOver,tankPaused]);
  useEffect(()=>{
    if(!isPlaying||currentGame!=='tanks'||gameOver||tankPaused){
      timersRef.current.forEach(clearTimeout);timersRef.current=[];
      reloadRef.current=false;setIsReloading(false);setProjectile(null);setBotProjectiles([]);
    }
  },[isPlaying,currentGame,gameOver,tankPaused]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const addTimer = (callback, delay) => {
    const timer = window.setTimeout(() => {timersRef.current=timersRef.current.filter(t=>t!==timer);if(activeRef.current)callback();}, delay);
    timersRef.current.push(timer);
  };

  const flyShot=(shot,targets,done,duration=440,radius=4)=>{
    const start={x:shot.startX,y:shot.startY},end={x:shot.endX,y:shot.endY};
    let previous=start,step=0;
    const tick=()=>{
      step++;const fraction=Math.min(1,step*20/duration);
      const point={x:start.x+(end.x-start.x)*fraction,y:start.y+(end.y-start.y)*fraction};
      const hit=targets().filter(t=>segmentHit(previous,point,t,radius)).sort((a,b)=>Math.hypot(a.x-previous.x,a.y-previous.y)-Math.hypot(b.x-previous.x,b.y-previous.y))[0];
      if(hit||fraction===1){done(hit);return;}
      previous=point;addTimer(tick,20);
    };addTimer(tick,20);
  };
  const move = (nextDirection) => {
    if(!activeRef.current)return;
    const steering=steeringRef.current,now=performance.now();
    if(now<steering.readyAt)return;
    if(steering.direction!==nextDirection){
      const delta=turnDelta(steering.angle,DIRECTION_DATA[nextDirection].angle);
      steeringRef.current={direction:nextDirection,angle:steering.angle+delta,readyAt:now+Math.abs(delta)*4};
      setDirection(nextDirection);setHeading(steering.angle+delta);setTurnDuration(Math.abs(delta)*4);
      setStatus('Поворот танка');return;
    }
    const movement=DIRECTION_DATA[nextDirection],current=playerRef.current;
    const next={x:clamp(current.x+movement.dx*SPEEDS[speed].step),y:clamp(current.y+movement.dy*SPEEDS[speed].step)};
    if(!canMoveTank(current,next)){setStatus('Препятствие — выберите другой путь');return;}
    playerRef.current=next;setPlayer(next);
    setStatus(`${SPEEDS[speed].label} ылдамдыкта жүрүүдө`);
  };

  const fire = () => {
    if (!activeRef.current || reloadRef.current || performance.now()<steeringRef.current.readyAt) return;
    reloadRef.current=true;
    const origin=playerRef.current,movement=DIRECTION_DATA[steeringRef.current.direction];
    const end=clipTankShot(origin,{x:clamp(origin.x+movement.dx*100),y:clamp(origin.y+movement.dy*100)});
    const shot={id:Date.now(),startX:origin.x,startY:origin.y,endX:end.x,endY:end.y};
    setShots(n=>n+1);setIsReloading(true);setProjectile(shot);setStatus('Снаряд учууда...');
    flyShot(shot,()=>botsRef.current.filter(b=>b.alive),hit=>{
      setProjectile(null);
      if(hit){
        const next=botsRef.current.map(b=>b.id===hit.id?{...b,alive:false}:b);botsRef.current=next;setBots(next);setScore(n=>n+100);
        const remaining=next.filter(b=>b.alive).length;
        setStatus(remaining?`Бот жок кылынды! Дагы ${remaining} бот калды`:'Жеңиш! Бардык боттор жок кылынды');
        if(!remaining)setGameOver(true);
      }else setStatus(end.blocked?'Снаряд остановлен укрытием':'Мелжеген жерге тийген жок');
    });
    addTimer(()=>{reloadRef.current=false;setIsReloading(false);},700);
  };

  const resetGame = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    reloadRef.current=false;
    setTankPaused(true);
    botsRef.current=INITIAL_BOTS;
    playerRef.current={x:50,y:78};
    setPlayer({ x: 50, y: 78 });
    setDirection("up");
    setHeading(0);steeringRef.current={direction:"up",angle:0,readyAt:0};
    setSpeed(2);
    setBots(INITIAL_BOTS);
    setProjectile(null);
    setIsReloading(false);
    setShots(0);
    setScore(0);
    setStatus("Үч ботту жок кылыңыз");
    setBotProjectiles([]);
    setGameOver(false);
    setPlayerDestroyed(false);
  };

  if (!isPlaying) {
    return (
      <section className="games-hub">
        <header className="games-hub__header">
          <span><T>{"КҮЖҮРМӨН АСКЕР 1.0"}</T></span>
          <h1><T>{"Оюндар"}</T></h1>
          <p><T>{"Көңүл бурууну жана тактыкты өнүктүрүүчү интерактивдүү оюндар."}</T></p>
        </header>
        <div className="games-hub__grid">
          <button className="game-card game-card--tanks" onClick={() => { resetGame(); setIsPlaying(true); setCurrentGame('tanks'); }} type="button">
            <span className="game-card__preview game-card__preview--top" aria-hidden="true">
              <span className="game-card__preview-tank"><TopTank /></span>
              <i className="game-card__crosshair" />
            </span>
            <span className="game-card__content">
              <small><T>{"ҮСТҮНКҮ КӨРҮНҮШ · 1 × 3"}</T></small>
              <strong><T>{"Танки"}</T></strong>
              <span><T>{"Бир танкты башкарып, үч ботту жок кылыңыз"}</T></span>
            </span>
            <span className="game-card__start"><T>{"Оюнду баштоо →"}</T></span>
          </button>
          <button className="game-card game-card--chess" onClick={() => { setIsPlaying(true); setCurrentGame('chess'); }} type="button">
            <span className="game-card__preview game-card__preview--chess" aria-hidden="true">
              <span className="game-card__preview-chess-board">
                <span className="chess-square chess-square--white" />
                <span className="chess-square chess-square--black" />
                <span className="chess-square chess-square--black" />
                <span className="chess-square chess-square--white" />
              </span>
            </span>
            <span className="game-card__content">
              <small><T>{"СТРАТЕГИЯ · 2 ОЮНЧУ"}</T></small>
              <strong><T>{"Шахматы"}</T></strong>
              <span><T>{"Классикалык шахмат оюну"}</T></span>
            </span>
            <span className="game-card__start"><T>{"Оюнду баштоо →"}</T></span>
          </button>
          <button className="game-card game-card--tetris" onClick={() => { setIsPlaying(true); setCurrentGame('tetris'); }} type="button">
            <span className="game-card__preview game-card__preview--tetris" aria-hidden="true">
              <span className="game-card__preview-tetris">
                <span className="tetris-block tetris-block--i" />
                <span className="tetris-block tetris-block--o" />
                <span className="tetris-block tetris-block--t" />
              </span>
            </span>
            <span className="game-card__content">
              <small><T>{"ГАЗЫЛДЫК · 1 ОЮНЧУ"}</T></small>
              <strong><T>{"Тетрис"}</T></strong>
              <span><T>{"Классикалык тетрис оюну"}</T></span>
            </span>
            <span className="game-card__start"><T>{"Оюнду баштоо →"}</T></span>
          </button>
          <button className="game-card game-card--snake" onClick={() => { setIsPlaying(true); setCurrentGame('snake'); }} type="button">
            <span className="game-card__preview game-card__preview--snake" aria-hidden="true">
              <span className="game-card__preview-snake">
                <span className="snake-segment snake-segment--head" />
                <span className="snake-segment snake-segment--body" />
                <span className="snake-segment snake-segment--body" />
                <span className="snake-food" />
              </span>
            </span>
            <span className="game-card__content">
              <small><T>{"ГАЗЫЛДЫК · 1 ОЮНЧУ"}</T></small>
              <strong><T>{"Змейка"}</T></strong>
              <span><T>{"Классикалык змейка оюну"}</T></span>
            </span>
            <span className="game-card__start"><T>{"Оюнду баштоо →"}</T></span>
          </button>
        </div>
      </section>
    );
  }

  const aliveBots = bots.filter((bot) => bot.alive).length;

  if (currentGame === 'chess') {
    return <ChessGame onBack={() => { setIsPlaying(false); setCurrentGame(null); }} />;
  }

  if (currentGame === 'tetris') {
    return <TetrisGame onBack={() => { setIsPlaying(false); setCurrentGame(null); }} />;
  }

  if (currentGame === 'snake') {
    return <SnakeGame onBack={() => { setIsPlaying(false); setCurrentGame(null); }} />;
  }

  return (
    <section className="tank-game tank-game--top-view">
      <header className="tank-game__header">
        <div>
          <button className="tank-game__back" onClick={() => setIsPlaying(false)} type="button"><T>{"← Оюндар"}</T></button>
          <h1><T>{"Танки"}</T></h1>
        </div>
        <div className="tank-game__stats">
          <span><small><T>{"БОТТОР"}</T></small><strong>{aliveBots}/3</strong></span>
          <span><small><T>{"УПАЙ"}</T></small><strong>{score}</strong></span>
          <span><small><T>{"АТУУ"}</T></small><strong>{shots}</strong></span>
        </div>
      </header>

      <div className="tank-game__arena tank-game__arena--top">
        <div className="tank-game__terrain" />
        <span className="tank-game__road tank-game__road--horizontal" />
        <span className="tank-game__road tank-game__road--vertical" />
        <span className="tank-game__base tank-game__base--enemy"><T>{"БОТТОРДУН БАЗАСЫ"}</T></span>
        <span className="tank-game__base tank-game__base--player"><T>{"ОЮНЧУНУН БАЗАСЫ"}</T></span>
        <span className="tank-game__wall tank-game__wall--top" />
        <span className="tank-game__wall tank-game__wall--bottom" />
        <span className="tank-game__wall tank-game__wall--left" />
        <span className="tank-game__wall tank-game__wall--right" />

        <div className="tank-cover-layer" aria-label="Укрытия: бетонные блоки, кирпич и камни">{TANK_COVER.map(cover=><div key={cover.id} className={`tank-cover tank-cover--${cover.kind}`} style={{left:`${cover.x}%`,top:`${cover.y}%`,width:`${cover.w}%`,height:`${cover.h}%`}} />)}</div>
        {bots.map((bot) => (
          <div
            className={`tank-game__top-unit tank-game__top-unit--bot${bot.alive ? "" : " is-destroyed"}`}
            key={bot.id}
            style={{ left: `${bot.x}%`, top: `${bot.y}%`, "--unit-angle": `${bot.direction}deg` }}
          >
            {bot.alive ? <TopTank bot /> : <span className="tank-game__wreck">✦</span>}
            {bot.alive ? <small>BOT {bot.id}</small> : null}
          </div>
        ))}

        <div
          className={`tank-game__top-unit tank-game__top-unit--player${playerDestroyed ? " is-destroyed" : ""}`}
          style={{ left: `${player.x}%`, top: `${player.y}%`, "--unit-angle": `${heading}deg`, "--turn-duration": `${turnDuration}ms` }}
        >
          {playerDestroyed ? <span className="tank-game__wreck">✦</span> : <TopTank />}
          {!playerDestroyed ? <small><T>{"СИЗ"}</T></small> : null}
        </div>

        {projectile ? (
          <span
            className="tank-game__top-projectile"
            key={projectile.id}
            style={{
              "--start-x": `${projectile.startX}%`,
              "--start-y": `${projectile.startY}%`,
              "--end-x": `${projectile.endX}%`,
              "--end-y": `${projectile.endY}%`,
            }}
          />
        ) : null}

        {botProjectiles.map((bp) => (
          <span
            className="tank-game__top-projectile tank-game__top-projectile--enemy"
            key={bp.id}
            style={{
              "--start-x": `${bp.startX}%`,
              "--start-y": `${bp.startY}%`,
              "--end-x": `${bp.endX}%`,
              "--end-y": `${bp.endY}%`,
            }}
          />
        ))}

        <div className="tank-game__status" aria-live="polite"><T>{tankPaused ? "Пауза" : status}</T></div>

        {gameOver && (
          <div className="tank-game__game-over-modal">
            <h2 className="tank-game__game-over-title"><T>{playerDestroyed ? "Сиз уулдунуз! Оюн аяктады." : "Жеңиш! Бардык боттор жок кылынды"}</T></h2>
            <button className="tank-game__game-over-restart" onClick={resetGame} type="button"><T>{"Кайра баштоо"}</T></button>
          </div>
        )}
      </div>

      <div className="game-actions"><button disabled={gameOver} onClick={()=>setTankPaused(p=>!p)}>{tankPaused?"Играть":"Пауза"}</button><span>WASD / стрелки — поворот и движение · Пробел — выстрел · Укрытия задерживают снаряды</span></div>
      <div className="tank-game__control-panel">
        <div className="tank-game__dpad" aria-label={copyT("Танкты башкаруу")}>
          <button aria-label={copyT("Өйдө")} disabled={gameOver} onClick={() => move("up")} type="button">↑</button>
          <button aria-label={copyT("Солго")} disabled={gameOver} onClick={() => move("left")} type="button">←</button>
          <span />
          <button aria-label={copyT("Оңго")} disabled={gameOver} onClick={() => move("right")} type="button">→</button>
          <button aria-label={copyT("Төмөн")} disabled={gameOver} onClick={() => move("down")} type="button">↓</button>
        </div>

        <label className="tank-game__speed">
          <span><T>{"ТАНКТЫН ЫЛДАМДЫГЫ"}</T></span>
          <input
            aria-label={copyT("Танктын ылдамдыгы")}
            disabled={gameOver}
            max="3"
            min="1"
            onChange={(event) => setSpeed(Number(event.target.value))}
            step="1"
            type="range"
            value={speed}
          />
          <strong><T>{SPEEDS[speed].label}</T></strong>
          <small>1</small><small>2</small><small>3</small>
        </label>

        <button className="tank-game__fire" disabled={isReloading || gameOver} onClick={fire} type="button">
          <span><T>{isReloading ? "ОКТОЛУУДА" : "ОК ЧЫГАРУУ"}</T></span>
          <small><T>{isReloading ? "Күтүңүз" : "FIRE"}</T></small>
        </button>
        <button className="tank-game__reset" onClick={resetGame} type="button"><T>{"Кайра баштоо"}</T></button>
      </div>
    </section>
  );
}
