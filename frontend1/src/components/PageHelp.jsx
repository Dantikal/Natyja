import {createPortal} from "react-dom";
import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n.jsx";
import { pageHelp } from "../data/pageHelp.js";
import usePageScrollReset from "../hooks/usePageScrollReset.js";

export default function PageHelp({ page }) {
  usePageScrollReset(page);
  const { language } = useLanguage();
  const dialog = useRef(null);
  const [tableOpen, setTableOpen] = useState(false);
  const ru = language === "ru";
  const help = pageHelp[page] || pageHelp.home;
  useEffect(() => { dialog.current?.close(); }, [page]);
  return <>
    {createPortal(<button className="page-help-trigger" type="button" aria-label={ru ? "Помощь по этой странице" : "Бул барак боюнча жардам"} title={ru ? "Что можно делать на этой странице?" : "Бул баракта эмне кылса болот?"} onClick={() => {
      setTableOpen([...document.querySelectorAll(".table-wrap table")].some((table) => table.getClientRects().length > 0));
      dialog.current.showModal();
    }}>?</button>, document.body)}
    <dialog ref={dialog} className="page-help" aria-labelledby="page-help-title" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <header><span>{ru ? "Помощь по странице" : "Барак боюнча жардам"}</span><button type="button" aria-label={ru ? "Закрыть помощь" : "Жардамды жабуу"} onClick={() => dialog.current.close()}>✕</button></header>
      <h2 id="page-help-title">{help[ru ? 0 : 1]}</h2>
      <p>{help[ru ? 2 : 3]}</p>
      {tableOpen ? <section><h3>{ru ? "Работа с открытой таблицей" : "Ачык таблица менен иштөө"}</h3><p>{ru ? "Нажмите доступную ячейку и введите данные. Серый текст — подсказка: он исчезает при вводе. Для перемещения по широкой таблице используйте закреплённые ползунки. «Сохранить» сохраняет изменения, «Отправить» передаёт документ получателю; перед отправкой проверьте данные. Ячейки архивной копии доступны только для просмотра." : "Жеткиликтүү уячаны басып, маалымат киргизиңиз. Боз текст — кеңеш: маалымат киргизгенде жоголот. Кең таблицада жылуу үчүн бекитилген жылдыргычтарды колдонуңуз. «Сактоо» өзгөртүүлөрдү сактайт, «Жөнөтүү» документти алуучуга өткөрөт; жөнөтүүдөн мурун маалыматтарды текшериңиз. Архивдик көчүрмөнүн уячалары көрүү үчүн гана жеткиликтүү."}</p></section> : null}
      <section><h3>{ru?'Управление с клавиатуры':'Клавиатура менен башкаруу'}</h3><p>{ru?'Tab / Shift+Tab — переход между элементами; Enter / пробел — нажать кнопку; Alt+M — меню; ↑ / ↓, Home / End — пункты меню; Alt+1 — содержимое; Alt+H — помощь; Alt+, — настройки; Esc — закрыть меню или окно.':'Tab / Shift+Tab — элементтерге өтүү; Enter / боштук — баскычты басуу; Alt+M — меню; ↑ / ↓, Home / End — меню пункттары; Alt+1 — мазмун; Alt+H — жардам; Alt+, — жөндөөлөр; Esc — жабуу.'}</p></section>
      <aside>{ru ? "Доступные кнопки зависят от вашей роли. Сохраняйте изменения перед выходом из документа. Для возврата используйте «Назад»." : "Жеткиликтүү баскычтар ролуңузга жараша болот. Документтен чыгуудан мурун өзгөртүүлөрдү сактаңыз. Кайтуу үчүн «Артка» баскычын колдонуңуз."}</aside>
      <footer><button type="button" onClick={() => dialog.current.close()}>{ru ? "Понятно" : "Түшүнүктүү"}</button></footer>
    </dialog>
  </>;
}
