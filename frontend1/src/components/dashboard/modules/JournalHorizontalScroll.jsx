import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../../i18n.jsx";

export default function JournalHorizontalScroll({ scrollRef, tableRef, showTop = true }) {
  const [position, setPosition] = useState(null);
  const { language } = useLanguage();
  const bars = useRef({});
  useLayoutEffect(() => {
    if (!position) return;
    Object.values(bars.current).forEach((bar) => {
      if (bar && Math.abs(bar.scrollLeft - position.value) > 0.5) bar.scrollLeft = position.value;
    });
  }, [position]);

  useEffect(() => {
    const container = scrollRef.current;
    const table = tableRef.current;
    if (!container || !table) return undefined;
    let frame;
    const update = () => {
      const bounds = container.getBoundingClientRect();
      const tableBounds = table.getBoundingClientRect();
      const contentBounds = container.closest(".dashboard-content")?.getBoundingClientRect();
      const visibleTop = Math.max(8, (contentBounds?.top || 0) + 4);
      const visibleBottom = Math.min(window.innerHeight, contentBounds?.bottom ?? window.innerHeight);
      const left = Math.max(12, bounds.left);
      const right = Math.min(window.innerWidth - 12, bounds.right);
      const maximum = container.scrollWidth - container.clientWidth;
      setPosition(maximum > 0 && right - left > 100 &&
        tableBounds.top < visibleBottom - 24 && tableBounds.bottom > visibleTop + 24
        ? { left, width: right - left, maximum, value: container.scrollLeft, top: Math.max(visibleTop, bounds.top) }
        : null);
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(container);
    observer.observe(table);
    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [scrollRef, tableRef]);

  if (!position) return null;
  return createPortal(
    <>{(showTop ? ["top", "bottom"] : ["bottom"]).map((edge) => <div key={edge} className={`journal-horizontal-scroll journal-horizontal-scroll--${edge}`} style={{ left: position.left, width: position.width, ...(edge === "top" ? { top: position.top, bottom: "auto" } : {}) }}
        ref={(bar) => { bars.current[edge] = bar; }}
        role="region"
        tabIndex={0}
        aria-label={language === "ru" ? `Прокрутка таблицы ${edge === "top" ? "сверху" : "снизу"}` : `Таблицаны ${edge === "top" ? "үстүнөн" : "астынан"} жылдыруу`}
        onScroll={(event) => {
          const value = event.currentTarget.scrollLeft;
          if (scrollRef.current && Math.abs(scrollRef.current.scrollLeft - value) > 0.5) {
            scrollRef.current.scrollLeft = value;
            setPosition((current) => current ? { ...current, value } : current);
          }
        }}
      >
      <div aria-hidden="true" style={{ width: `calc(100% + ${position.maximum}px)`, height: 1 }} />
    </div>)}</>,
    document.body
  );
}
