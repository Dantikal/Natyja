import { T, useLanguage } from "../i18n.jsx";
import React, { useRef, useState } from "react";
import { defaults, readPreferences, savePreferences } from "../preferences.js";
import { unlockMessageAudio, playMessageSound } from "../utils/messageSound.js";

export default function SiteSettings() {
  const { language, setLanguage, t } = useLanguage();
  const dialog = useRef(null);
  const [settings, setSettings] = useState(readPreferences);
  const [audioError,setAudioError]=useState("");
  const [audioLoading,setAudioLoading]=useState(false);
  const update = (next) => {setSettings(next);savePreferences(next);};
  const uploadTone=async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    setAudioError('');
    if(!(file.type.startsWith('audio/')||/\.(mp3|mpeg|mpga|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name))||file.size>1024*1024){setAudioError(language==='ru'?'Выберите аудиофайл до 1 МБ.':'1 МБ чейин аудиофайл тандаңыз.');return;}
    setAudioLoading(true);
    try {
      const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(/\.(mpeg|mpga)$/i.test(file.name)?new Blob([file],{type:'audio/mpeg'}):file);});
      await new Promise((resolve,reject)=>{
        const audio=new Audio();
        const timer=setTimeout(()=>{audio.removeAttribute('src');reject(new Error('timeout'));},10000);
        audio.onloadedmetadata=()=>{clearTimeout(timer);resolve();};
        audio.onerror=()=>{clearTimeout(timer);reject(new Error('unsupported'));};
        audio.preload='metadata';audio.src=source;audio.load();
      });
      window.localStorage.setItem('munara:notification-audio',source);
      update({...settings,notificationTone:'custom',customToneName:file.name});
    }catch{setAudioError(language==='ru'?'Не удалось сохранить или прочитать аудио. Попробуйте короткий MP3.':'Аудио сакталган жок. Кыска MP3 тандаңыз.');}finally{setAudioLoading(false);}
  };
  return <>
    <button className="site-settings-trigger" type="button" onClick={() => {setSettings(readPreferences());dialog.current.showModal();}}><T>{"⚙ Настройки"}</T></button>
    <dialog className="site-settings" ref={dialog} aria-labelledby="site-settings-title" onClick={(event) => {if (event.target === dialog.current) dialog.current.close();}}>
      <header><h2 id="site-settings-title"><T>Настройки сайта</T></h2><button type="button" aria-label={t("Закрыть настройки")} onClick={() => dialog.current.close()}>✕</button></header>
      <section className="settings-section"><h3>{language==='ru'?'Язык и оформление':'Тил жана көрүнүш'}</h3><label><T>Язык</T><select value={language} onChange={(event) => setLanguage(event.target.value)}>
        <option value="ky">Кыргызча</option><option value="ru">Русский</option>
      </select></label>
      <p><T>{"Ваш выбор сохраняется в этом браузере."}</T></p>
      <label><T>{"Оформление"}</T><select value={settings.theme} onChange={(e) => update({ ...settings, theme: e.target.value })}>
        <option value="green"><T>{"Зелёное"}</T></option><option value="blue"><T>{"Синее"}</T></option><option value="light"><T>{"Светлое"}</T></option>
      </select></label>
      </section><section className="settings-section"><h3>{language==='ru'?'Звуки и уведомления':'Үндөр жана билдирүүлөр'}</h3><label className="site-settings-check"><input type="checkbox" checked={settings.sound} onChange={(e) => update({ ...settings, sound: e.target.checked })} />{language === 'ru' ? 'Звук интерфейса и переходов' : 'Интерфейс жана өтүүлөрдүн үнү'}</label>
      <label className="site-settings-check"><input type="checkbox" checked={settings.notificationSound} onChange={(e) => update({ ...settings, notificationSound: e.target.checked })}/>{language === 'ru' ? 'Звук уведомлений' : 'Билдирүүлөрдүн үнү'}</label>
      <label>{language==='ru'?'Мелодия уведомления':'Билдирүүнүн обону'}<select value={settings.notificationTone} onChange={e=>update({...settings,notificationTone:e.target.value})}>
        <option value="bell">{language==='ru'?'По умолчанию — тыннн':'Демейки — тыннн'}</option>
        <option value="chime">{language==='ru'?'Перезвон':'Коңгуроо'}</option><option value="soft">{language==='ru'?'Мягкий сигнал':'Жумшак үн'}</option>
        {settings.customToneName&&<option value="custom">{settings.customToneName}</option>}
      </select></label>
      <label>{language==='ru'?'Добавить свою мелодию (до 1 МБ, звучат первые 5 секунд)':'Өз обонуңуз (1 МБ чейин, биринчи 5 секунд)'}<input type="file" accept="audio/*,.mp3,.mpeg,.mpga,.wav,.ogg,.m4a,.aac,.flac" disabled={audioLoading} onChange={uploadTone}/></label>
      {audioLoading&&<p role="status">{language==='ru'?'Добавляем мелодию…':'Обон кошулууда…'}</p>}
      {settings.customToneName&&<div className="custom-tone-preview"><strong>{language==='ru'?'Добавлен файл: ':'Кошулган файл: '}{settings.customToneName}</strong><audio controls preload="none" src={window.localStorage.getItem('munara:notification-audio')||undefined}/></div>}
      {audioError&&<p role="alert" className="form-error">{audioError}</p>}
      {settings.customToneName&&<button type="button" onClick={()=>{window.localStorage.removeItem('munara:notification-audio');update({...settings,notificationTone:'bell',customToneName:''});}}>{language==='ru'?'Удалить свою мелодию':'Өз обонун өчүрүү'}</button>}
      <button type="button" disabled={!settings.notificationSound} onClick={() => { unlockMessageAudio(); playMessageSound(`preview:${Date.now()}`); }}>{language === 'ru' ? '🔊 Проверить звук уведомления' : '🔊 Билдирүүнүн үнүн текшерүү'}</button>
      </section><section className="settings-section"><h3>{language==='ru'?'Интерфейс':'Интерфейс'}</h3><label className="site-settings-check"><input type="checkbox" checked={settings.motion} onChange={(e) => update({ ...settings, motion: e.target.checked })} /><T>{"Анимации и декоративные эффекты"}</T></label>
      <label className="site-settings-check"><input type="checkbox" checked={settings.largeText} onChange={(e) => update({ ...settings, largeText: e.target.checked })} /><T>{"Крупный текст интерфейса"}</T></label>
      <p><T>{"Звук в аудио и видео управляется отдельно в проигрывателе."}</T></p>
      </section><footer><button type="button" onClick={() => update({ ...defaults })}><T>{"Сбросить"}</T></button><button type="button" onClick={() => dialog.current.close()}><T>{"Готово"}</T></button></footer>
    </dialog>
  </>;
}
