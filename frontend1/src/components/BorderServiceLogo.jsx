import React from "react";

import officialLogoUrl from "../assets/kyrgyzstan-border-service.svg";

export default function BorderServiceLogo({ compact = false, large = false }) {
  const className = [
    "service-logo",
    compact ? "service-logo--compact" : "",
    large ? "service-logo--large" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={className}>
      <img alt="Логотип Пограничной службы Кыргызстана" src={officialLogoUrl} />
    </span>
  );
}
