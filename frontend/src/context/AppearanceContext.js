import {createContext,useContext,useEffect,useState} from 'react';
const defaults={theme:'system',brightness:100,textSize:'normal',density:'comfortable',accent:'slate',motion:'system',sound:true};
const Context=createContext();
export function normalizeAppearance(value={}){
 const next={...defaults};
 if(typeof value?.sound==='boolean')next.sound=value.sound;
 for(const [key,allowed] of Object.entries({theme:['light','dark','system'],textSize:['normal','large'],density:['comfortable','compact'],accent:['slate','blue','teal'],motion:['system','reduced']}))if(allowed.includes(value?.[key]))next[key]=value[key];
 if(typeof value?.brightness==='number'&&Number.isFinite(value.brightness))next.brightness=Math.max(70,Math.min(100,value.brightness));
 return next;
}
export function AppearanceProvider({children}){
 const [settings,setSettings]=useState(()=>{try{return normalizeAppearance(JSON.parse(localStorage.getItem('appearance')||'{}'));}catch{return {...defaults};}});
 const [systemDark,setSystemDark]=useState(()=>window.matchMedia?.('(prefers-color-scheme: dark)').matches||false);
 useEffect(()=>{const media=window.matchMedia?.('(prefers-color-scheme: dark)');if(!media)return;const change=e=>setSystemDark(e.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useEffect(()=>{const el=document.documentElement;el.dataset.theme=settings.theme==='system'?(systemDark?'dark':'light'):settings.theme;el.dataset.textSize=settings.textSize;el.dataset.density=settings.density;el.dataset.accent=settings.accent;el.dataset.motion=settings.motion;try{localStorage.setItem('appearance',JSON.stringify(settings));}catch{}},[settings,systemDark]);
 const update=patch=>setSettings(prev=>normalizeAppearance({...prev,...patch}));
 return <Context.Provider value={{settings,update,reset:()=>setSettings({...defaults})}}>{children}<div className="screen-dimmer" aria-hidden="true" style={{opacity:1-settings.brightness/100}}/></Context.Provider>;
}
export const useAppearance=()=>useContext(Context);
