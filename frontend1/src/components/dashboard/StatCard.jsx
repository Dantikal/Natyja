import React from "react";

export default function StatCard({
  label,
  value,
  subtext,
  tone = "neutral",
  onClick,
}) {
  const content = (
    <>
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">{value}</strong>
      {subtext && <span className="stat-card__subtext">{subtext}</span>}
    </>
  );

  if (onClick) {
    return (
      <button className={`stat-card stat-card--${tone} stat-card--clickable`} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <article className={`stat-card stat-card--${tone}`}>{content}</article>;
}
