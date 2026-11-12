import React from "react";

export default function ChartCard({ title, subtitle, children, wide = false }) {
  return (
    <article className={`chart-card${wide ? " chart-card--wide" : ""}`}>
      <header className="chart-card__header">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <div className="chart-card__body">{children}</div>
    </article>
  );
}
