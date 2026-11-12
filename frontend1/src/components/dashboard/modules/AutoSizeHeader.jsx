import React, { useLayoutEffect, useRef } from "react";

export default function AutoSizeHeader({ value, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const element = ref.current;
    const resize = () => {
      element.style.height = "0px";
      element.style.height = `${element.scrollHeight + 2}px`;
    };
    resize();
    let width = element.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const next = element.getBoundingClientRect().width;
      if (next !== width) { width = next; resize(); }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);
  return <textarea {...props} ref={ref} rows={1} value={value} className="training-table-header-input training-table-header-input--wrap" />;
}
