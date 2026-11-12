import {readPreferences} from '../preferences.js';
let context=null,lastPlayed=0,pending=null;
const played=new Set();
function getContext(){
 const Audio=window.AudioContext||window.webkitAudioContext;
 if(!Audio)return null;
 if(!context||context.state==='closed')context=new Audio();
 return context;
}
let customAudio=null;
function emit(key, fallback=false){
 if(!readPreferences().notificationSound||played.has(key))return;
 if(!context||context.state!=='running'){pending={key,at:Date.now()};return;}
 if(Date.now()-lastPlayed<1200)return;
 pending=null;played.add(key);if(played.size>200)played.delete(played.values().next().value);
 lastPlayed=Date.now();const start=context.currentTime;
 const choice=readPreferences().notificationTone;
 if(choice==='custom'&&!fallback){
  const source=window.localStorage.getItem('munara:notification-audio');
  if(source){
   customAudio?.pause();const audio=new Audio(source);customAudio=audio;audio.volume=.85;
   const stop=setTimeout(()=>{audio.pause();if(customAudio===audio)customAudio=null;},5000);
   audio.onended=()=>clearTimeout(stop);
   audio.play().catch(()=>{clearTimeout(stop);played.delete(key);lastPlayed=0;emit(key,true);});return;
  }
 }
 const notes=choice==='chime'?[[0,1046.5],[.16,1318.5],[.32,1568]]:choice==='soft'?[[0,783.99]]:[[0,1046.5],[0,2093],[0,3139.5]];
 for(const [offset,frequency] of notes){
  const tone=context.createOscillator(),gain=context.createGain();tone.type='sine';tone.frequency.setValueAtTime(frequency,start+offset);
  gain.gain.setValueAtTime(0,start+offset);gain.gain.linearRampToValueAtTime(frequency===1046.5?.2:.035,start+offset+.008);gain.gain.exponentialRampToValueAtTime(.001,start+offset+1.35);
  tone.connect(gain);gain.connect(context.destination);tone.start(start+offset);tone.stop(start+offset+1.4);tone.onended=()=>{tone.disconnect();gain.disconnect();};
 }
}
export function unlockMessageAudio(){
 try{const audio=getContext();if(!audio)return;
 const flush=()=>{if(pending&&Date.now()-pending.at<15000)emit(pending.key);else pending=null;};
 if(audio.state!=='running')audio.resume().then(flush).catch(()=>{});else flush();
 }catch{}
}
export function playMessageSound(key){
 if(!readPreferences().notificationSound||played.has(key))return;
 try{getContext();pending={key,at:Date.now()};if(context?.state==='running')emit(key);else unlockMessageAudio();}catch{}
}
