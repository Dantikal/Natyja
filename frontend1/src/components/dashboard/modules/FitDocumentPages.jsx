import React, { useLayoutEffect, useRef } from 'react';

// Keep the paper layout intact while fitting it into the available screen width.
export default function FitDocumentPages({ children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const host = ref.current;
    const fit = () => {
      const width = host.clientWidth;
      if (!width) return;
      host.querySelectorAll('.monthly-analysis-page').forEach(page => {
        const scale = Math.min(1, width / page.offsetWidth);
        page.style.zoom = String(scale);
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    return () => observer.disconnect();
  }, [children]);
  return <div ref={ref} className="fit-document-pages">{children}</div>;
}
