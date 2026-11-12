import React from "react";

const UNIT_KINDS = {
  checkpoint: new Set(["2031", "2032"]),
  drone: new Set(["2055", "2056"]),
  special: new Set(["2051", "2053"]),
  support: new Set(["2063", "2064", "2065"]),
  academy: new Set(["КЖжАККДБ"]),
  resort: new Set(["ЧАП"]),
};

const KIND_LABELS = {
  checkpoint: "КПП",
  drone: "БПЛА",
  special: "Спецназ",
  support: "Обеспечение",
  academy: "Академия",
  resort: "Пансионат",
  military: "Войсковая часть",
};

export const getMilitaryUnitKind = (unitNumber) => {
  const normalized = String(unitNumber || "").trim();
  return Object.entries(UNIT_KINDS).find(([, units]) => units.has(normalized))?.[0] || "military";
};

function IconDrawing({ kind }) {
  if (kind === "checkpoint") return <><path d="M4 19V8m16 11V8M3 8h18M7 8V5h10v3M6 14h12" /><path d="m9 11 3 3 3-3" /></>;
  if (kind === "drone") return <><circle cx="6" cy="7" r="3" /><circle cx="18" cy="7" r="3" /><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="m8 9 2 2h4l2-2m-8 6 2-2h4l2 2M12 11v-3m0 5v3" /></>;
  if (kind === "special") return <><path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7l-8-4Z" /><circle cx="12" cy="11" r="3" /><path d="M12 6v2m0 6v2m-5-5h2m6 0h2" /></>;
  if (kind === "support") return <><path d="M3 9h12v9H3zM15 12h3l3 3v3h-6z" /><circle cx="7" cy="19" r="2" /><circle cx="18" cy="19" r="2" /><path d="M6 6h6m-3-3v6" /></>;
  if (kind === "academy") return <><path d="m3 9 9-5 9 5-9 5-9-5Z" /><path d="M6 12v5m4-3v5m4-5v5m4-7v5M4 20h16M21 9v6" /></>;
  if (kind === "resort") return <><circle cx="17" cy="6" r="3" /><path d="M3 18h18M5 18v-5h14v5M7 13V9h5v4m2 0c0-3 2-5 5-5" /></>;
  return <><path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7l-8-4Z" /><path d="m12 7 1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4L12 7Z" /></>;
}

export default function MilitaryUnitIcon({ unitNumber }) {
  const kind = getMilitaryUnitKind(unitNumber);
  return <span className={`military-unit-icon military-unit-icon--${kind}`} title={KIND_LABELS[kind]}>
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><IconDrawing kind={kind} /></svg>
  </span>;
}
