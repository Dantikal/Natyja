import {useAppearance} from '../context/AppearanceContext';
import {useLang} from '../context/LanguageContext';
export default function Settings(){
 const {settings,update,reset}=useAppearance();const {tr,lang,setLang}=useLang();
 const choices=(key,items)=><div className="appearance-choices">{items.map(([value,title])=><button key={value} type="button" aria-pressed={settings[key]===value} onClick={()=>update({[key]:value})}>{tr(title)}</button>)}</div>;
 return <main className="container settings-page"><div className="page-title-row"><div><h1>{tr('Настройки')}</h1><p className="account-help">{tr('Внешний вид сохраняется на этом устройстве.')}</p></div></div>
 <section className="settings-card"><h2>{tr('Тема оформления')}</h2>{choices('theme',[['light','Дневная'],['dark','Ночная'],['system','Как на устройстве']])}</section>
 <section className="settings-card"><div className="settings-label"><label htmlFor="brightness">{tr('Яркость сайта')}</label><output htmlFor="brightness">{settings.brightness}%</output></div><input id="brightness" type="range" min="70" max="100" step="1" value={settings.brightness} onChange={e=>update({brightness:Number(e.target.value)})}/><p className="account-help">{tr('Меняется только яркость сайта, а не экрана телефона.')}</p></section>
 <section className="settings-card"><h2>{tr('Размер текста')}</h2>{choices('textSize',[['normal','Обычный'],['large','Крупный']])}<h2>{tr('Плотность интерфейса')}</h2>{choices('density',[['comfortable','Свободная'],['compact','Компактная']])}</section>
 <section className="settings-card"><h2>{tr('Цвет акцента')}</h2>{choices('accent',[['slate','Графитовый'],['blue','Синий'],['teal','Бирюзовый']])}<h2>{tr('Анимация')}</h2>{choices('motion',[['system','Как на устройстве'],['reduced','Уменьшить движение']])}</section>
 <section className="settings-card"><h2>{tr('Язык интерфейса')}</h2><div className="appearance-choices"><button aria-pressed={lang==='ru'} onClick={()=>setLang('ru')}>Русский</button><button aria-pressed={lang==='ky'} onClick={()=>setLang('ky')}>Кыргызча</button></div></section>
 <section className="settings-card"><h2>{tr('Звук новых задач')}</h2><div className="appearance-choices"><button aria-pressed={settings.sound} onClick={()=>update({sound:true})}>{tr('Включён')}</button><button aria-pressed={!settings.sound} onClick={()=>update({sound:false})}>{tr('Выключен')}</button></div><p className="account-help">{tr('Уведомления работают, пока сайт открыт. Для звука сначала нажмите любую кнопку на сайте.')}</p></section>
 <button className="btn-secondary" onClick={reset}>{tr('Сбросить оформление')}</button>
 </main>;
}
