import {createContext,useContext,useEffect,useRef,useState,useCallback} from 'react';
import {useAuth} from './AuthContext';
import {useAppearance} from './AppearanceContext';
import {useLang} from './LanguageContext';
import api from '../api/axios';
const Context=createContext({items:[],read:async()=>{}});
export function TaskNotifications({children}){
 const {user}=useAuth();const {settings}=useAppearance();const {tr}=useLang();const [items,setItems]=useState([]),[toast,setToast]=useState(false);const audio=useRef(null),pending=useRef(false),sound=useRef(settings.sound);
 sound.current=settings.sound;
 const beep=useCallback(()=>{if(!sound.current){pending.current=false;return;}if(!audio.current||audio.current.state!=='running'){pending.current=true;return;}pending.current=false;try{const ctx=audio.current;for(const [delay,freq]of [[0,660],[.18,880]]){const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.connect(gain);gain.connect(ctx.destination);oscillator.frequency.value=freq;const start=ctx.currentTime+delay;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.1,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.16);oscillator.start(start);oscillator.stop(start+.18);}}catch{}},[]);
 useEffect(()=>{const unlock=()=>{try{if(!audio.current){const Audio=window.AudioContext||window.webkitAudioContext;if(Audio)audio.current=new Audio();}audio.current?.resume().then(()=>{if(pending.current)beep();}).catch(()=>{});}catch{}};document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);audio.current?.close().catch(()=>{});audio.current=null;};},[beep]);
 useEffect(()=>{if(!user||user.mustChangePassword){setItems([]);return;}let active=true,running=false;const key='task-notifications-'+(user.id||user.email);let known;try{known=new Set(JSON.parse(localStorage.getItem(key)||'[]'));}catch{known=new Set();}
 const poll=async()=>{if(running||document.hidden)return;running=true;try{const r=await api.get('/tasks/notifications');if(!active)return;setItems(r.data);const fresh=r.data.some(t=>!known.has(t.id));if(fresh){setToast(true);beep();}r.data.forEach(t=>known.add(t.id));try{localStorage.setItem(key,JSON.stringify([...known].slice(-1000)));}catch{}}catch{}finally{running=false;}};
 poll();const timer=setInterval(poll,15000);const visible=()=>{if(!document.hidden)poll();};document.addEventListener('visibilitychange',visible);return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};},[user,beep]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(false),7000);return()=>clearTimeout(timer);},[toast]);
 async function read(){const ids=items.map(t=>t.id);try{await api.post('/tasks/notifications/read',{ids});setItems(prev=>prev.filter(t=>!ids.includes(t.id)));setToast(false);pending.current=false;}catch{}}
 return <Context.Provider value={{items,read}}>{children}{toast&&items.length>0&&<div className="task-notification-toast" role="status">{tr('Новые задачи')}: {items.length}<button onClick={()=>setToast(false)} aria-label={tr('Закрыть')}>×</button></div>}</Context.Provider>;
}
export const useTaskNotifications=()=>useContext(Context);
