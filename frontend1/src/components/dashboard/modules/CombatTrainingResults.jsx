import JournalSubjectHistory from "./JournalSubjectHistory.jsx";
import {useLanguage as useCopyLanguage} from "../../../i18n.jsx";
import { moduleNavigationKey } from "../../../utils/moduleNavigation.js";
import JournalHorizontalScroll from "./JournalHorizontalScroll.jsx";
import ResultSamples from "./ResultSamples.jsx";
import StudyNumberFooter from "./StudyNumberFooter.jsx";
import { notifySave } from "../../../utils/saveFeedback.js";
import { T } from "../../../i18n.jsx";
import { useHistoryState } from "../../../hooks/useHistoryState.js";
import React, { useState, useEffect, useRef } from "react";

import {
  createThematicAccountSubmission,
  deleteThematicAccountSubmission,
  forwardThematicAccountSubmission,
  getThematicAccountSubmissions,
} from "../../../api/dashboard.js";
import { getApiErrorMessage } from "../../../api/errors.js";
import {
  OUTPOSTS_BY_MILITARY_UNIT,
  formatOutpostName,
} from "../../../data/militaryUnits.js";
import useDocumentHistory from "../../../hooks/useDocumentHistory.js";
import { confirmDocumentSend } from "../../../utils/confirmDocumentSend.js";
import { getDocumentRegistrationCode } from "../../../utils/documentRegistration.js";
import SubmissionForwardDialog from "./SubmissionForwardDialog.jsx";
import SubmissionEditPermissionButton from "./SubmissionEditPermissionButton.jsx";
import MilitaryUnitIcon from "./MilitaryUnitIcon.jsx";

const EMPTY_ARRAY = [];
const STORAGE_KEY = "combat-training-results-custom-periods";
const HIDDEN_DEFAULT_PERIOD_TITLES = new Set(["1-ай", "1 ай"]);
const OBSERVATION_SECTION_ID = "observation";
const INSPECTION_SECTION_ID = "inspection";
const OBSERVATION_MONTHLY_DEADLINE_DAY = 29;
const SIGNATURE_SLOTS = [
  { id: "captain", top: 318, buttonTop: 330 },
  { id: "lieutenant", top: 405, buttonTop: 417 },
];
const DEFAULT_DOCUMENT_TITLE =
  "20___ аскер бөлүгүнүн ______ чек ара заставасынын (топ, бөлүкчө, взвод, рота)\nЧек ара тактикасы боюнча көзөмөл сабагынын\nВЕДОМОСТУ";

const getLatestResultSubmission = (submissions = []) =>
  [...submissions].sort(
    (left, right) =>
      new Date(right.updatedAt || right.createdAt) -
      new Date(left.updatedAt || left.createdAt)
  )[0] || null;

const getObservationMonthlyDeadline = (now) => {
  const current = new Date(now);
  let deadline = new Date(
    current.getFullYear(),
    current.getMonth(),
    OBSERVATION_MONTHLY_DEADLINE_DAY,
    23,
    59,
    59,
    999
  );

  if (current.getTime() > deadline.getTime()) {
    deadline = new Date(
      current.getFullYear(),
      current.getMonth() + 1,
      OBSERVATION_MONTHLY_DEADLINE_DAY,
      23,
      59,
      59,
      999
    );
  }

  return deadline;
};

const isObservationSubmittedThisMonth = (submission, now) => {
  const sentAt = new Date(
    submission?.updatedAt || submission?.createdAt || ""
  ).getTime();
  if (!Number.isFinite(sentAt) || sentAt > now) return false;

  const deadline = getObservationMonthlyDeadline(now);
  const previousDeadline = new Date(
    deadline.getFullYear(),
    deadline.getMonth() - 1,
    OBSERVATION_MONTHLY_DEADLINE_DAY,
    23,
    59,
    59,
    999
  ).getTime();

  return sentAt > previousDeadline;
};

const formatObservationMonthlyCountdown = (now, language = "ru") => {
  const remainingSeconds = Math.max(
    0,
    Math.ceil((getObservationMonthlyDeadline(now).getTime() - now) / 1000)
  );
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  return `${days}${language === "ky" ? " күн" : "д"} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
};

const ObservationMonthlySubmissionStatus = ({ submission, now }) => {
  const {language}=useCopyLanguage();
  const isSubmitted = isObservationSubmittedThisMonth(submission, now);

  return (
    <span className="results-monthly-status-group">
      <span
        className={`results-monthly-status results-monthly-status--${
          isSubmitted ? "sent" : "missing"
        }`}
      >
        <T>{isSubmitted ? "Аткарылды" : "Аткарылган эмес"}</T>
      </span>
      <span className="results-monthly-countdown">{language === "ru" ? "До 29 числа: " : "29уна чейин: "}{formatObservationMonthlyCountdown(now, language)}
      </span>
    </span>
  );
};

const getInspectionReportingCycle = (now) => {
  const current = new Date(now);
  const year = current.getFullYear();
  const month = current.getMonth();

  if (month >= 9) {
    return {
      startedAt: new Date(year, 9, 1, 0, 0, 0, 0),
      endsAt: new Date(year + 1, 3, 1, 0, 0, 0, 0),
      nextMonthLabel: "апреля",
    };
  }

  if (month >= 3) {
    return {
      startedAt: new Date(year, 3, 1, 0, 0, 0, 0),
      endsAt: new Date(year, 9, 1, 0, 0, 0, 0),
      nextMonthLabel: "октября",
    };
  }

  return {
    startedAt: new Date(year - 1, 9, 1, 0, 0, 0, 0),
    endsAt: new Date(year, 3, 1, 0, 0, 0, 0),
    nextMonthLabel: "апреля",
  };
};

const isInspectionSubmittedThisCycle = (submission, now) => {
  const sentAt = new Date(
    submission?.updatedAt || submission?.createdAt || ""
  ).getTime();
  if (!Number.isFinite(sentAt) || sentAt > now) return false;

  return sentAt >= getInspectionReportingCycle(now).startedAt.getTime();
};

const formatInspectionCycleCountdown = (now) => {
  const remainingSeconds = Math.max(
    0,
    Math.ceil((getInspectionReportingCycle(now).endsAt.getTime() - now) / 1000)
  );
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  return `${days}д ${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
};

const InspectionReportingStatus = ({ submission, now }) => {
  const isSubmitted = isInspectionSubmittedThisCycle(submission, now);
  const cycle = getInspectionReportingCycle(now);

  return (
    <span className="results-cycle-status-group">
      <span
        className={`results-cycle-status results-cycle-status--${
          isSubmitted ? "sent" : "missing"
        }`}
      >
        <T>{isSubmitted ? "Аткарылды" : "Аткарылган эмес"}</T>
      </span>
      <span className="results-cycle-countdown"><T>{"До 1 "}</T>{cycle.nextMonthLabel}: {formatInspectionCycleCountdown(now)}
      </span>
    </span>
  );
};
const PHYSICAL_TRAINING_DOCUMENT_TITLE =
  "20___ аскер бөлүгүнүн ______  чек ара заставасынын\nДене тарбия даярдыгы боюнча көзөмөл сабагынын\nВЕДОМОСТУ";
const SHOOTING_TRAINING_DOCUMENT_TITLE =
  "20___ аскер бөлүгүнүн ______  чек ара заставасынын (топ, бөлүкчө, взвод, рота)\nОк атуу даярдыгы боюнча көзөмөл сабагынын\nВЕДОМОСТУ";
const LINE_TRAINING_DOCUMENT_TITLE =
  "20___ аскер бөлүгүнүн ______  чек ара заставасынын (топ, бөлүкчө, взвод, рота)\nСаптык даярдоо боюнча көзөмөл сабагынын\nВЕДОМОСТУ";
const KOJ_DOCUMENT_TITLE =
  '20__аскер бөлүгүнүн достук чек ара заставасынын күжүрмөн ок атуусунун жыйынтыгы 20__ ж. "20" март';
const DEFAULT_TABLE_FOOTER = `Жалпы тапшыргандар: __ адам __ %
Анын ичинен:
      -   "эң жакшы"                  __ адам __ %;
      -   "жакшы"                     __ адам __ %;
      -   "канааттандырарлык"         __ адам __ %;
      -   "канааттандыр-к эмес"       __ адам __ %.
Аткарды __ адам __ %
Жалпы баа __ (________________________)

Текшерүүчүлөр:

Окуу номери №

капитан                         А.А. Асанов

Окуу номери №

лейтенант                       Д.А. Сайфудинов`;

const INSPECTION_SECOND_SUMMARY_FOOTER = `-

- күжүрмөн даярдоо боюнча «эң жакшы» баа алган бөлүкчө жана бөлүкчө - жок

- күжүрмөн даярдоо боюнча «канааттандырарлык эмес» баа алган бөлүкчө – 1 бөлүкчө, бөлүкчө командири
сержант Асанов А.А.`;

const INSPECTION_BP_FIRST_FOOTER = `20___ аскер бөлүгүнүн ______ чаз башчысы


капитан                         Асанов А.А.`;

const customDocumentColumns = [
  { key: "number", label: "№", width: 50 },
  { key: "personalNumber", label: "Өздүк номуру", width: 100 },
  { key: "ticketNumber", label: "Билет №", width: 110 },
  { key: "question1", label: "1-суроо", width: 120 },
  { key: "answer1", label: "Жообу", width: 120 },
  { key: "question2", label: "2-суроо", width: 120 },
  { key: "answer2", label: "Жообу", width: 120 },
  { key: "question3", label: "3-суроо", width: 120 },
  { key: "answer3", label: "Жообу", width: 120 },
  { key: "totalGrade", label: "Жалпы баа", width: 80 },
  { key: "note", label: "Эскертме", width: 120 },
];

const createEmptyCustomRows = () =>
  Array.from({ length: 10 }, (_, i) => ({
    number: i + 1,
    personalNumber: "",
    ticketNumber: "",
    question1: "",
    answer1: "",
    question2: "",
    answer2: "",
    question3: "",
    answer3: "",
    totalGrade: "",
    note: "",
  }));

export const createCustomTable = (title, rows = createEmptyCustomRows()) => ({
  title,
  columns: customDocumentColumns,
  rows,
});

const kojBaseColumns = [
  { key: "number", label: "№", width: 58 },
  { key: "personalNumber", label: "Өздүк номуру", width: 150 },
  { key: "tacticalAction", label: "Тактикалык кыймыл аракетине", width: 170 },
  { key: "shooting", label: "Ок атуусуна", width: 130 },
  { key: "totalGrade", label: "Жалпы баа", width: 110 },
  { key: "note", label: "Эскертүү", width: 140 },
];

const createEmptyKojRow = (number, columns = kojBaseColumns) =>
  columns.reduce(
    (row, column) => ({
      ...row,
      [column.key]: column.key === "number" ? number : "",
    }),
    {}
  );

export const createKojTable = (title) => ({
  type: "kojResults",
  templateVersion: 3,
  title,
  columns: kojBaseColumns,
  headerRows: [],
  sectionColSpan: 2,
  rows: Array.from({ length: 10 }, (_, index) => createEmptyKojRow(index + 1)),
});

const inspectionSummaryColumns = [
  { key: "number", label: "к №", width: 50, readOnly: true },
  { key: "personalNumber", label: "Өздүк номери", width: 150 },
  { key: "tpv", label: "ТПВ", width: 85 },
  { key: "stp", label: "СТП", width: 85 },
  { key: "ogp", label: "ОГП", width: 85 },
  { key: "fp", label: "ФП", width: 85 },
  { key: "spec", label: "СПЕЦ", width: 85 },
  { key: "tp", label: "ТП", width: 85 },
  { key: "op", label: "ОП", width: 85 },
  { key: "stovu", label: "ОВУ", width: 90 },
  { key: "totalGrade", label: "Жалпы\nбаа", width: 90 },
  { key: "note", label: "Эскертме", width: 115 },
];

const createEmptyInspectionSummaryRow = (number) => ({
  number,
  personalNumber: "",
  tpv: "",
  stp: "",
  ogp: "",
  fp: "",
  spec: "",
  tp: "",
  op: "",
  stovu: "",
  totalGrade: "",
  note: "",
});

const createInspectionSummarySectionRow = (sectionTitle) => ({
  __isSection: true,
  sectionTitle,
});

const createInspectionSummaryRows = () => [
  ...Array.from({ length: 5 }, (_, index) => createEmptyInspectionSummaryRow(index + 1)),
  createInspectionSummarySectionRow("Чаз башкармалыгы үчүн:"),
  ...Array.from({ length: 8 }, (_, index) => createEmptyInspectionSummaryRow(index + 6)),
  createInspectionSummarySectionRow("1-бөлүмчө үчүн:"),
  ...Array.from({ length: 8 }, (_, index) => createEmptyInspectionSummaryRow(index + 14)),
  createInspectionSummarySectionRow("2-бөлүмчө үчүн:"),
  createEmptyInspectionSummaryRow(22),
];

const createInspectionSummaryTable = (title, rows = createInspectionSummaryRows()) => ({
  type: "inspectionSummary",
  templateVersion: 3,
  title,
  columns: inspectionSummaryColumns,
  headerRows: [
    [
      { key: "number", label: "к №" },
      { key: "personalNumber", label: "Өздүк номери" },
      { key: "tpv", label: "ТПВ" },
      { key: "stp", label: "СТП" },
      { key: "ogp", label: "ОГП" },
      { key: "fp", label: "ФП" },
      { key: "spec", label: "СПЕЦ" },
      { key: "tp", label: "ТП" },
      { key: "op", label: "ОП" },
      { key: "stovu", label: "ОВУ" },
      { key: "totalGrade", label: "Жалпы\nбаа" },
      { key: "note", label: "Эскертме" },
    ],
  ],
  sectionColSpan: 2,
  rows,
});

const inspectionSecondSummaryColumns = [
  { key: "number", label: "к/\n№", width: 48, readOnly: true },
  { key: "subdivision", label: "Бөлүкчөлөр", width: 115 },
  { key: "allAssessed", label: "Бардыгы\nбааланды", width: 82 },
  { key: "excellent", label: "эн\nжак.", width: 55 },
  { key: "good", label: "жак.", width: 55 },
  { key: "satisfactory", label: "канат", width: 55 },
  { key: "unsatisfactory", label: "канат\nэмес", width: 60 },
  { key: "bestDetachment", label: "Эң жакшы\nбөлүк-\nчө", width: 70 },
  { key: "bestDepartment", label: "Эң жакшы\nбөлүк-\nчө", width: 70 },
  { key: "badDetachment", label: "Канат эмес\nбөлүк-\nчө", width: 70 },
  { key: "badDepartment", label: "Канат эмес\nбөлүк-\nчө", width: 70 },
  { key: "officer", label: "оф.", width: 50 },
  { key: "ensign", label: "пр-к", width: 55 },
  { key: "sergeant", label: "серж-\nнт", width: 58 },
  { key: "soldier", label: "жоо-\nкер", width: 58 },
  { key: "preparedTotal", label: "Баары", width: 65 },
  { key: "classSpecialist", label: "Кл.\nадис", width: 65 },
  { key: "bestSportsman", label: "Мыкты\nспортчу", width: 75 },
  { key: "totalGrade", label: "Жалпы\nбаа", width: 75 },
];

const createEmptyInspectionSecondSummaryRow = (number, subdivision = "") => ({
  number,
  subdivision,
  allAssessed: "",
  excellent: "",
  good: "",
  satisfactory: "",
  unsatisfactory: "",
  bestDetachment: "",
  bestDepartment: "",
  badDetachment: "",
  badDepartment: "",
  officer: "",
  ensign: "",
  sergeant: "",
  soldier: "",
  preparedTotal: "",
  classSpecialist: "",
  bestSportsman: "",
  totalGrade: "",
});

const createCenteredSectionRow = (sectionTitle = "Негизги бөлүкчөлөр") => ({
  __isCenteredSection: true,
  sectionTitle,
});

const createInspectionSecondSummaryRows = () => [
  createEmptyInspectionSecondSummaryRow("1.", "Башкар-лык"),
  createEmptyInspectionSecondSummaryRow("", "Баары:"),
  createCenteredSectionRow("Негизги бөлүкчөлөр"),
  createEmptyInspectionSecondSummaryRow("1.", "1-бөлүкчө"),
  createEmptyInspectionSecondSummaryRow("2.", "2-бөлүкчө"),
  createEmptyInspectionSecondSummaryRow("3.", "3-бөлүкчө"),
  createEmptyInspectionSecondSummaryRow("", "Баары:"),
  { ...createEmptyInspectionSecondSummaryRow("", "Жыйынтыгы:"), __isSummary: true },
];

const createInspectionSecondSummaryTable = (title, rows = createInspectionSecondSummaryRows()) => ({
  type: "inspectionSecondSummary",
  title,
  columns: inspectionSecondSummaryColumns,
  footer: INSPECTION_SECOND_SUMMARY_FOOTER,
  headerRows: [
    [
      { key: "number", label: "к/\n№", rowSpan: 4 },
      { key: "subdivision", label: "Бөлүкчөлөр", rowSpan: 4 },
      { key: "trainingState", label: "Күжүрмөн даярдоонун абалы", colSpan: 5 },
      { key: "assessed", label: "Бааланды", colSpan: 4 },
      { key: "prepared", label: "Даярдалды", colSpan: 7 },
      { key: "totalGrade", label: "Жалпы\nбаа", rowSpan: 3 },
    ],
    [
      { key: "allAssessed", label: "Бардыгы\nбааланды", rowSpan: 2 },
      { key: "excellent", label: "эн\nжак.", rowSpan: 2 },
      { key: "good", label: "жак.", rowSpan: 2 },
      { key: "satisfactory", label: "канат", rowSpan: 2 },
      { key: "unsatisfactory", label: "канат\nэмес", rowSpan: 2 },
      { key: "bestAssessed", label: "Эң жакшы", colSpan: 2 },
      { key: "badAssessed", label: "Канат эмес", colSpan: 2 },
      { key: "bestPrepared", label: "Мыктылар", colSpan: 5 },
      { key: "classSpecialist", label: "Кл.\nадис", rowSpan: 2 },
      { key: "bestSportsman", label: "Мыкты\nспортчу", rowSpan: 2 },
    ],
    [
      { key: "bestDetachment", label: "бөлүк-\nчө" },
      { key: "bestDepartment", label: "бөлүк-\nчө" },
      { key: "badDetachment", label: "бөлүк-\nчө" },
      { key: "badDepartment", label: "бөлүк-\nчө" },
      { key: "officer", label: "оф." },
      { key: "ensign", label: "пр-к" },
      { key: "sergeant", label: "серж-\nнт" },
      { key: "soldier", label: "жоо-\nкер" },
      { key: "preparedTotal", label: "Баары" },
    ],
  ],
  rows,
});

const INSPECTION_BP_SECOND_FOOTER = `- күжүрмөн даярдоо боюнча «эң жакшы» баа алган бөлүкчө жана бөлүмчө __________________________;

- күжүрмөн даярдоо боюнча «канааттандырарлык эмес» баа алган бөлүмчө;
- 1 ЧАЗдын 1 бөлүмчөсү, бөлүмчөнүн командири сержант Асанов А.А.`;

const createBpSecondSummaryRows = () => [
  createEmptyInspectionSecondSummaryRow("1.", "Башкар."),
  createEmptyInspectionSecondSummaryRow("", "Баары:"),
  createCenteredSectionRow("Негизги бөлүкчөлөр"),
  createEmptyInspectionSecondSummaryRow("1.", "1-застава"),
  createEmptyInspectionSecondSummaryRow("2.", "2-застава"),
  createEmptyInspectionSecondSummaryRow("3.", "жана баш."),
  createEmptyInspectionSecondSummaryRow("", "Баары:"),
  createCenteredSectionRow("Кайтаруу жана камсыздоо бөлүкчөлөрү"),
  createEmptyInspectionSecondSummaryRow("1.", "Коменд-к\nрота"),
  createEmptyInspectionSecondSummaryRow("2.", "Камсыз\nвзв"),
  createEmptyInspectionSecondSummaryRow("3.", "Оңдоо. взв."),
  createEmptyInspectionSecondSummaryRow("4.", "жана баш."),
  createEmptyInspectionSecondSummaryRow("", "Баары:"),
  { ...createEmptyInspectionSecondSummaryRow("", "Жыйынтыгы:"), __isSummary: true },
];

const createBpSecondSummaryTable = (title, rows = createBpSecondSummaryRows()) => ({
  ...createInspectionSecondSummaryTable(title, rows),
  type: "inspectionBpSecondSummary",
  templateVersion: 1,
  footer: INSPECTION_BP_SECOND_FOOTER,
});

const bpMetricKeys = [
  "bestUnit",
  "bestCalculation",
  "officers",
  "warrantOfficers",
  "sergeants",
  "soldiers",
  "allBest",
  "classSpecialists",
  "bestSportsmen",
];

const bpFirstSummaryColumns = [
  { key: "number", label: "к/\n№", width: 40 },
  { key: "subdivision", label: "Бөлүкчөлөр", width: 110 },
  ...bpMetricKeys.flatMap((key) => [
    { key: `${key}Count`, label: "алынып", width: 30 },
    { key: `${key}Done`, label: "аткар", width: 30 },
    { key: `${key}Percent`, label: "%", width: 30 },
  ]),
];

const createEmptyBpFirstSummaryRow = (number, subdivision = "") => ({
  number,
  subdivision,
  ...bpMetricKeys.reduce((result, key) => ({
    ...result,
    [`${key}Count`]: "",
    [`${key}Done`]: "",
    [`${key}Percent`]: "",
  }), {}),
});

const createBpFirstSummaryRows = () => [
  createEmptyBpFirstSummaryRow("1.", "Башкар-дык"),
  createEmptyBpFirstSummaryRow("", "Баары:"),
  createCenteredSectionRow("Негизги бөлүкчөлөр"),
  createEmptyBpFirstSummaryRow("1.", "1-бөлүкчө"),
  createEmptyBpFirstSummaryRow("2.", "2-бөлүкчө"),
  createEmptyBpFirstSummaryRow("3.", "3-бөлүкчө"),
  createEmptyBpFirstSummaryRow("", "Баары:"),
  { ...createEmptyBpFirstSummaryRow("", "Жыйынтыгы:"), __isSummary: true },
];

const createBpFirstSummaryTable = (title, rows = createBpFirstSummaryRows()) => ({
  type: "inspectionBpFirstSummary",
  templateVersion: 3,
  title,
  columns: bpFirstSummaryColumns,
  footer: INSPECTION_BP_FIRST_FOOTER,
  signatureMode: "singleInline",
  headerRows: [
    [
      { key: "number", label: "к/\n№", rowSpan: 4 },
      { key: "subdivision", label: "Бөлүкчөлөр", rowSpan: 4 },
      { key: "prepared", label: "Даярдалды", colSpan: 27 },
    ],
    [
      { key: "bestUnit", label: "Мыкты\nбөлүкчө", colSpan: 3 },
      { key: "bestCalculation", label: "Мыкты\nэсеп,\nбөлүкчө", colSpan: 3 },
      { key: "bestPrepared", label: "Мыктылар", colSpan: 15 },
      { key: "classSpecialists", label: "Класстык\nадистер", colSpan: 3 },
      { key: "bestSportsmen", label: "Мыкты\nспортчу", colSpan: 3 },
    ],
    [
      { key: "bestUnitCount", label: "алын", rowSpan: 2, vertical: true },
      { key: "bestUnitDone", label: "атк", rowSpan: 2, vertical: true },
      { key: "bestUnitPercent", label: "%", rowSpan: 2, vertical: true },
      { key: "bestCalculationCount", label: "алын", rowSpan: 2, vertical: true },
      { key: "bestCalculationDone", label: "атк", rowSpan: 2, vertical: true },
      { key: "bestCalculationPercent", label: "%", rowSpan: 2, vertical: true },
      { key: "officers", label: "Офицерлер", colSpan: 3 },
      { key: "warrantOfficers", label: "Прапорщ-р", colSpan: 3 },
      { key: "sergeants", label: "Сержанттар", colSpan: 3 },
      { key: "soldiers", label: "Жоокерлер", colSpan: 3 },
      { key: "allBest", label: "Баары", colSpan: 3 },
      { key: "classSpecialistsCount", label: "алын", rowSpan: 2, vertical: true },
      { key: "classSpecialistsDone", label: "атк", rowSpan: 2, vertical: true },
      { key: "classSpecialistsPercent", label: "%", rowSpan: 2, vertical: true },
      { key: "bestSportsmenCount", label: "алын", rowSpan: 2, vertical: true },
      { key: "bestSportsmenDone", label: "атк", rowSpan: 2, vertical: true },
      { key: "bestSportsmenPercent", label: "%", rowSpan: 2, vertical: true },
    ],
    [
      { key: "officersCount", label: "алын", vertical: true },
      { key: "officersDone", label: "атк", vertical: true },
      { key: "officersPercent", label: "%", vertical: true },
      { key: "warrantOfficersCount", label: "алын", vertical: true },
      { key: "warrantOfficersDone", label: "атк", vertical: true },
      { key: "warrantOfficersPercent", label: "%", vertical: true },
      { key: "sergeantsCount", label: "алын", vertical: true },
      { key: "sergeantsDone", label: "атк", vertical: true },
      { key: "sergeantsPercent", label: "%", vertical: true },
      { key: "soldiersCount", label: "алын", vertical: true },
      { key: "soldiersDone", label: "атк", vertical: true },
      { key: "soldiersPercent", label: "%", vertical: true },
      { key: "allBestCount", label: "алын", vertical: true },
      { key: "allBestDone", label: "атк", vertical: true },
      { key: "allBestPercent", label: "%", vertical: true },
    ],
  ],
  rows,
});

const INSPECTION_BP_FIFTH_FOOTER = `(Кызмат орду, аты, жөнү, аскердик наам жана датасы)`;

const createBpFifthSummaryRows = () => [
  createEmptyBpFirstSummaryRow("1.", "Башкар-лык"),
  createEmptyBpFirstSummaryRow("", "Баары:"),
  createCenteredSectionRow("Негизги бөлүкчөлөр"),
  createEmptyBpFirstSummaryRow("1.", "1-застава"),
  createEmptyBpFirstSummaryRow("2.", "2-застава"),
  createEmptyBpFirstSummaryRow("3.", "ж.б."),
  createEmptyBpFirstSummaryRow("", "Баары:"),
  createCenteredSectionRow("Негизги эмес бөлүкчөлөр"),
  createEmptyBpFirstSummaryRow("1.", "Комен. рота"),
  createEmptyBpFirstSummaryRow("2.", "Камсыз взв."),
  createEmptyBpFirstSummaryRow("3.", "Оңдоо взв."),
  createEmptyBpFirstSummaryRow("4.", "ж.б."),
  createEmptyBpFirstSummaryRow("", "Баары:"),
  { ...createEmptyBpFirstSummaryRow("", "Жыйынтыгы:"), __isSummary: true },
];

const createBpFifthSummaryTable = (title, rows = createBpFifthSummaryRows()) => ({
  ...createBpFirstSummaryTable(title, rows),
  type: "inspectionBpFifthSummary",
  templateVersion: 1,
  footer: INSPECTION_BP_FIFTH_FOOTER,
  signatureMode: undefined,
});

const physicalTrainingColumns = [
  { key: "number", label: "к №", width: 50, readOnly: true },
  { key: "personalNumber", label: "Өздүк номуру", width: 220 },
  { key: "unit", label: "ж/тобу", width: 90 },
  { key: "exercise56Result", label: "жыйын.", width: 90 },
  { key: "exercise56Grade", label: "баасы", width: 95 },
  { key: "exercise9Result", label: "жыйын.", width: 90 },
  { key: "exercise9Grade", label: "баасы", width: 90 },
  { key: "exercise12Result", label: "жыйын.", width: 90 },
  { key: "exercise12Grade", label: "баасы", width: 90 },
  { key: "totalGrade", label: "Жалпы\nбаа", width: 90 },
  { key: "note", label: "Эскертме", width: 90 },
];

const createEmptyPhysicalRow = (number) => ({
  number,
  personalNumber: "",
  unit: "",
  exercise56Result: "",
  exercise56Grade: "",
  exercise9Result: "",
  exercise9Grade: "",
  exercise12Result: "",
  exercise12Grade: "",
  totalGrade: "",
  note: "",
});

const createPhysicalSectionRow = (sectionTitle) => ({
  __isSection: true,
  sectionTitle,
});

const createPhysicalTrainingRows = () => [
  ...Array.from({ length: 5 }, (_, index) => createEmptyPhysicalRow(index + 1)),
  createPhysicalSectionRow("Чаз башкармалыгы үчүн:"),
  ...Array.from({ length: 8 }, (_, index) => createEmptyPhysicalRow(index + 6)),
  createPhysicalSectionRow("1-бөлүмчө үчүн:"),
  ...Array.from({ length: 8 }, (_, index) => createEmptyPhysicalRow(index + 14)),
  createPhysicalSectionRow("2-бөлүмчө үчүн:"),
  createEmptyPhysicalRow(22),
];

export const createPhysicalTrainingTable = (title, rows = createPhysicalTrainingRows()) => ({
  type: "physicalTraining",
  title,
  columns: physicalTrainingColumns,
  sectionColSpan: 3,
  headerRows: [
    [
      { key: "number", label: "к №", rowSpan: 3 },
      { key: "personalNumber", label: "Өздүк номуру", rowSpan: 3 },
      { key: "unit", label: "ж/тобу", rowSpan: 3 },
      { key: "exercises", label: "Көнүгүүлөрдүн номуру жана аталышы", colSpan: 6 },
      { key: "totalGrade", label: "Жалпы\nбаа", rowSpan: 3 },
      { key: "note", label: "Эскертме", rowSpan: 3 },
    ],
    [
      { key: "exercise56", label: "Көнүгүү № 5,6\n(чабакча тартылуу,\nККК)", colSpan: 2 },
      { key: "exercise9", label: "Көнүгүү № 9\n(100 м чуркоо)", colSpan: 2 },
      { key: "exercise12", label: "Көнүгүү № 1,2\n(1,3 км чуркоо)", colSpan: 2 },
    ],
    [
      { key: "exercise56Result", label: "жыйын." },
      { key: "exercise56Grade", label: "баасы" },
      { key: "exercise9Result", label: "жыйын." },
      { key: "exercise9Grade", label: "баасы" },
      { key: "exercise12Result", label: "жыйын." },
      { key: "exercise12Grade", label: "баасы" },
    ],
  ],
  rows,
});

const shootingTrainingColumns = [
  { key: "number", label: "к №", width: 50, readOnly: true },
  { key: "personalNumber", label: "Өздүк номуру", width: 230 },
  { key: "exercisePmResult", label: "жыйын.", width: 90 },
  { key: "exercisePmGrade", label: "баасы", width: 90 },
  { key: "exerciseAkResult", label: "жыйын.", width: 90 },
  { key: "exerciseAkGrade", label: "баасы", width: 90 },
  { key: "exerciseCkkResult", label: "жыйын.", width: 90 },
  { key: "exerciseCkkGrade", label: "баасы", width: 90 },
  { key: "totalGrade", label: "Жалпы\nбаа", width: 90 },
  { key: "note", label: "Эскертме", width: 100 },
];

const createEmptyShootingRow = (number) => ({
  number,
  personalNumber: "",
  exercisePmResult: "",
  exercisePmGrade: "",
  exerciseAkResult: "",
  exerciseAkGrade: "",
  exerciseCkkResult: "",
  exerciseCkkGrade: "",
  totalGrade: "",
  note: "",
});

const createShootingSectionRow = (sectionTitle) => ({
  __isSection: true,
  sectionTitle,
});

const createShootingTrainingRows = () => [
  ...Array.from({ length: 5 }, (_, index) => createEmptyShootingRow(index + 1)),
  createShootingSectionRow("Чаз башкармалыгы үчүн:"),
  ...Array.from({ length: 8 }, (_, index) => createEmptyShootingRow(index + 6)),
  createShootingSectionRow("1-бөлүмчө үчүн:"),
  ...Array.from({ length: 8 }, (_, index) => createEmptyShootingRow(index + 14)),
  createShootingSectionRow("2-бөлүмчө үчүн:"),
];

export const createShootingTrainingTable = (title, rows = createShootingTrainingRows()) => ({
  type: "shootingTraining",
  title,
  columns: shootingTrainingColumns,
  sectionColSpan: 2,
  headerRows: [
    [
      { key: "number", label: "к №", rowSpan: 3 },
      { key: "personalNumber", label: "Өздүк номуру", rowSpan: 3 },
      { key: "exercises", label: "Көнүгүүлөрдүн номуру", colSpan: 6 },
      { key: "totalGrade", label: "Жалпы\nбаа", rowSpan: 3 },
      { key: "note", label: "Эскертме", rowSpan: 3 },
    ],
    [
      { key: "exercisePm", label: "1-ЧОАК\nПМ", colSpan: 2 },
      { key: "exerciseAk", label: "1-ЧОАК\nАК", colSpan: 2 },
      { key: "exerciseCkk", label: "1-ЧКК\nАК", colSpan: 2 },
    ],
    [
      { key: "exercisePmResult", label: "жыйын." },
      { key: "exercisePmGrade", label: "баасы" },
      { key: "exerciseAkResult", label: "жыйын." },
      { key: "exerciseAkGrade", label: "баасы" },
      { key: "exerciseCkkResult", label: "жыйын." },
      { key: "exerciseCkkGrade", label: "баасы" },
    ],
  ],
  rows,
});

const normalizeStoredPeriod = (period) => {
  if (period.subsectionId === "observation-stp" && period.table?.type === "lineTraining" && period.table.templateVersion !== 2) {
    return {
      ...period,
      table: createLineTrainingTable(period.table.title || period.title, period.table.rows || createLineTrainingRows()),
    };
  }

  if (period.subsectionId !== "observation-op" || period.table?.type !== "shootingTraining") {
    return period;
  }

  const hasOldColumns = period.table.columns?.some((column) =>
    column.key === "militaryName" || column.key === "fullName"
  );

  if (!hasOldColumns) {
    return period;
  }

  return {
    ...period,
    table: createShootingTrainingTable(
      period.table.title || period.title,
      (period.table.rows || []).map((row) =>
        row.__isSection
          ? row
          : {
              ...createEmptyShootingRow(row.number),
              personalNumber: row.personalNumber || "",
              exercisePmResult: row.exercisePmResult || "",
              exercisePmGrade: row.exercisePmGrade || "",
              exerciseAkResult: row.exerciseAkResult || "",
              exerciseAkGrade: row.exerciseAkGrade || "",
              exerciseCkkResult: row.exerciseCkkResult || "",
              exerciseCkkGrade: row.exerciseCkkGrade || "",
              totalGrade: row.totalGrade || "",
              note: row.note || "",
            }
      )
    ),
  };
};

const lineTrainingColumns = [
  { key: "number", label: "к/н\n№", width: 58, readOnly: true },
  { key: "personalNumber", label: "Өздүк номуру", width: 260 },
  { key: "positionGrade", label: "Сырткы көрүнүшүнө баа", width: 44 },
  { key: "weaponHandlingGrade", label: "Саптык уставды билүү деңгээлине баа", width: 44 },
  { key: "lineStep", label: "Саптык туруш", width: 44 },
  { key: "salute", label: "Саптан чыгуу", width: 44 },
  { key: "turns", label: "Ордунда бурулуу", width: 44 },
  { key: "movementTurns", label: "Кыймылда бурулуу", width: 44 },
  { key: "commanderApproach", label: "Аскердик саламдашуунун аткарылышы", width: 44 },
  { key: "withoutWeaponTotal", label: "Саптык басуу ылдамдыгы", width: 44 },
  { key: "rifleSling", label: "Башчыга келүү\nжана сапка кайтып туруу", width: 44 },
  { key: "weaponCommands", label: "Куралды курга  АЛ", width: 44 },
  { key: "weaponMoves", label: "Автоматты көкүрөккө - АЛ", width: 44 },
  { key: "weaponTurns", label: "Куралды аркага  АЛ", width: 44 },
  { key: "methodicGrade", label: "Методикалык\nдаярдыгына баа", width: 58 },
  { key: "overallGrade", label: "Саптык даярдыгы үчүн\nжалпы баасы", width: 58 },
  { key: "note", label: "Эскертме", width: 68 },
];

const createEmptyLineRow = (number) => ({
  number: `${number}.`,
  personalNumber: "",
  positionGrade: "",
  weaponHandlingGrade: "",
  lineStep: "",
  salute: "",
  turns: "",
  movementTurns: "",
  commanderApproach: "",
  withoutWeaponTotal: "",
  rifleSling: "",
  weaponCommands: "",
  weaponMoves: "",
  weaponTurns: "",
  methodicGrade: "",
  overallGrade: "",
  note: "",
});

const createLineTrainingRows = () =>
  Array.from({ length: 9 }, (_, index) => createEmptyLineRow(index + 1));

export const createLineTrainingTable = (title, rows = createLineTrainingRows()) => ({
  type: "lineTraining",
  templateVersion: 2,
  title,
  columns: lineTrainingColumns,
  headerRows: [
    [
      { key: "number", label: "к/н\n№", rowSpan: 3 },
      { key: "personalNumber", label: "Өздүк номуру", rowSpan: 3 },
      { key: "positionGrade", label: "Сырткы көрүнүшүнө баа", rowSpan: 3, vertical: true },
      { key: "weaponHandlingGrade", label: "Саптык уставды билүү деңгээлине баа", rowSpan: 3, vertical: true },
      { key: "actionGrade", label: "Саптык ыкмаларды аткаруу баасы", colSpan: 10 },
      { key: "methodicGrade", label: "Методикалык\nдаярдыгына баа", rowSpan: 3, vertical: true },
      { key: "overallGrade", label: "Саптык даярдыгы үчүн\nжалпы баасы", rowSpan: 3, vertical: true },
      { key: "note", label: "Эскертме", rowSpan: 3, vertical: true },
    ],
    [
      { key: "lineStep", label: "Саптык туруш", vertical: true },
      { key: "salute", label: "Саптан чыгуу", vertical: true },
      { key: "turns", label: "Ордунда бурулуу", vertical: true },
      { key: "movementTurns", label: "Кыймылда бурулуу", vertical: true },
      { key: "commanderApproach", label: "Аскердик саламдашуунун аткарылышы", vertical: true },
      { key: "withoutWeaponTotal", label: "Саптык басуу ылдамдыгы", vertical: true },
      { key: "rifleSling", label: "Башчыга келүү\nжана сапка кайтып туруу", vertical: true },
      { key: "weaponCommands", label: "Куралды курга  АЛ", vertical: true },
      { key: "weaponMoves", label: "Автоматты көкүрөккө - АЛ", vertical: true },
      { key: "weaponTurns", label: "Куралды аркага  АЛ", vertical: true },
    ],
    [
      { key: "withoutWeapon", label: "Куралсыз", colSpan: 6 },
      { key: "withWeapon", label: "Курал менен", colSpan: 4 },
    ],
  ],
  rows,
});

const getNestedSections = (section) => section?.sections || section?.subsections || EMPTY_ARRAY;

const hasSectionContent = (section) =>
  Boolean(section?.table || section?.periods?.length > 0 || getNestedSections(section).length > 0);

const SubmittedObservationTable = ({ subject, onBack }) => {
  const table = subject?.table || {};
  const columns = table.columns || [];
  const headerRows = table.headerRows || [];
  const rows = table.rows || [];
  const compactSummaryTypes = new Set([
    "inspectionSummary",
    "inspectionSecondSummary",
    "inspectionBpFirstSummary",
    "inspectionBpSecondSummary",
    "inspectionBpFifthSummary",
  ]);
  const isCompactSummary = compactSummaryTypes.has(table.type);
  const tableWidth = columns.reduce(
    (total, column) => total + (Number(column.width) || 80),
    0
  );

  return (
    <div className="module-table-view module-table-view--word">
      <button className="module-back-button" onClick={onBack} type="button"><T>{"Артка"}</T></button>
      <h2 className="module-table-title"><T>{table.title || subject?.periodTitle || subject?.subjectTitle}</T></h2>
      <div className="table-wrap submitted-result-table-wrap">
        <table
          className={`training-table submitted-result-table${isCompactSummary ? " submitted-result-table--compact" : ""}`}
          style={{ minWidth: `${tableWidth}px`, width: `max(100%, ${tableWidth}px)` }}
        >
          <colgroup>
            {columns.map((column) => (
              <col
                key={column.key}
                style={{ width: `${Number(column.width) || 80}px` }}
              />
            ))}
          </colgroup>
          <thead>
            {headerRows.length > 0 ? headerRows.map((headerRow, rowIndex) => (
              <tr key={`submitted-header-${rowIndex}`}>
                {headerRow.map((cell, cellIndex) => (
                  <th
                    colSpan={cell.colSpan || undefined}
                    key={cell.key || cellIndex}
                    rowSpan={cell.rowSpan || undefined}
                  >
                    <span><T>{cell.label}</T></span>
                  </th>
                ))}
              </tr>
            )) : (
              <tr>
                {columns.map((column) => <th key={column.key}><T>{column.label}</T></th>)}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              if (row.__isSection || row.__isCenteredSection) {
                return (
                  <tr key={`submitted-row-${rowIndex}`}>
                    <td colSpan={columns.length}>{row.sectionTitle}</td>
                  </tr>
                );
              }
              const shouldMergeSummaryLabel =
                (isCompactSummary && row.number === "" && Boolean(row.subdivision)) ||
                row.__isSummary ||
                row.subdivision === "Баары:";
              return (
                <tr key={`submitted-row-${rowIndex}`}>
                  {columns.map((column, columnIndex) => {
                    if (shouldMergeSummaryLabel && columnIndex === 0) {
                      return <td colSpan={2} key={column.key}>{row.subdivision || ""}</td>;
                    }
                    if (shouldMergeSummaryLabel && columnIndex === 1) {
                      return null;
                    }
                    return (
                      <td key={column.key}>
                        {Array.isArray(row[column.key])
                          ? row[column.key].join(" ")
                          : String(row[column.key] ?? "")}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {table.footer && <pre className="submitted-result-footer">{table.footer}</pre>}
    </div>
  );
};

export default function CombatTrainingResults({ data, user }) {
 const {t:copyT}=useCopyLanguage();

  const signatureCanvasRef = useRef(null);
  const isDrawingSignatureRef = useRef(false);
  const [selectedSectionId, setSelectedSectionId] = useHistoryState(moduleNavigationKey("CombatTrainingResults", user, data), 
    data?.initialSectionId || null
  );
  const [selectedObservationGroupId, setSelectedObservationGroupId] = useState(
    data?.initialObservationGroupId || null
  );
  const [selectedInspectionGroupId, setSelectedInspectionGroupId] = useState(null);
  const [resultHistory,setResultHistory]=useState(null);
  const [selectedAdminUnitNumber, setSelectedAdminUnitNumber] = useState(null);
  const [selectedAdminOutpostName, setSelectedAdminOutpostName] = useState(null);
  const [selectedSubsectionId, setSelectedSubsectionId] = useState(
    data?.initialSubsectionId || null
  );
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    data?.initialPeriodId || null
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState(null);
  const [monthInput, setMonthInput] = useState("");
  const [documentTitle, setDocumentTitle] = useState(DEFAULT_DOCUMENT_TITLE);
  const [customPeriods, setCustomPeriods] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved).map(normalizeStoredPeriod) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [editableRows, setEditableRows] = useState([]);
  const [editableColumns, setEditableColumns] = useState([]);
  const [editableHeaderRows, setEditableHeaderRows] = useState([]);
  const [isInsertSectionDialogOpen, setIsInsertSectionDialogOpen] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionInsertType, setSectionInsertType] = useState("section");
  const [insertPosition, setInsertPosition] = useState(0);
  const [rowActionDialog, setRowActionDialog] = useState(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const [newRowNumber, setNewRowNumber] = useState("1");
  const [editableTitle, setEditableTitle] = useState("");
  const [editableFooter, setEditableFooter] = useState(DEFAULT_TABLE_FOOTER);
  const [signatureImages, setSignatureImages] = useState({});
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [activeSignatureSlot, setActiveSignatureSlot] = useState(SIGNATURE_SLOTS[0].id);
  const [resultSubmissions, setResultSubmissions] = useState([]);
  const [selectedResultSubmission, setSelectedResultSubmission] = useState(
    data?.initialResultSubmission || null
  );
  const [selectedSubmittedSubjectId, setSelectedSubmittedSubjectId] = useState(null);
  const [isResultSendDialogOpen, setIsResultSendDialogOpen] = useState(false);
  const [resultSubmissionTitle, setResultSubmissionTitle] = useState("");
  const [resultSubmissionError, setResultSubmissionError] = useState("");
  const [isSendingResult, setIsSendingResult] = useState(false);
  const [deletingResultSubmissionId, setDeletingResultSubmissionId] = useState(null);
  const [resultSubmissionListError, setResultSubmissionListError] = useState("");
  const [forwardingSubmission, setForwardingSubmission] = useState(null);
  const [observationStatusNow, setObservationStatusNow] = useState(() => Date.now());
  const resultsTableScrollRef = useRef(null);
  const resultsTableElementRef = useRef(null);
  const resultsTopScrollRef = useRef(null);
  const [resultsTableScrollWidth, setResultsTableScrollWidth] = useState(1200);

  // Массив разделов, где можно создавать документы
  const sectionsWithCreate = [
    "observation-tpv",
    "observation-ogp",
    "observation-fp",
    "observation-spec",
    "observation-tp",
    "observation-op",
    "observation-stp",
    "observation-ovu",
    "observation-koj"
  ];

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customPeriods));
      } catch {
        // Silent fail if localStorage is unavailable
      }
    }
  }, [customPeriods]);

  useEffect(() => {
    if (!["outpost", "regional", "admin"].includes(user?.role)) {
      setResultSubmissions([]);
      return undefined;
    }

    let isActive = true;
    getThematicAccountSubmissions(undefined, [
      "combat-training-results-observation",
      "combat-training-results-inspection",
      data?.submissionSectionId,
    ])
      .then((items) => {
        if (isActive) {
          setResultSubmissions(
            (Array.isArray(items) ? items : []).filter((item) =>
              [
                "combat-training-results-observation",
                "combat-training-results-inspection",
                data?.submissionSectionId,
              ].includes(item.sectionId)
            )
          );
        }
      })
      .catch(() => {
        if (isActive) {
          setResultSubmissions([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedSectionId, user?.id, user?.role]);

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setObservationStatusNow(Date.now()),
      1000
    );
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (selectedPeriodId && typeof window !== "undefined") {
      try {
        const tableStorageKey = `${STORAGE_KEY}-${selectedPeriodId}`;
        const saved = window.localStorage.getItem(tableStorageKey);
        if (saved) {
          setEditableRows(JSON.parse(saved));
        } else if (selectedPeriod && selectedPeriod.table) {
          setEditableRows(selectedPeriod.table.rows);
        } else {
          setEditableRows([]);
        }
      } catch (error) {
        console.error("Error loading table data:", error);
        if (selectedPeriod && selectedPeriod.table) {
          setEditableRows(selectedPeriod.table.rows);
        } else {
          setEditableRows([]);
        }
      }
    } else {
      setEditableRows([]);
    }
  }, [selectedPeriodId]);

  useEffect(() => {
    if (selectedPeriodId && typeof window !== "undefined") {
      try {
        const tableVersionKey = selectedPeriod?.table?.templateVersion ? `-v${selectedPeriod.table.templateVersion}` : "";
        const columnsStorageKey = `${STORAGE_KEY}-${selectedPeriodId}-columns${tableVersionKey}`;
        const headerRowsStorageKey = `${STORAGE_KEY}-${selectedPeriodId}-header-rows${tableVersionKey}`;
        const savedColumns = window.localStorage.getItem(columnsStorageKey);
        const savedHeaderRows = window.localStorage.getItem(headerRowsStorageKey);
        setEditableColumns(savedColumns ? JSON.parse(savedColumns) : selectedTable?.columns || []);
        setEditableHeaderRows(savedHeaderRows ? JSON.parse(savedHeaderRows) : selectedTable?.headerRows || []);
      } catch (error) {
        console.error("Error loading table header data:", error);
        setEditableColumns(selectedTable?.columns || []);
        setEditableHeaderRows(selectedTable?.headerRows || []);
      }
    } else {
      setEditableColumns([]);
      setEditableHeaderRows([]);
    }
  }, [selectedPeriodId]);

  useEffect(() => {
    if (selectedPeriodId && typeof window !== "undefined") {
      try {
        const footerStorageKey = `${STORAGE_KEY}-${selectedPeriodId}-footer`;
        const savedFooter = window.localStorage.getItem(footerStorageKey);
        setEditableFooter(savedFooter || selectedPeriod?.table?.footer || DEFAULT_TABLE_FOOTER);
      } catch {
        setEditableFooter(selectedPeriod?.table?.footer || DEFAULT_TABLE_FOOTER);
      }
    } else {
      setEditableFooter(DEFAULT_TABLE_FOOTER);
    }
  }, [selectedPeriodId]);

  useEffect(() => {
    if (selectedPeriodId && typeof window !== "undefined") {
      try {
        const nextSignatures = SIGNATURE_SLOTS.reduce((result, slot) => {
          const signatureStorageKey = `${STORAGE_KEY}-${selectedPeriodId}-signature-${slot.id}`;
          result[slot.id] = window.localStorage.getItem(signatureStorageKey) || "";
          return result;
        }, {});
        nextSignatures.captain = nextSignatures.captain || window.localStorage.getItem(`${STORAGE_KEY}-${selectedPeriodId}-signature`) || "";
        setSignatureImages(nextSignatures);
      } catch {
        setSignatureImages({});
      }
    } else {
      setSignatureImages({});
    }
  }, [selectedPeriodId]);

  useEffect(() => {
    if (selectedPeriodId && typeof window !== "undefined") {
      try {
        const titleStorageKey = `${STORAGE_KEY}-${selectedPeriodId}-title`;
        const savedTitle = window.localStorage.getItem(titleStorageKey);
        if (savedTitle) {
          setEditableTitle(savedTitle);
        } else if (selectedPeriod && selectedPeriod.table) {
          setEditableTitle(selectedPeriod.table.title || selectedPeriod.title || "");
        } else {
          setEditableTitle("");
        }
      } catch {
        if (selectedPeriod && selectedPeriod.table) {
          setEditableTitle(selectedPeriod.table.title || selectedPeriod.title || "");
        } else {
          setEditableTitle("");
        }
      }
    } else {
      setEditableTitle("");
    }
  }, [selectedPeriodId]);

  const handleTitleChange = (event) => {
    const newTitle = event.target.value;
    setEditableTitle(newTitle);
    if (selectedPeriodId && typeof window !== "undefined") {
      try {
        const titleStorageKey = `${STORAGE_KEY}-${selectedPeriodId}-title`;
        window.localStorage.setItem(titleStorageKey, newTitle);
      } catch {
        // Silent fail
      }
    }
  };

  const handleFooterChange = (event) => {
    setEditableFooter(event.target.value);
  };

  const handleCellChange = (rowIndex, columnKey, value) => {
    setEditableRows((currentRows) => {
      const newRows = [...currentRows];
      newRows[rowIndex][columnKey] = value;
      return newRows;
    });
  };

  const handleSectionTitleChange = (rowIndex, value) => {
    setEditableRows((currentRows) => {
      const newRows = [...currentRows];
      newRows[rowIndex] = {
        ...newRows[rowIndex],
        sectionTitle: value,
      };
      return newRows;
    });
  };

  const handleHeaderCellChange = (rowIndex, cellIndex, value) => {
    setEditableHeaderRows((currentHeaderRows) =>
      currentHeaderRows.map((headerRow, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? headerRow.map((cell, currentCellIndex) =>
              currentCellIndex === cellIndex ? { ...cell, label: value } : cell
            )
          : headerRow
      )
    );
  };

  const handleColumnLabelChange = (columnIndex, value) => {
    setEditableColumns((currentColumns) =>
      currentColumns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex ? { ...column, label: value } : column
      )
    );
  };

  const handleAddKojResultColumn = () => {
    setEditableRows((currentRows) =>
      [
        ...currentRows,
        {
          __isSection: true,
          __isResultColumn: true,
          sectionTitle: "бөлүкчөнүн жыйынтыгы",
          tacticalAction: "",
          shooting: "",
          totalGrade: "",
          note: "",
        },
      ]
    );
  };

  const handleSaveTable = () => {
    if (selectedPeriod && typeof window !== "undefined") {
      const tableStorageKey = `${STORAGE_KEY}-${selectedPeriod.id}`;
      const titleStorageKey = `${STORAGE_KEY}-${selectedPeriod.id}-title`;
      const footerStorageKey = `${STORAGE_KEY}-${selectedPeriod.id}-footer`;
      const tableVersionKey = selectedPeriod.table?.templateVersion ? `-v${selectedPeriod.table.templateVersion}` : "";
      const columnsStorageKey = `${STORAGE_KEY}-${selectedPeriod.id}-columns${tableVersionKey}`;
      const headerRowsStorageKey = `${STORAGE_KEY}-${selectedPeriod.id}-header-rows${tableVersionKey}`;
      try {
        window.localStorage.setItem(tableStorageKey, JSON.stringify(editableRows));
        window.localStorage.setItem(titleStorageKey, editableTitle);
        window.localStorage.setItem(footerStorageKey, editableFooter);
        window.localStorage.setItem(columnsStorageKey, JSON.stringify(editableColumns));
        window.localStorage.setItem(headerRowsStorageKey, JSON.stringify(editableHeaderRows));
        SIGNATURE_SLOTS.forEach((slot) => {
          const signatureStorageKey = `${STORAGE_KEY}-${selectedPeriod.id}-signature-${slot.id}`;
          if (signatureImages[slot.id]) {
            window.localStorage.setItem(signatureStorageKey, signatureImages[slot.id]);
          } else {
            window.localStorage.removeItem(signatureStorageKey);
          }
        });
      } catch {
 notifySave(false); return;

        // Silent fail if localStorage is unavailable
      }
    }
  
    notifySave();
};

  const handleOpenResultSendDialog = () => {
    const canDirectSend = Boolean(data?.allowResultSubmission) &&
      ["outpost", "regional"].includes(user?.role);
    const canRegionalSend =
      user?.role === "regional" &&
      (
        (selectedSectionId === "observation" && selectedObservationGroupId === "regional-unit") ||
        (selectedSectionId === "inspection" && selectedInspectionGroupId === "regional-unit")
      );
    if (
      (user?.role !== "outpost" && !canRegionalSend && !canDirectSend) ||
      (!["observation", "inspection"].includes(selectedSectionId) && !canDirectSend) ||
      !selectedPeriod
    ) {
      return;
    }
    setResultSubmissionTitle("");
    setResultSubmissionError("");
    setIsResultSendDialogOpen(true);
  };

  const handleSendResult = async () => {
    const title = resultSubmissionTitle.trim();
    if (!title) {
      setResultSubmissionError("Иш кагаздардын аталышын жазыңыз.");
      return;
    }

    if (!(await confirmDocumentSend())) return;

    handleSaveTable();
    setIsSendingResult(true);
    setResultSubmissionError("");
    try {
      const isInspectionSubmission = selectedSectionId === "inspection";
      const submission = await createThematicAccountSubmission({
        documentTitle: title,
        sectionId:
          data?.submissionSectionId ||
          (isInspectionSubmission
            ? "combat-training-results-inspection"
            : "combat-training-results-observation"),
        periodId: data?.submissionPeriodId || "",
        table: isInspectionSubmission ? {
          subsectionId: selectedSubsectionId,
          subsectionTitle: selectedSubsection?.title || selectedSubsectionId,
          periodId: selectedPeriod.id,
          periodTitle: selectedPeriod.title,
          table: {
            ...selectedTable,
            title: editableTitle || selectedTable?.title || selectedPeriod.title,
            columns: editableColumns,
            headerRows: editableHeaderRows,
            rows: editableRows,
            footer: editableFooter,
            signatureImages,
          },
        } : {
          subjectId: selectedSubsectionId,
          subjectTitle: selectedSubsection?.title || selectedSubsectionId,
          periodId: selectedPeriod.id,
          periodTitle: selectedPeriod.title,
          table: {
            ...selectedTable,
            title: editableTitle || selectedTable?.title || selectedPeriod.title,
            columns: editableColumns,
            headerRows: editableHeaderRows,
            rows: editableRows,
            footer: editableFooter,
            signatureImages,
          },
        },
      });
      setResultSubmissions((items) => [
        submission,
        ...items.filter((item) => item.id !== submission.id),
      ]);
      if (customPeriods.some((period) => period.id === selectedPeriod.id)) {
        setCustomPeriods((periods) =>
          periods.filter((period) => period.id !== selectedPeriod.id)
        );
      }
      if (typeof window !== "undefined") {
        const storagePrefix = `${STORAGE_KEY}-${selectedPeriod.id}`;
        Object.keys(window.localStorage)
          .filter((key) => key === storagePrefix || key.startsWith(`${storagePrefix}-`))
          .forEach((key) => window.localStorage.removeItem(key));
      }
      data?.onSubmissionCreated?.(submission);
      setIsResultSendDialogOpen(false);
      setResultSubmissionTitle("");
      setEditableRows([]);
      setEditableColumns([]);
      setEditableHeaderRows([]);
      setEditableTitle("");
      setEditableFooter(DEFAULT_TABLE_FOOTER);
      setSignatureImages({});
      setSelectedPeriodId(null);
      if (isInspectionSubmission) {
        setSelectedSubsectionId(null);
      }
    } catch (error) {
      setResultSubmissionError(
        getApiErrorMessage(error, "Документти жөнөтүү мүмкүн болгон жок.")
      );
    } finally {
      setIsSendingResult(false);
    }
  };

  const handleDeleteResultSubmission = async (submission, subjectId = "") => {
    if (!window.confirm(`"${submission.documentTitle}" өчүрүлсүнбү?`)) {
      return;
    }

    setDeletingResultSubmissionId(submission.id);
    setResultSubmissionListError("");
    try {
      const updatedSubmission = await deleteThematicAccountSubmission(
        submission.id,
        subjectId
      );
      setResultSubmissions((items) => updatedSubmission
        ? items.map((item) => item.id === submission.id ? updatedSubmission : item)
        : items.filter((item) => item.id !== submission.id)
      );
      if (selectedResultSubmission?.id === submission.id) {
        setSelectedResultSubmission(null);
      }
    } catch (error) {
      setResultSubmissionListError(
        getApiErrorMessage(error, "Документти өчүрүү мүмкүн болгон жок.")
      );
    } finally {
      setDeletingResultSubmissionId(null);
    }
  };

  const getSignaturePoint = (event) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const drawSignaturePoint = (event) => {
    const point = getSignaturePoint(event);
    const canvas = signatureCanvasRef.current;
    if (!point || !canvas) return;

    const context = canvas.getContext("2d");
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const handleSignatureStart = (event) => {
    const point = getSignaturePoint(event);
    const canvas = signatureCanvasRef.current;
    if (!point || !canvas) return;

    event.preventDefault();
    const context = canvas.getContext("2d");
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111";
    context.beginPath();
    context.moveTo(point.x, point.y);
    isDrawingSignatureRef.current = true;
  };

  const handleSignatureMove = (event) => {
    if (!isDrawingSignatureRef.current) return;
    event.preventDefault();
    drawSignaturePoint(event);
  };

  const handleSignatureEnd = () => {
    isDrawingSignatureRef.current = false;
  };

  const handleClearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSaveSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !selectedPeriodId || typeof window === "undefined") return;

    const dataUrl = canvas.toDataURL("image/png");
    setSignatureImages((currentImages) => ({
      ...currentImages,
      [activeSignatureSlot]: dataUrl,
    }));
    try {
      window.localStorage.setItem(`${STORAGE_KEY}-${selectedPeriodId}-signature-${activeSignatureSlot}`, dataUrl);
    } catch {
      // Silent fail if localStorage is unavailable
    }
    setIsSignatureDialogOpen(false);
  };

  const handleDeleteSignature = (slotId) => {
    setSignatureImages((currentImages) => ({
      ...currentImages,
      [slotId]: "",
    }));
    if (selectedPeriodId && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(`${STORAGE_KEY}-${selectedPeriodId}-signature-${slotId}`);
      } catch {
        // Silent fail if localStorage is unavailable
      }
    }
  };

  const handleOpenSignatureDialog = (slotId) => {
    setActiveSignatureSlot(slotId);
    setIsSignatureDialogOpen(true);
    window.requestAnimationFrame(handleClearSignatureCanvas);
  };

  const handleInsertSection = () => {
    const summaryIndex = editableRows.findIndex(
      (row) =>
        row.__isSummary ||
        row.__isResultColumn
    );
    const maxPosition = (selectedTable?.type === "inspectionSecondSummary" || selectedTable?.type === "inspectionBpFirstSummary" || selectedTable?.type === "inspectionBpSecondSummary" || selectedTable?.type === "inspectionBpFifthSummary") && summaryIndex >= 0
      ? summaryIndex
      : editableRows.length;
    const position = Math.min(insertPosition, maxPosition);
    
    const sectionRow = sectionInsertType === "centered"
      ? createCenteredSectionRow(sectionTitle || "Негизги бөлүкчөлөр")
      : {
          __isSection: true,
          sectionTitle: sectionTitle || "Новая секция",
          number: "",
          personalNumber: "",
          ticketNumber: "",
          question1: "",
          answer1: "",
          question2: "",
          answer2: "",
          question3: "",
          answer3: "",
          totalGrade: "",
          note: "",
        };

    const newRows = [
      ...editableRows.slice(0, position),
      sectionRow,
      ...editableRows.slice(position)
    ];

    let rowCounter = 1;
    const updatedRows = newRows.map((row) => {
      if (row.__isSection || row.__isCenteredSection || row.__isSummary) {
        return row;
      }
      return { ...row, number: rowCounter++ };
    });

    setEditableRows(updatedRows);
    setIsInsertSectionDialogOpen(false);
    setSectionTitle("");
    setSectionInsertType("section");
    setInsertPosition(0);
  };

  const handleAddCenteredSection = () => {
    setSectionInsertType("centered");
    setSectionTitle("Негизги бөлүкчөлөр");
    setInsertPosition(0);
    setIsInsertSectionDialogOpen(true);
  };

  const handleDeleteSection = (rowIndex) => {
    if (window.confirm(`"${editableRows[rowIndex].sectionTitle}" секциясын өчүрүлсүнбү?`)) {
      const newRows = editableRows.filter((_, index) => index !== rowIndex);
      let rowCounter = 1;
      const updatedRows = newRows.map((row) => {
        if (row.__isSection) {
          return row;
        }
        return { ...row, number: rowCounter++ };
      });
      setEditableRows(updatedRows);
    }
  };

  const getEditableDataRowIndexes = () => editableRows
    .map((row, index) => ({row, index}))
    .filter(({row}) =>
      !row.__isSection &&
      !row.__isCenteredSection &&
      !row.__isSummary &&
      !row.__isResultColumn
    )
    .map(({index}) => index);

  const buildEmptyRow = (requestedNumber) => {
    const defaultNumber = editableRows.filter(
      (row) =>
        !row.__isSection &&
        !row.__isCenteredSection &&
        !row.__isSummary &&
        !row.__isResultColumn
    ).length + 1;
    const nextNumber = String(requestedNumber || defaultNumber).trim() || String(defaultNumber);
    const dottedNumber = `${nextNumber.replace(/\.+$/, "")}.`;
    return selectedTable?.type === "physicalTraining"
      ? createEmptyPhysicalRow(nextNumber)
      : selectedTable?.type === "shootingTraining"
        ? createEmptyShootingRow(nextNumber)
        : selectedTable?.type === "lineTraining"
          ? createEmptyLineRow(nextNumber)
          : selectedTable?.type === "inspectionSummary"
            ? createEmptyInspectionSummaryRow(nextNumber)
            : selectedTable?.type === "inspectionSecondSummary"
              ? createEmptyInspectionSecondSummaryRow(dottedNumber)
            : selectedTable?.type === "inspectionBpFirstSummary"
              ? createEmptyBpFirstSummaryRow(dottedNumber)
            : selectedTable?.type === "inspectionBpSecondSummary"
              ? createEmptyInspectionSecondSummaryRow(dottedNumber)
              : selectedTable?.type === "inspectionBpFifthSummary"
                ? createEmptyBpFirstSummaryRow(dottedNumber)
              : selectedTable?.type === "kojResults"
                ? createEmptyKojRow(
                    nextNumber,
                    editableColumns.length > 0 ? editableColumns : selectedTable.columns
                  )
      : {
          number: nextNumber,
          personalNumber: "",
          ticketNumber: "",
          question1: "",
          answer1: "",
          question2: "",
          answer2: "",
          question3: "",
          answer3: "",
          totalGrade: "",
          note: "",
        };
  };

  const renumberEditableRows = (rows) => {
    let rowCounter = 1;
    return rows.map((row) => {
      if (row.__isSection || row.__isCenteredSection || row.__isSummary || row.__isResultColumn) {
        return row;
      }
      return {...row, number: rowCounter++};
    });
  };

  useEffect(()=>{setEditableRows(current=>renumberEditableRows(current));},[selectedPeriodId]);

  const handleAddRow = () => {
    const rowIndexes = getEditableDataRowIndexes();
    setSelectedRowIndex(rowIndexes.length > 0 ? rowIndexes[rowIndexes.length - 1] : -1);
    setNewRowNumber(String(rowIndexes.length + 1));
    setRowActionDialog("add");
  };

  const handleDeleteRow = () => {
    const rowIndexes = getEditableDataRowIndexes();
    if (rowIndexes.length === 0) return;
    setSelectedRowIndex(rowIndexes[rowIndexes.length - 1]);
    setRowActionDialog("delete");
  };

  const handleConfirmRowAction = () => {
    if (rowActionDialog === "add") {
      const insertionIndex = selectedRowIndex < 0 ? 0 : selectedRowIndex + 1;
      const nextRows = [
        ...editableRows.slice(0, insertionIndex),
        buildEmptyRow(newRowNumber),
        ...editableRows.slice(insertionIndex),
      ];
      setEditableRows(renumberEditableRows(nextRows));
    } else if (rowActionDialog === "delete" && selectedRowIndex >= 0) {
      setEditableRows(renumberEditableRows(
        editableRows.filter((_, index) => index !== selectedRowIndex)
      ));
    }
    setRowActionDialog(null);
    setSelectedRowIndex(-1);
    setNewRowNumber("1");
  };

  const sections = data?.sections || [
    {
      id: "observation",
      title: "Көзөмөл сабактары",
      sections: [
        {
          id: "observation-tpv",
          title: "Чек ара аскерлеринин тактикасы",
          periods: [],
        },
        {
          id: "observation-ogp",
          title: "Коомдук мамлекеттик даярдоо",
          periods: [
            {
              id: "observation-ogp-period-1",
              title: "1-ай",
              table: {
                title: "ОГП - 1-ай",
                columns: [
                  { key: "number", label: "№" },
                  { key: "date", label: "Күнү", type: "date" },
                  { key: "topic", label: "Сабактын темасы" },
                  { key: "place", label: "Өткөрүлгөн жер" },
                  { key: "participants", label: "Катышкандар" },
                  { key: "instructor", label: "Жетекчи" },
                  { key: "grade", label: "Баа" },
                ],
                rows: Array.from({ length: 10 }, (_, i) => ({
                  number: i + 1,
                  date: "",
                  topic: "",
                  place: "",
                  participants: "",
                  instructor: "",
                  grade: "",
                })),
              },
            },
          ],
        },
        {
          id: "observation-fp",
          title: "Дене-тарбия даярдыгы",
          periods: [],
        },
        {
          id: "observation-spec",
          title: "Атайын даярдоо",
          periods: [
            {
              id: "observation-spec-period-1",
              title: "1-ай",
              table: {
                title: "СПЕЦ - 1-ай",
                columns: [
                  { key: "number", label: "№" },
                  { key: "date", label: "Күнү", type: "date" },
                  { key: "topic", label: "Сабактын темасы" },
                  { key: "place", label: "Өткөрүлгөн жер" },
                  { key: "participants", label: "Катышкандар" },
                  { key: "instructor", label: "Жетекчи" },
                  { key: "grade", label: "Баа" },
                ],
                rows: Array.from({ length: 10 }, (_, i) => ({
                  number: i + 1,
                  date: "",
                  topic: "",
                  place: "",
                  participants: "",
                  instructor: "",
                  grade: "",
                })),
              },
            },
          ],
        },
        {
          id: "observation-tp",
          title: "Тактикалык даярдоо",
          periods: [
            {
              id: "observation-tp-period-1",
              title: "1-ай",
              table: {
                title: "ТП - 1-ай",
                columns: [
                  { key: "number", label: "№" },
                  { key: "date", label: "Күнү", type: "date" },
                  { key: "topic", label: "Сабактын темасы" },
                  { key: "place", label: "Өткөрүлгөн жер" },
                  { key: "participants", label: "Катышкандар" },
                  { key: "instructor", label: "Жетекчи" },
                  { key: "grade", label: "Баа" },
                ],
                rows: Array.from({ length: 10 }, (_, i) => ({
                  number: i + 1,
                  date: "",
                  topic: "",
                  place: "",
                  participants: "",
                  instructor: "",
                  grade: "",
                })),
              },
            },
          ],
        },
        {
          id: "observation-op",
          title: "Ок атуу даярдыгы",
          periods: [],
        },
        {
          id: "observation-stp",
          title: "Саптык даярдоо",
          periods: [],
        },
        {
          id: "observation-ovu",
          title: "Жалпы аскердик устав",
          periods: [
            {
              id: "observation-ovu-period-1",
              title: "1-ай",
              table: {
                title: "ОВУ - 1-ай",
                columns: [
                  { key: "number", label: "№" },
                  { key: "date", label: "Күнү", type: "date" },
                  { key: "topic", label: "Сабактын темасы" },
                  { key: "place", label: "Өткөрүлгөн жер" },
                  { key: "participants", label: "Катышкандар" },
                  { key: "instructor", label: "Жетекчи" },
                  { key: "grade", label: "Баа" },
                ],
                rows: Array.from({ length: 10 }, (_, i) => ({
                  number: i + 1,
                  date: "",
                  topic: "",
                  place: "",
                  participants: "",
                  instructor: "",
                  grade: "",
                })),
              },
            },
          ],
        },
        {
          id: "observation-koj",
          title: "Күжүрмөн ок атуу (БСО, БСГ)",
          periods: [],
        },
      ],
    },
    {
      id: "inspection",
      title: "Көзөмөл текшерүү сабактары",
      sections: [
        {
          id: "inspection-summary-1",
          title: "Окуу жылына карата жыйынтык ведомосту",
          periods: [
            {
              id: "inspection-summary-1-period-1",
              title: "1-ай",
              table: createInspectionSummaryTable("Окуу жылына карата жыйынтык ведомосту"),
            },
          ],
        },
        {
          id: "inspection-summary-2",
          title: "Окуу жылына карата күжүрмөн даярдоонун жыйынтыгы",
          periods: [
            {
              id: "inspection-summary-2-period-1",
              title: "1-ай",
              table: createInspectionSecondSummaryTable("20__ жылдын __ окуу мезгилинде 20____ аскер бөлүгүнүн ЧАЗ өздүк курамынын күжүрмөн даярдоо боюнча\nЖЫЙЫНТЫГЫ"),
            },
          ],
        },
        {
          id: "inspection-bp-1",
          title: "Милдеттемелердин аткарылышы",
          periods: [
            {
              id: "inspection-bp-1-period-1",
              title: "1-ай",
              table: createBpFirstSummaryTable("20____ жылдын ___ окуу мезгилинде 20____ аскер бөлүгүнүн _____ ЧАЗ\nөздүк курамынын милдетемелеринин аткарылышынын\nЖЫЙЫНТЫГЫ"),
            },
          ],
        },
        {
          id: "inspection-bp-2",
          title: "Аскер бөлүктүн күжүрмөн даярдоону жыйынтыгы",
          periods: [
            {
              id: "inspection-bp-2-period-1",
              title: "1-ай",
              table: createBpSecondSummaryTable("20___ жылдын ____ окуу мезгилинде ______аскер бөлүгүн өздүк курамынын күжүрмөн даярдоо боюнча\nЖЫЙЫНТЫГЫ"),
            },
          ],
        },
        {
          id: "inspection-obligations-summary",
          title: "Аскер бөлүктүн Милдеттемелердин аткарылышы",
          periods: [
            {
              id: "inspection-obligations-summary-period-1",
              title: "1-ай",
              table: createBpFifthSummaryTable("20____ жылдын ___ окуу мезгилинин ______аскер бөлүктөрдүн бөлүкчөлөрүнүн\nмилдетемелерин аткарылышынын\nЖЫЙЫНТЫГЫ"),
            },
          ],
        },
      ],
    },
  ];

  const selectedSection = sections.find((section) => section.id === selectedSectionId);
  const allSelectedSubsections = getNestedSections(selectedSection);
  const selectedSubsections = selectedSectionId === "inspection"
    ? user?.role === "regional"
      ? selectedInspectionGroupId === "regional-unit"
        ? allSelectedSubsections.filter((section) =>
            ["inspection-bp-2", "inspection-obligations-summary"].includes(section.id)
          )
        : allSelectedSubsections.filter((section) =>
            ["inspection-summary-1", "inspection-summary-2", "inspection-bp-1"].includes(section.id)
          )
      : allSelectedSubsections.filter((section) =>
          ["inspection-summary-1", "inspection-summary-2", "inspection-bp-1"].includes(section.id)
        )
    : allSelectedSubsections;
  const selectedSubsection = selectedSubsections.find((section) => section.id === selectedSubsectionId);
  const basePeriods = selectedSubsection?.periods || [];
  const selectedCustomPeriods = customPeriods.filter(
    (period) => period.subsectionId === selectedSubsectionId
  );
  const selectedPeriods = [...basePeriods, ...selectedCustomPeriods];
  const selectedPeriod = selectedPeriods.find((period) => period.id === selectedPeriodId);
  const selectedTable = selectedPeriod?.table || selectedSubsection?.table || selectedSection?.table;
  const tableColumns = editableColumns.length > 0 ? editableColumns : selectedTable?.columns || [];
  const tableHeaderRows = editableHeaderRows.length > 0 ? editableHeaderRows : selectedTable?.headerRows || [];
  const isInspectionSummary = selectedTable?.type === "inspectionSummary";
  const isInspectionSecondSummary = selectedTable?.type === "inspectionSecondSummary";
  const isInspectionBpFirstSummary = selectedTable?.type === "inspectionBpFirstSummary";
  const isInspectionBpSecondSummary = selectedTable?.type === "inspectionBpSecondSummary";
  const isInspectionBpFifthSummary = selectedTable?.type === "inspectionBpFifthSummary";
  const shouldSyncResultsTableScroll =
    selectedSectionId === "observation" || isInspectionSummary;
  const isBpPreparedSummary = isInspectionBpFirstSummary || isInspectionBpFifthSummary;
  const isInspectionBpPlainSummary = isInspectionBpSecondSummary || isInspectionBpFifthSummary;
  const isCompactSummaryTable = isInspectionSecondSummary || isInspectionBpFirstSummary || isInspectionBpSecondSummary || isInspectionBpFifthSummary;
  const resultsTableHistory = useDocumentHistory({
    resetKey: [
      selectedSectionId,
      selectedSubsectionId,
      selectedPeriodId,
      selectedAdminUnitNumber,
      selectedAdminOutpostName,
    ].filter(Boolean).join(":") || "results-no-table",
    value: {
      rows: editableRows,
      columns: editableColumns,
      headerRows: editableHeaderRows,
      title: editableTitle,
      footer: editableFooter,
    },
    onChange: (snapshot) => {
      setEditableRows(snapshot.rows || []);
      setEditableColumns(snapshot.columns || []);
      setEditableHeaderRows(snapshot.headerRows || []);
      setEditableTitle(snapshot.title || "");
      setEditableFooter(snapshot.footer || "");
    },
  });

  useEffect(() => {
    if (!shouldSyncResultsTableScroll) {
      return undefined;
    }

    const updateScrollWidth = () => {
      const scrollContainer = resultsTableScrollRef.current;
      const table = scrollContainer?.querySelector("table");
      const measuredWidth = Math.max(
        scrollContainer?.scrollWidth || 0,
        table?.scrollWidth || 0,
        table?.getBoundingClientRect().width || 0
      );
      const columnsWidth = tableColumns.reduce(
        (total, column) => total + (column.width || 100),
        0
      );
      setResultsTableScrollWidth(Math.ceil(Math.max(measuredWidth, columnsWidth)));
    };

    updateScrollWidth();
    window.requestAnimationFrame(updateScrollWidth);
    window.addEventListener("resize", updateScrollWidth);
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateScrollWidth);
    if (resultsTableScrollRef.current) {
      resizeObserver?.observe(resultsTableScrollRef.current);
      const table = resultsTableScrollRef.current.querySelector("table");
      if (table) {
        resizeObserver?.observe(table);
      }
    }

    return () => {
      window.removeEventListener("resize", updateScrollWidth);
      resizeObserver?.disconnect();
    };
  }, [
    editableRows.length,
    selectedPeriodId,
    shouldSyncResultsTableScroll,
    tableColumns,
  ]);

  const syncResultsTableScroll = (source, targetRef) => {
    if (targetRef.current && targetRef.current.scrollLeft !== source.scrollLeft) {
      targetRef.current.scrollLeft = source.scrollLeft;
    }
  };

  const handleSectionClick = (sectionId) => {
    setSelectedSectionId(sectionId);
    setSelectedAdminUnitNumber(null);
    setSelectedAdminOutpostName(null);
    setSelectedObservationGroupId(null);
    setSelectedInspectionGroupId(null);
    setSelectedSubsectionId(null);
    setSelectedPeriodId(null);
  };

  const handleSubsectionClick = (subsectionId) => {
    const nextSubsection = selectedSubsections.find((section) => section.id === subsectionId);
    const shouldOpenOnlyPeriod = subsectionId === "inspection-summary-1" || subsectionId === "inspection-summary-2" || subsectionId === "inspection-bp-1" || subsectionId === "inspection-bp-2" || subsectionId === "inspection-obligations-summary";
    const nextBasePeriods = nextSubsection?.periods || [];
    const nextCustomPeriods = customPeriods.filter((period) => period.subsectionId === subsectionId);
    const nextPeriods = [...nextBasePeriods, ...nextCustomPeriods];

    setSelectedSubsectionId(subsectionId);
    setSelectedPeriodId(shouldOpenOnlyPeriod && nextPeriods.length === 1 ? nextPeriods[0].id : null);
  };

  const handlePeriodClick = (periodId) => {
    setSelectedPeriodId(periodId);
  };

  const handleBack = () => {
    if (selectedAdminOutpostName) {
      setSelectedAdminOutpostName(null);
    } else if (selectedAdminUnitNumber) {
      setSelectedAdminUnitNumber(null);
    } else if (selectedPeriodId) {
      if (selectedSubsectionId === "inspection-summary-1" || selectedSubsectionId === "inspection-summary-2" || selectedSubsectionId === "inspection-bp-1" || selectedSubsectionId === "inspection-bp-2" || selectedSubsectionId === "inspection-obligations-summary") {
        setSelectedPeriodId(null);
        setSelectedSubsectionId(null);
      } else {
        setSelectedPeriodId(null);
      }
    } else if (selectedSubsectionId) {
      setSelectedSubsectionId(null);
    } else if (selectedObservationGroupId) {
      setSelectedObservationGroupId(null);
    } else if (selectedInspectionGroupId) {
      setSelectedInspectionGroupId(null);
    } else if (selectedSectionId) {
      setSelectedSectionId(null);
    }
  };

  const handleCreateDocument = () => {
    setDocumentTitle(DEFAULT_DOCUMENT_TITLE);
    setIsCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setMonthInput("");
    setDocumentTitle(DEFAULT_DOCUMENT_TITLE);
  };

  const handleSaveDocument = () => {
    const finalTitle = documentTitle;
    const newPeriodId = `custom-${Date.now()}`;
    const newPeriod = {
      id: newPeriodId,
      subsectionId: selectedSubsectionId,
      title: finalTitle,
      table: selectedSubsectionId === "observation-fp"
        ? createPhysicalTrainingTable(finalTitle)
        : selectedSubsectionId === "observation-op"
          ? createShootingTrainingTable(finalTitle)
          : selectedSubsectionId === "observation-stp"
            ? createLineTrainingTable(finalTitle)
          : selectedSubsectionId === "observation-koj"
            ? createKojTable(finalTitle)
        : createCustomTable(finalTitle),
    };
    setCustomPeriods([...customPeriods, newPeriod]);
    setSelectedPeriodId(newPeriodId);
    setIsCreateDialogOpen(false);
    setMonthInput("");
    setDocumentTitle(DEFAULT_DOCUMENT_TITLE);
  
    notifySave();
};

  const handleEditDocument = (period) => {
    setEditingPeriodId(period.id);
    const titleParts = period.title.split('\n');
    if (titleParts.length > 1 && titleParts[0].includes('айына')) {
      const monthPart = titleParts[0].replace(' айына', '');
      setMonthInput(monthPart);
      setDocumentTitle(titleParts.slice(1).join('\n'));
    } else {
      setMonthInput("");
      setDocumentTitle(period.title);
    }
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingPeriodId(null);
    setMonthInput("");
    setDocumentTitle(DEFAULT_DOCUMENT_TITLE);
  };

  const handleUpdateDocument = () => {
    const finalTitle = documentTitle;
    const updatedPeriods = customPeriods.map((period) =>
      period.id === editingPeriodId
        ? {
            ...period,
            title: finalTitle,
            table: {
              ...period.table,
              title: finalTitle,
            },
          }
        : period
    );
    setCustomPeriods(updatedPeriods);
    setIsEditDialogOpen(false);
    setEditingPeriodId(null);
    setMonthInput("");
    setDocumentTitle(DEFAULT_DOCUMENT_TITLE);
  
    notifySave();
};

  const handleDeleteDocument = (period) => {
    if (window.confirm(`"${period.title}" өчүрүлсүнбү?`)) {
      const updatedPeriods = customPeriods.filter((p) => p.id !== period.id);
      setCustomPeriods(updatedPeriods);
      if (selectedPeriodId === period.id) {
        setSelectedPeriodId(null);
      }
    }
  };

  // Стили для Word-подобной таблицы
  const wordTableStyles = {
    container: {
      padding: '20px',
      backgroundColor: '#ffffff',
      fontFamily: '"Times New Roman", Times, serif',
    },
    title: {
      fontSize: '14pt',
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: '15px',
      fontFamily: '"Times New Roman", Times, serif',
      border: 'none',
      backgroundColor: 'transparent',
      outline: 'none',
      width: '100%',
      resize: 'vertical',
      minHeight: '60px',
      padding: '8px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '11pt',
      fontFamily: '"Times New Roman", Times, serif',
    },
    th: {
      border: '1px solid #000000',
      padding: '6px 8px',
      textAlign: 'center',
      verticalAlign: 'middle',
      backgroundColor: '#f0f0f0',
      fontWeight: 'bold',
      fontFamily: '"Times New Roman", Times, serif',
      whiteSpace: 'pre-line',
    },
    headerTextarea: {
      border: 'none',
      backgroundColor: 'transparent',
      width: '100%',
      minHeight: '24px',
      color: 'inherit',
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: '11pt',
      fontWeight: 'bold',
      textAlign: 'center',
      outline: 'none',
      resize: 'none',
      overflow: 'hidden',
      whiteSpace: 'pre-line',
    },
    headerTextareaVertical: {
      border: 'none',
      backgroundColor: 'transparent',
      width: '36px',
      minHeight: '190px',
      color: 'inherit',
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: '10pt',
      fontWeight: 'bold',
      textAlign: 'center',
      outline: 'none',
      resize: 'none',
      overflow: 'hidden',
      writingMode: 'vertical-rl',
      transform: 'rotate(180deg)',
      whiteSpace: 'pre-line',
    },
    td: {
      border: '1px solid #000000',
      padding: '4px 8px',
      textAlign: 'center',
      verticalAlign: 'middle',
      fontFamily: '"Times New Roman", Times, serif',
    },
    sectionFirstCol: {
      border: '1px solid #000000',
      padding: '6px 8px',
      textAlign: 'left',
      verticalAlign: 'middle',
      fontFamily: '"Times New Roman", Times, serif',
      backgroundColor: '#e8e8e8',
    },
    sectionText: {
      fontWeight: 'bold',
      fontStyle: 'italic',
      fontSize: '11pt',
      paddingLeft: '10px',
    },
    sectionTitleInput: {
      border: 'none',
      backgroundColor: 'transparent',
      width: '100%',
      color: '#333',
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: '11pt',
      fontWeight: 'bold',
      fontStyle: 'italic',
      outline: 'none',
      paddingLeft: '10px',
    },
    sectionEmptyCol: {
      border: '1px solid #000000',
      padding: '4px 8px',
      backgroundColor: '#e8e8e8',
      textAlign: 'center',
      verticalAlign: 'middle',
    },
    sectionHighlightedCol: {
      border: '1px solid #000000',
      padding: '4px 8px',
      backgroundColor: '#6f6a00',
      textAlign: 'center',
      verticalAlign: 'middle',
    },
    input: {
      border: 'none',
      backgroundColor: 'transparent',
      width: '100%',
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: '11pt',
      textAlign: 'center',
      outline: 'none',
      padding: '2px',
    },
    sectionInput: {
      border: 'none',
      backgroundColor: 'transparent',
      width: '100%',
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: '11pt',
      textAlign: 'center',
      outline: 'none',
      padding: '2px',
      color: '#333',
    },
    textarea: {
      border: 'none',
      backgroundColor: 'transparent',
      width: '100%',
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: '11pt',
      textAlign: 'center',
      outline: 'none',
      resize: 'vertical',
      padding: '2px',
    },
    button: {
      backgroundColor: '#4CAF50',
      color: 'white',
      border: '1px solid #388E3C',
      padding: '6px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '11pt',
      fontFamily: '"Times New Roman", Times, serif',
      marginRight: '6px',
    },
    buttonSecondary: {
      backgroundColor: '#f0f0f0',
      color: '#333',
      border: '1px solid #999',
    },
    backButton: {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#0066cc',
      cursor: 'pointer',
      fontSize: '12pt',
      textDecoration: 'underline',
      fontFamily: '"Times New Roman", Times, serif',
      padding: '8px 0',
      marginBottom: '10px',
    },
    header: {
      textAlign: 'center',
      marginBottom: '20px',
      paddingBottom: '10px',
    },
    headerTitle: {
      fontSize: '18pt',
      fontWeight: 'bold',
      marginBottom: '5px',
      fontFamily: '"Times New Roman", Times, serif',
    },
    dialog: {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: '#fff',
      padding: '30px',
      border: '2px solid #000',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: 1000,
      maxWidth: '500px',
      width: '90%',
      fontFamily: '"Times New Roman", Times, serif',
    },
    dialogOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 999,
    },
    dialogTitle: {
      fontSize: '16pt',
      fontWeight: 'bold',
      marginBottom: '20px',
      textAlign: 'center',
    },
    dialogLabel: {
      display: 'block',
      marginBottom: '8px',
      fontWeight: 'bold',
    },
    dialogInput: {
      width: '100%',
      padding: '8px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '12pt',
      marginBottom: '15px',
      fontFamily: '"Times New Roman", Times, serif',
    },
    dialogSelect: {
      width: '100%',
      padding: '8px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '12pt',
      marginBottom: '15px',
      fontFamily: '"Times New Roman", Times, serif',
    },
    dialogActions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      marginTop: '20px',
    },
    dialogButton: {
      padding: '8px 16px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '11pt',
      fontFamily: '"Times New Roman", Times, serif',
    },
    dialogButtonPrimary: {
      backgroundColor: '#4CAF50',
      color: 'white',
      border: '1px solid #388E3C',
    },
    dialogButtonSecondary: {
      backgroundColor: '#f5f5f5',
    },
    buttonDanger: {
      backgroundColor: '#ff4444',
      color: 'white',
      border: '1px solid #cc0000',
      padding: '4px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '11pt',
      fontFamily: '"Times New Roman", Times, serif',
      marginLeft: '15px',
      minWidth: '80px',
    },
    actionsContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '15px',
      flexWrap: 'wrap',
      gap: '8px',
    },
    actionsLeft: {
      display: 'flex',
      gap: '6px',
      flexWrap: 'wrap',
    },
    actionsRight: {
      display: 'flex',
      gap: '6px',
      flexWrap: 'wrap',
    },
    sectionContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    },
    sectionContent: {
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      flex: 1,
    },
    footerWrapper: {
      position: 'relative',
      marginTop: '24px',
    },
    footerTextarea: {
      border: 'none',
      backgroundColor: 'transparent',
      color: '#111',
      width: '100%',
      minHeight: '520px',
      padding: '0',
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: '13pt',
      fontWeight: 'bold',
      lineHeight: '1.45',
      outline: 'none',
      resize: 'vertical',
      overflow: 'hidden',
      whiteSpace: 'pre-wrap',
    },
    signatureImage: (slot) => ({
      position: 'absolute',
      left: '150px',
      top: `${slot.top}px`,
      width: '180px',
      maxHeight: '72px',
      objectFit: 'contain',
      pointerEvents: 'none',
    }),
    footerSignatureButton: (slot) => ({
      position: 'absolute',
      left: '155px',
      top: `${slot.buttonTop}px`,
      backgroundColor: '#f7f7f7',
      color: '#111',
      border: '1px solid #777',
      padding: '4px 10px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '10pt',
      fontFamily: '"Times New Roman", Times, serif',
      zIndex: 2,
    }),
    inlineSignatureButton: {
      position: 'absolute',
      left: '285px',
      top: '70px',
      backgroundColor: '#f7f7f7',
      color: '#111',
      border: '1px solid #777',
      padding: '3px 10px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '10pt',
      fontFamily: '"Times New Roman", Times, serif',
      zIndex: 2,
    },
    inlineSignatureImage: {
      position: 'absolute',
      left: '270px',
      top: '54px',
      width: '145px',
      maxHeight: '58px',
      objectFit: 'contain',
      pointerEvents: 'none',
    },
    inlineSignatureDeleteButton: {
      position: 'absolute',
      left: '425px',
      top: '70px',
      backgroundColor: '#ff4444',
      color: 'white',
      border: '1px solid #cc0000',
      padding: '3px 10px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '10pt',
      fontFamily: '"Times New Roman", Times, serif',
      zIndex: 2,
    },
    compactSectionDeleteButton: {
      position: 'absolute',
      right: '6px',
      top: '2px',
      backgroundColor: '#ff4444',
      color: 'white',
      border: '1px solid #cc0000',
      padding: '1px 6px',
      borderRadius: '3px',
      cursor: 'pointer',
      fontSize: '8pt',
      fontFamily: '"Times New Roman", Times, serif',
    },
    signatureCanvas: {
      width: '100%',
      maxWidth: '520px',
      height: '180px',
      border: '1px solid #222',
      backgroundColor: '#fff',
      borderRadius: '4px',
      touchAction: 'none',
      cursor: 'crosshair',
    },
  };

  const compactTableStyle = isCompactSummaryTable
    ? { ...wordTableStyles.table, fontSize: '9pt', tableLayout: 'fixed' }
    : wordTableStyles.table;
  const compactThStyle = isCompactSummaryTable
    ? { ...wordTableStyles.th, padding: '2px 3px', fontSize: '9pt', lineHeight: '1.05' }
    : wordTableStyles.th;
  const compactTdStyle = isCompactSummaryTable
    ? { ...wordTableStyles.td, padding: '1px 3px', fontSize: '9pt', height: '20px' }
    : wordTableStyles.td;
  const compactInputStyle = isCompactSummaryTable
    ? { ...wordTableStyles.input, fontSize: '9pt', padding: '0 1px' }
    : wordTableStyles.input;
  const compactHeaderTextareaStyle = isCompactSummaryTable
    ? { ...wordTableStyles.headerTextarea, fontSize: '9pt', lineHeight: '1.05', padding: '0' }
    : wordTableStyles.headerTextarea;
  const compactHeaderTextareaVerticalStyle = isCompactSummaryTable
    ? {
        ...wordTableStyles.headerTextareaVertical,
        width: isBpPreparedSummary ? '24px' : '22px',
        minHeight: isBpPreparedSummary ? '72px' : '72px',
        fontSize: isBpPreparedSummary ? '12pt' : '8pt',
        lineHeight: '1',
        padding: '0',
      }
    : wordTableStyles.headerTextareaVertical;
  const compactTitleStyle = isCompactSummaryTable
    ? {
        ...wordTableStyles.title,
        fontSize: isBpPreparedSummary ? '13pt' : '12pt',
        minHeight: isBpPreparedSummary ? '92px' : '48px',
        marginBottom: '8px',
        padding: '4px',
        lineHeight: '1.25',
        overflow: 'visible',
      }
    : wordTableStyles.title;
  const compactFooterTextareaStyle = isInspectionSecondSummary
    ? { ...wordTableStyles.footerTextarea, minHeight: '185px', fontSize: '11pt', fontWeight: 'normal', lineHeight: '1.35', marginTop: '18px', overflow: 'visible' }
    : isInspectionBpPlainSummary
      ? { ...wordTableStyles.footerTextarea, minHeight: '150px', fontSize: '11pt', fontWeight: 'normal', lineHeight: '1.35', marginTop: '18px', overflow: 'visible' }
    : isInspectionBpFirstSummary
      ? { ...wordTableStyles.footerTextarea, minHeight: '130px', fontSize: '11pt', lineHeight: '1.5', marginTop: '28px', overflow: 'visible' }
    : wordTableStyles.footerTextarea;

  const observationSection = sections.find((section) => section.id === "observation");
  const observationSubjects = getNestedSections(observationSection);
  const observationSubmissions = resultSubmissions.filter(
    (submission) => submission.sectionId === "combat-training-results-observation"
  );
  const inspectionSubmissions = resultSubmissions.filter(
    (submission) => submission.sectionId === "combat-training-results-inspection"
  );
  const observationIncomingSubmissions = observationSubmissions.filter(
    (submission) => submission.senderRole === "outpost"
  );
  const observationOutgoingSubmissions = observationSubmissions.filter(
    (submission) => submission.senderRole === "regional"
  );
  const inspectionIncomingSubmissions = inspectionSubmissions.filter(
    (submission) => submission.senderRole === "outpost"
  );
  const inspectionOutgoingSubmissions = inspectionSubmissions.filter(
    (submission) => submission.senderRole === "regional"
  );
  const inspectionDisplayedIncoming = user?.role === "admin"
    ? inspectionOutgoingSubmissions
    : inspectionIncomingSubmissions;
  const selectedAdminSectionSubmissions = selectedSectionId === "observation"
    ? observationSubmissions
    : selectedSectionId === "inspection"
      ? inspectionSubmissions
      : EMPTY_ARRAY;
  const adminUnitNumbers = Array.from(new Set([
    ...(data?.unitNumbers || EMPTY_ARRAY),
    ...selectedAdminSectionSubmissions.map((submission) => submission.unitNumber),
  ].map((unitNumber) => String(unitNumber || "").trim()).filter(Boolean)));
  const selectedAdminUnitSubmissions = selectedAdminSectionSubmissions.filter(
    (submission) => String(submission.unitNumber) === String(selectedAdminUnitNumber)
  );
  const adminMilitaryUnitSubmissions = selectedAdminUnitSubmissions.filter(
    (submission) => submission.senderRole === "regional"
  );
  const adminOutpostSubmissions = selectedAdminUnitSubmissions.filter(
    (submission) => submission.senderRole === "outpost"
  );
  const adminOutpostNames = Array.from(new Set([
    ...(OUTPOSTS_BY_MILITARY_UNIT[selectedAdminUnitNumber] || []).map(([, name]) =>
      formatOutpostName(name)
    ),
    ...adminOutpostSubmissions.map((submission) => formatOutpostName(submission.outpostName)),
  ].filter(Boolean)));
  const selectedAdminOutpostSubmissions = selectedAdminOutpostName
    ? adminOutpostSubmissions.filter(
        (submission) => formatOutpostName(submission.outpostName) === selectedAdminOutpostName
      )
    : EMPTY_ARRAY;
  const regionalOutpostSubmissions = selectedSectionId === "observation"
    ? observationIncomingSubmissions
    : selectedSectionId === "inspection"
      ? inspectionIncomingSubmissions
      : EMPTY_ARRAY;
  const regionalOutpostNames = Array.from(new Set([
    ...(OUTPOSTS_BY_MILITARY_UNIT[user?.region] || []).map(([, name]) =>
      formatOutpostName(name)
    ),
    ...regionalOutpostSubmissions.map((submission) =>
      formatOutpostName(submission.outpostName)
    ),
  ].filter(Boolean)));
  const selectedRegionalOutpostSubmissions = selectedAdminOutpostName
    ? regionalOutpostSubmissions.filter(
        (submission) =>
          formatOutpostName(submission.outpostName) === selectedAdminOutpostName
      )
    : EMPTY_ARRAY;
  const getRegionalOutpostObservationSubmission = (outpostName) =>
    getLatestResultSubmission(
      observationIncomingSubmissions.filter(
        (submission) =>
          formatOutpostName(submission.outpostName) === outpostName
      )
    );
  const getAdminOutpostObservationSubmission = (outpostName) =>
    getLatestResultSubmission(
      adminOutpostSubmissions.filter(
        (submission) =>
          formatOutpostName(submission.outpostName) === outpostName
      )
    );
  const latestRegionalObservationSubmission = getLatestResultSubmission(
    observationOutgoingSubmissions
  );
  const latestOwnObservationSubmission = getLatestResultSubmission(
    observationSubmissions.filter(
      (submission) => String(submission.senderId) === String(user?.id)
    )
  );
  const getRegionalOutpostInspectionSubmission = (outpostName) =>
    getLatestResultSubmission(
      inspectionIncomingSubmissions.filter(
        (submission) =>
          formatOutpostName(submission.outpostName) === outpostName
      )
    );
  const getAdminOutpostInspectionSubmission = (outpostName) =>
    getLatestResultSubmission(
      adminOutpostSubmissions.filter(
        (submission) =>
          formatOutpostName(submission.outpostName) === outpostName
      )
    );
  const latestRegionalInspectionSubmission = getLatestResultSubmission(
    inspectionOutgoingSubmissions
  );
  const latestOwnInspectionSubmission = getLatestResultSubmission(
    inspectionSubmissions.filter(
      (submission) => String(submission.senderId) === String(user?.id)
    )
  );
  const selectedObservationSubmissions = observationSubmissions.filter(
    (submission) => Boolean(submission.table?.subjects?.[selectedSubsectionId])
  );
  const openResultHistory=()=>{
    const unitNumber=selectedAdminUnitNumber||user?.region;
    const outpostName=selectedAdminOutpostName||'';
    const documents=(selectedSectionId===OBSERVATION_SECTION_ID?observationSubmissions:inspectionSubmissions).filter(item=>String(item.unitNumber)===String(unitNumber)&&(outpostName?formatOutpostName(item.outpostName)===formatOutpostName(outpostName):item.senderRole==='regional'));
    setResultHistory({unitNumber,outpostName,current:getLatestResultSubmission(documents)});
  };
  const resultHistoryButton=<button type="button" className="module-action-button" onClick={openResultHistory}>📁 <T>{"Архив"}</T></button>;
  const submittedSubjects = selectedResultSubmission?.table?.subjects || {};
  const selectedSubmittedSubject = selectedSubmittedSubjectId
    ? submittedSubjects[selectedSubmittedSubjectId]
    : null;

  const renderAdminSubmissionRow = (submission) => (
    <div className="module-period-row" key={`admin-result-${submission.id}`}>
      <button
        className="module-period-card module-period-card--document"
        onClick={() => setSelectedResultSubmission(submission)}
        type="button"
      >
        <span aria-hidden="true" className="module-document-icon" />
        <span className="module-submission-card__content">
          <strong><T>{submission.documentTitle}</T></strong>
          <small><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(submission)}</small>
          <small>
            <T>{submission.senderRole === "outpost"
              ? `Застава: ${submission.outpostName || submission.senderName}`
              : `Аскер бөлүгү: ${submission.unitNumber || submission.senderName}`}</T>
            {submission.table?.subsectionTitle ? ` · ${submission.table.subsectionTitle}` : ""}
          </small>
        </span>
      </button>
      <div className="module-period-actions">
        <button
          disabled={deletingResultSubmissionId === submission.id}
          onClick={() => handleDeleteResultSubmission(submission)}
          type="button"
        >
          <T>{deletingResultSubmissionId === submission.id ? "Өчүрүү..." : "Өчүрүү"}</T>
        </button>
      </div>
    </div>
  );

  const renderRegionalOutpostBrowser = () => (
    <div className="module-table-view">
      <button
        className="module-back-button"
        onClick={handleBack}
        style={wordTableStyles.backButton}
        type="button"
      ><T>{"Артка"}</T></button>
      {selectedAdminOutpostName ? (
        <div className="module-submission-list">
          <h2>{selectedAdminOutpostName}</h2>{resultHistoryButton}
          {selectedSectionId === OBSERVATION_SECTION_ID ? (
            <ObservationMonthlySubmissionStatus
              now={observationStatusNow}
              submission={getRegionalOutpostObservationSubmission(
                selectedAdminOutpostName
              )}
            />
          ) : selectedSectionId === INSPECTION_SECTION_ID ? (
            <InspectionReportingStatus
              now={observationStatusNow}
              submission={getRegionalOutpostInspectionSubmission(
                selectedAdminOutpostName
              )}
            />
          ) : null}
          <h3><T>{"Заставадан жөнөтүлгөн документтер"}</T></h3>
          {selectedRegionalOutpostSubmissions.length > 0 ? (
            selectedRegionalOutpostSubmissions.map((submission) => (
              <div className="module-period-row" key={`regional-outpost-${submission.id}`}>
                <button
                  className="module-period-card module-period-card--document"
                  onClick={() => setSelectedResultSubmission(submission)}
                  type="button"
                >
                  <span aria-hidden="true" className="module-document-icon" />
                  <span className="module-submission-card__content">
                    <strong><T>{submission.documentTitle}</T></strong>
                    <small><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(submission)}</small>
                    {submission.table?.subsectionTitle ? (
                      <small>{submission.table.subsectionTitle}</small>
                    ) : null}
                  </span>
                </button>
                <div className="module-period-actions">
                  <button
                    onClick={() => setForwardingSubmission(submission)}
                    type="button"
                  ><T>{"Жөнөтүү"}</T></button>
                  <button
                    disabled={deletingResultSubmissionId === submission.id}
                    onClick={() => handleDeleteResultSubmission(submission)}
                    type="button"
                  >
                    <T>{deletingResultSubmissionId === submission.id ? "Өчүрүү..." : "Өчүрүү"}</T>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="dashboard-state"><T>{"Бул заставадан жөнөтүлгөн документтер азырынча жок."}</T></p>
          )}
          {resultSubmissionListError && (
            <p className="dashboard-error">{resultSubmissionListError}</p>
          )}
        </div>
      ) : (
        <div className="module-period-list">
          <h2>{user?.region}<T>{" аскер бөлүгүнүн заставалары"}</T></h2>
          {regionalOutpostNames.length > 0 ? (
            <div className="saved-table-list">
              {regionalOutpostNames.map((outpostName) => {
                const documentCount = regionalOutpostSubmissions.filter(
                  (submission) =>
                    formatOutpostName(submission.outpostName) === outpostName
                ).length;

                return (
                  <button
                    className={`saved-table-card${
                      documentCount > 0
                        ? " saved-table-card--with-notification"
                        : ""
                    }`}
                    key={outpostName}
                    onClick={() => setSelectedAdminOutpostName(outpostName)}
                    type="button"
                  >
                    <strong><T>{outpostName}</T></strong>
                    {selectedSectionId === OBSERVATION_SECTION_ID ? (
                      <ObservationMonthlySubmissionStatus
                        now={observationStatusNow}
                        submission={getRegionalOutpostObservationSubmission(
                          outpostName
                        )}
                      />
                    ) : selectedSectionId === INSPECTION_SECTION_ID ? (
                      <InspectionReportingStatus
                        now={observationStatusNow}
                        submission={getRegionalOutpostInspectionSubmission(
                          outpostName
                        )}
                      />
                    ) : null}
                    {documentCount > 0 ? (
                      <span
                        aria-label={`Документтер: ${documentCount}`}
                        className="combat-journal-notification-badge"
                      >
                        {documentCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="dashboard-state"><T>{"Бул аскер бөлүгүнө катталган заставалар азырынча жок."}</T></p>
          )}
        </div>
      )}
    </div>
  );

  if (selectedSubmittedSubject) {
    return (
      <SubmittedObservationTable
        onBack={() => setSelectedSubmittedSubjectId(null)}
        subject={selectedSubmittedSubject}
      />
    );
  }

  if (data?.directSingleSubmission && selectedResultSubmission) {
    return (
      <SubmittedObservationTable
        onBack={data.onBack || (() => setSelectedResultSubmission(null))}
        subject={selectedResultSubmission.table}
      />
    );
  }

  if (selectedResultSubmission?.sectionId === "combat-training-results-inspection") {
    return (
      <SubmittedObservationTable
        onBack={() => setSelectedResultSubmission(null)}
        subject={selectedResultSubmission.table}
      />
    );
  }

  if (selectedResultSubmission) {
    const sentSubjectTitles = observationSubjects
      .filter((subject) => submittedSubjects[subject.id])
      .map((subject) => subject.title);
    const submissionSenderLabel = selectedResultSubmission.senderRole === "regional"
      ? "Аскер бөлүгү жөнөткөн предметтер"
      : "Застава жөнөткөн предметтер";
    return (
      <section className="module-panel">
        <button
          className="module-back-button"
          onClick={data?.onBack || (() => setSelectedResultSubmission(null))}
          type="button"
        ><T>{"Артка"}</T></button>
        <header>
          <h1><T>{selectedResultSubmission.documentTitle}</T></h1>
        </header>
        <p className="result-submission-notice">
          {submissionSenderLabel}: {sentSubjectTitles.join(", ") || "жок"}
        </p>
        <div className="module-document-list">
          {observationSubjects.map((subject) => {
            const isSent = Boolean(submittedSubjects[subject.id]);
            return (
              <button
                className="module-document-card result-submission-subject"
                disabled={!isSent}
                key={subject.id}
                onClick={() => setSelectedSubmittedSubjectId(subject.id)}
                type="button"
              >
                <span aria-hidden="true" className="module-document-icon" />
                <span>
                  {isSent ? <strong><T>{subject.title}</T></strong> : <span>{subject.title}</span>}
                  <small><T>{isSent ? "Жөнөтүлдү" : "Жөнөтүлгөн жок"}</T></small>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if(resultHistory){
    return <JournalSubjectHistory {...resultHistory} subject={{title:selectedSectionId===OBSERVATION_SECTION_ID?'Көзөмөл сабактары':'Көзөмөл текшерүү сабактары'}}
      sectionId={selectedSectionId===OBSERVATION_SECTION_ID?'combat-training-results-observation':'combat-training-results-inspection'}
      user={user} matchSubject={false} kind="results" onBack={()=>setResultHistory(null)} onOpenCurrent={setSelectedResultSubmission}/>;
  }

  if (!sections || sections.length === 0) {
    return (
      <div className="combat-training-results">
        <header className="module-header">
          <h1><T>{"Күжүрмөн даярдоонун жыйынтыктары"}</T></h1>
        </header>
        <div className="empty-state"><T>{"Маалымат жок"}</T></div>
      </div>
    );
  }

  return (
    <div className="combat-training-results">
      {!data?.hideModuleHeader ? (
        <header className="module-header" style={wordTableStyles.header}>
          <h1 style={wordTableStyles.headerTitle}><T>{"Күжүрмөн даярдоонун жыйынтыктары"}</T></h1>
        </header>
      ) : null}

      {!selectedSectionId ? (
        <div className="module-metric-grid module-section-grid">
          {sections.map((section) => (
            <button
              className="module-metric module-section-card"
              key={section.id}
              onClick={() => handleSectionClick(section.id)}
              type="button"
            >
              <strong><T>{section.title}</T></strong>
              {section.id === OBSERVATION_SECTION_ID && user?.role !== "admin" ? (
                <ObservationMonthlySubmissionStatus
                  now={observationStatusNow}
                  submission={latestOwnObservationSubmission}
                />
              ) : section.id === INSPECTION_SECTION_ID && user?.role !== "admin" ? (
                <InspectionReportingStatus
                  now={observationStatusNow}
                  submission={latestOwnInspectionSubmission}
                />
              ) : null}
            </button>
          ))}
        </div>
      ) : !data?.directEditor && user?.role === "admin" && ["observation", "inspection"].includes(selectedSectionId) ? (
        <div className="module-table-view">
          <button
            className="module-back-button"
            onClick={data?.onBack || handleBack}
            type="button"
            style={wordTableStyles.backButton}
          ><T>{"Артка"}</T></button>
          {!selectedAdminUnitNumber ? (
            <div className="module-document-list">
              {adminUnitNumbers.map((unitNumber) => (
                <button
                  className="module-document-card"
                  key={unitNumber}
                  onClick={() => {
                    setSelectedAdminUnitNumber(unitNumber);
                    setSelectedAdminOutpostName(null);
                  }}
                  type="button"
                >
                  <MilitaryUnitIcon unitNumber={unitNumber} />
                  <strong>{unitNumber}<T>{" аскер бөлүгү"}</T></strong>
                  {selectedSectionId === OBSERVATION_SECTION_ID ? (
                    <ObservationMonthlySubmissionStatus
                      now={observationStatusNow}
                      submission={getLatestResultSubmission(
                        selectedAdminSectionSubmissions.filter(
                          (submission) =>
                            submission.senderRole === "regional" &&
                            String(submission.unitNumber) === String(unitNumber)
                        )
                      )}
                    />
                  ) : selectedSectionId === INSPECTION_SECTION_ID ? (
                    <InspectionReportingStatus
                      now={observationStatusNow}
                      submission={getLatestResultSubmission(
                        selectedAdminSectionSubmissions.filter(
                          (submission) =>
                            submission.senderRole === "regional" &&
                            String(submission.unitNumber) === String(unitNumber)
                        )
                      )}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          ) : selectedAdminOutpostName ? (
            <div className="module-submission-list">
              <h2>{selectedAdminOutpostName}</h2>{resultHistoryButton}
              {selectedSectionId === OBSERVATION_SECTION_ID ? (
                <ObservationMonthlySubmissionStatus
                  now={observationStatusNow}
                  submission={getAdminOutpostObservationSubmission(
                    selectedAdminOutpostName
                  )}
                />
              ) : selectedSectionId === INSPECTION_SECTION_ID ? (
                <InspectionReportingStatus
                  now={observationStatusNow}
                  submission={getAdminOutpostInspectionSubmission(
                    selectedAdminOutpostName
                  )}
                />
              ) : null}
              <h3><T>{"Заставадан жөнөтүлгөн документтер"}</T></h3>
              {selectedAdminOutpostSubmissions.length > 0 ? (
                selectedAdminOutpostSubmissions.map(renderAdminSubmissionRow)
              ) : (
                <p className="dashboard-state"><T>{"Бул заставадан жөнөтүлгөн документтер азырынча жок."}</T></p>
              )}
              {resultSubmissionListError && (
                <p className="dashboard-error">{resultSubmissionListError}</p>
              )}
            </div>
          ) : (
            <div className="module-submission-list">
              <h2>{selectedAdminUnitNumber}<T>{" аскер бөлүгү"}</T></h2>{resultHistoryButton}
              {selectedSectionId === OBSERVATION_SECTION_ID ? (
                <ObservationMonthlySubmissionStatus
                  now={observationStatusNow}
                  submission={getLatestResultSubmission(
                    adminMilitaryUnitSubmissions
                  )}
                />
              ) : selectedSectionId === INSPECTION_SECTION_ID ? (
                <InspectionReportingStatus
                  now={observationStatusNow}
                  submission={getLatestResultSubmission(
                    adminMilitaryUnitSubmissions
                  )}
                />
              ) : null}
              <h3><T>{"Аскер бөлүктөн жөнөтүлгөн документтер"}</T></h3>
              {adminMilitaryUnitSubmissions.length > 0 ? (
                adminMilitaryUnitSubmissions.map(renderAdminSubmissionRow)
              ) : (
                <p className="dashboard-state"><T>{"Аскер бөлүктөн жөнөтүлгөн документтер азырынча жок."}</T></p>
              )}
              <h3><T>{"Заставалар"}</T></h3>
              {adminOutpostNames.length > 0 ? (
                <div className="module-document-list">
                  {adminOutpostNames.map((outpostName) => (
                    <button
                      className="module-document-card"
                      key={outpostName}
                      onClick={() => setSelectedAdminOutpostName(outpostName)}
                      type="button"
                    >
                      <span aria-hidden="true" className="module-document-icon" />
                      <strong><T>{outpostName}</T></strong>
                      {selectedSectionId === OBSERVATION_SECTION_ID ? (
                        <ObservationMonthlySubmissionStatus
                          now={observationStatusNow}
                          submission={getAdminOutpostObservationSubmission(outpostName)}
                        />
                      ) : selectedSectionId === INSPECTION_SECTION_ID ? (
                        <InspectionReportingStatus
                          now={observationStatusNow}
                          submission={getAdminOutpostInspectionSubmission(outpostName)}
                        />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="dashboard-state"><T>{"Бул аскер бөлүгүнө караштуу заставалар табылган жок."}</T></p>
              )}
              {resultSubmissionListError && (
                <p className="dashboard-error">{resultSubmissionListError}</p>
              )}
            </div>
          )}
        </div>
      ) : user?.role === "regional" && selectedSectionId === "observation" && !selectedObservationGroupId ? (
        <div className="module-table-view">
          <button className="module-back-button" onClick={handleBack} type="button" style={wordTableStyles.backButton}><T>{"Артка"}</T></button>
          <div className="module-document-list">
            <button className="module-document-card" onClick={() => setSelectedObservationGroupId("subunits")} type="button">
              <span aria-hidden="true" className="module-document-icon" />
              <strong><T>{"Бөлүкчөлөрдүн көзөмөл сабактары"}</T></strong>
            </button>
            <button className="module-document-card" onClick={() => setSelectedObservationGroupId("regional-unit")} type="button">
              <span aria-hidden="true" className="module-document-icon" />
              <strong><T>{"Аскер бөлүктүн көзөмөл сабактары"}</T></strong>
            </button>
          </div>
          <div className="module-submission-list">
            <h3><T>{"Чыгыш"}</T></h3>
            <ObservationMonthlySubmissionStatus
              now={observationStatusNow}
              submission={latestRegionalObservationSubmission}
            />
            {observationOutgoingSubmissions.length > 0 ? observationOutgoingSubmissions.map((submission) => (
              <div className="module-period-row" key={`out-${submission.id}`}>
                <button className="module-period-card module-period-card--document" onClick={() => setSelectedResultSubmission(submission)} type="button">
                  <span aria-hidden="true" className="module-document-icon" />
                  <span className="module-submission-card__content"><strong><T>{submission.documentTitle}</T></strong><small><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(submission)}</small></span>
                </button>
                <div className="module-period-actions"><SubmissionEditPermissionButton onUpdated={(updated) => setResultSubmissions((items) => items.map((item) => item.id === updated.id ? updated : item))} submission={submission} /></div>
              </div>
            )) : <p className="dashboard-state"><T>{"Жөнөтүлгөн документтер азырынча жок."}</T></p>}
          </div>
        </div>
      ) : user?.role === "regional" && selectedObservationGroupId === "subunits" && selectedSectionId === "observation" ? (
        renderRegionalOutpostBrowser()
      ) : user?.role === "admin" && selectedSectionId === "inspection" ? (
        <div className="module-table-view">
          <button className="module-back-button" onClick={handleBack} type="button" style={wordTableStyles.backButton}><T>{"Артка"}</T></button>
          <div className="module-submission-list">
            <h3><T>{"Кириш"}</T></h3>
            {inspectionDisplayedIncoming.length > 0 ? inspectionDisplayedIncoming.map((submission) => (
              <div className="module-period-row" key={submission.id}>
                <button className="module-period-card module-period-card--document" onClick={() => setSelectedResultSubmission(submission)} type="button">
                  <span aria-hidden="true" className="module-document-icon" />
                  <span className="module-submission-card__content">
                    <strong><T>{submission.documentTitle}</T></strong>
                    <small><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(submission)}</small>
                    <small>{submission.table?.subsectionTitle || submission.senderName}</small>
                  </span>
                </button>
                <div className="module-period-actions">
                  <button disabled={deletingResultSubmissionId === submission.id} onClick={() => handleDeleteResultSubmission(submission)} type="button">
                    <T>{deletingResultSubmissionId === submission.id ? "Өчүрүү..." : "Өчүрүү"}</T>
                  </button>
                </div>
              </div>
            )) : <p className="dashboard-state"><T>{"Документтер азырынча жок."}</T></p>}
          </div>
        </div>
      ) : user?.role === "regional" && selectedSectionId === "inspection" && !selectedInspectionGroupId ? (
        <div className="module-table-view">
          <button
            className="module-back-button"
            onClick={data?.onBack || handleBack}
            type="button"
            style={wordTableStyles.backButton}
          ><T>{"Артка"}</T></button>
          <div className="module-document-list">
            <button
              className="module-document-card"
              onClick={() => setSelectedInspectionGroupId("subunits")}
              type="button"
            >
              <span aria-hidden="true" className="module-document-icon" />
              <strong><T>{"Бөлүкчөлөрдүн көзөмөл текшерүү сабактары"}</T></strong>
            </button>
            <button
              className="module-document-card"
              onClick={() => setSelectedInspectionGroupId("regional-unit")}
              type="button"
            >
              <span aria-hidden="true" className="module-document-icon" />
              <strong><T>{"Аскер бөлүктүн көзөмөл текшерүү сабактары"}</T></strong>
            </button>
          </div>
          <div className="module-submission-list">
            <h3><T>{"Чыгыш"}</T></h3>
            <InspectionReportingStatus
              now={observationStatusNow}
              submission={latestRegionalInspectionSubmission}
            />
            {inspectionOutgoingSubmissions.length > 0 ? inspectionOutgoingSubmissions.map((submission) => (
              <div className="module-period-row" key={`inspection-out-${submission.id}`}>
                <button className="module-period-card module-period-card--document" onClick={() => setSelectedResultSubmission(submission)} type="button">
                  <span aria-hidden="true" className="module-document-icon" />
                  <span className="module-submission-card__content">
                    <strong><T>{submission.documentTitle}</T></strong>
                    <small><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(submission)}</small>
                    <small>{submission.table?.subsectionTitle}</small>
                  </span>
                </button>
                <div className="module-period-actions"><SubmissionEditPermissionButton onUpdated={(updated) => setResultSubmissions((items) => items.map((item) => item.id === updated.id ? updated : item))} submission={submission} /></div>
              </div>
            )) : <p className="dashboard-state"><T>{"Жөнөтүлгөн документтер азырынча жок."}</T></p>}
          </div>
        </div>
      ) : user?.role === "regional" && selectedSectionId === "inspection" && selectedInspectionGroupId === "subunits" ? (
        renderRegionalOutpostBrowser()
      ) : !selectedSubsectionId ? (
        <div className="module-table-view">
          <button className="module-back-button" onClick={handleBack} type="button" style={wordTableStyles.backButton}><T>{"Артка"}</T></button>
          <div className="module-document-list">
            {selectedSubsections.map((subsection) => (
              <button
                className="module-document-card"
                key={subsection.id}
                onClick={() => handleSubsectionClick(subsection.id)}
                type="button"
              >
                <span aria-hidden="true" className="module-document-icon" />
                <strong><T>{subsection.title}</T></strong>
              </button>
            ))}
          </div>
          {selectedSectionId === OBSERVATION_SECTION_ID &&
          (
            user?.role === "outpost" ||
            (user?.role === "regional" && selectedObservationGroupId === "regional-unit")
          ) ? (
            <div className="module-submission-list">
              <h3>
                <T>{user?.role === "outpost"
                  ? "Заставадан аскер бөлүккө жөнөтүү"
                  : "Аскер бөлүктүн администраторго жөнөтүү"}</T>
              </h3>
              <ObservationMonthlySubmissionStatus
                now={observationStatusNow}
                submission={latestOwnObservationSubmission}
              />
            </div>
          ) : null}
          {selectedSectionId === INSPECTION_SECTION_ID &&
          user?.role === "regional" &&
          selectedInspectionGroupId === "regional-unit" ? (
            <div className="module-submission-list">
              <h3><T>{"Аскер бөлүгүнөн администраторго жөнөтүү"}</T></h3>
              <InspectionReportingStatus
                now={observationStatusNow}
                submission={latestOwnInspectionSubmission}
              />
            </div>
          ) : null}
          {user?.role === "outpost" && selectedSectionId === "inspection" && (
            <div className="module-submission-list">
              <h3><T>{"Чыгыш"}</T></h3>
              <InspectionReportingStatus
                now={observationStatusNow}
                submission={latestOwnInspectionSubmission}
              />
              {inspectionSubmissions.length > 0 ? inspectionSubmissions.map((submission) => (
                <div className="module-period-row" key={submission.id}>
                  <button
                    className="module-period-card module-period-card--document"
                    onClick={() => setSelectedResultSubmission(submission)}
                    type="button"
                  >
                    <span aria-hidden="true" className="module-document-icon" />
                    <span className="module-submission-card__content">
                      <strong><T>{submission.documentTitle}</T></strong>
                      <small><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(submission)}</small>
                      <small>{submission.table?.subsectionTitle}</small>
                    </span>
                  </button>
                  <div className="module-period-actions">
                    <SubmissionEditPermissionButton onUpdated={(updated) => setResultSubmissions((items) => items.map((item) => item.id === updated.id ? updated : item))} submission={submission} />
                    <button
                      disabled={deletingResultSubmissionId === submission.id}
                      onClick={() => handleDeleteResultSubmission(submission)}
                      type="button"
                    >
                      <T>{deletingResultSubmissionId === submission.id ? "Өчүрүү..." : "Өчүрүү"}</T>
                    </button>
                  </div>
                </div>
              )) : (
                <p className="dashboard-state"><T>{"Жөнөтүлгөн документтер азырынча жок."}</T></p>
              )}
              {resultSubmissionListError && (
                <p className="dashboard-error">{resultSubmissionListError}</p>
              )}
            </div>
          )}
        </div>
      ) : selectedPeriodId && selectedTable ? (
        <div className="table-view" style={wordTableStyles.container}>
          <button
            className="module-back-button"
            onClick={data?.onBack || handleBack}
            type="button"
            style={wordTableStyles.backButton}
          ><T>{"Артка"}</T></button>
          
          <textarea
            className="module-table-title"
            value={editableTitle}
            onChange={handleTitleChange}
            style={compactTitleStyle}
            rows={isBpPreparedSummary ? 4 : isCompactSummaryTable ? 2 : 3}
            placeholder={copyT("Таблицанын аталышын жазыңыз...")}
          />
          
          <ResultSamples periodKey={selectedPeriodId} user={user} readOnly={Boolean(selectedResultSubmission)}/>
          <div className="results-table-actions" style={wordTableStyles.actionsContainer}>
            <div style={wordTableStyles.actionsLeft}>
              <button
                disabled={!resultsTableHistory.canUndo}
                onClick={resultsTableHistory.undo}
                style={wordTableStyles.button}
                type="button"
              ><T>{"↶ Артка"}</T></button>
              <button
                disabled={!resultsTableHistory.canRedo}
                onClick={resultsTableHistory.redo}
                style={wordTableStyles.button}
                type="button"
              ><T>{"↷ Алдыга"}</T></button>
              <button style={wordTableStyles.button} onClick={handleAddRow} type="button"><T>{"+ Сап кошуу"}</T></button>
              <button 
                style={{...wordTableStyles.button, ...wordTableStyles.buttonSecondary}} 
                onClick={handleDeleteRow} 
                type="button"
                disabled={getEditableDataRowIndexes().length === 0}
              ><T>{"Сапты өчүрүү"}</T></button>
              <button style={wordTableStyles.button} onClick={handleSaveTable} type="button"><T>{"Сактоо"}</T></button>
              {!data?.hideResultSubmissionActions && (
                user?.role === "outpost" ||
                (data?.allowResultSubmission && user?.role === "regional") ||
                (
                  user?.role === "regional" &&
                  (
                    (selectedSectionId === "observation" && selectedObservationGroupId === "regional-unit") ||
                    (selectedSectionId === "inspection" && selectedInspectionGroupId === "regional-unit")
                  )
                )
              ) && (["observation", "inspection"].includes(selectedSectionId) || data?.allowResultSubmission) && (
                <button
                  onClick={handleOpenResultSendDialog}
                  style={{...wordTableStyles.button, ...wordTableStyles.buttonSecondary}}
                  type="button"
                ><T>{"Жөнөтүү"}</T></button>
              )}
              <button style={{...wordTableStyles.button, ...wordTableStyles.buttonSecondary}} type="button"><T>{"Өзгөртүү"}</T></button>
            </div>
            <div style={wordTableStyles.actionsRight}>
              <button 
                style={wordTableStyles.button} 
                onClick={() => {
                  setSectionInsertType("section");
                  setSectionTitle("");
                  setInsertPosition(0);
                  setIsInsertSectionDialogOpen(true);
                }} 
                type="button"
              ><T>{"+ Секция кошуу"}</T></button>
              {(selectedTable.type === "inspectionSecondSummary" || selectedTable.type === "inspectionBpFirstSummary" || selectedTable.type === "inspectionBpSecondSummary" || selectedTable.type === "inspectionBpFifthSummary") && (
                <button
                  style={{...wordTableStyles.button, ...wordTableStyles.buttonSecondary}}
                  onClick={handleAddCenteredSection}
                  type="button"
                ><T>{"+ Борбордук сап"}</T></button>
              )}
            </div>
          </div>

          <JournalHorizontalScroll showTop={false} key={selectedPeriod?.id || "results"} scrollRef={resultsTableScrollRef} tableRef={resultsTableElementRef} />
          <div
            className="table-wrap"
            onScroll={
              shouldSyncResultsTableScroll
                ? (event) => syncResultsTableScroll(event.currentTarget, resultsTopScrollRef)
                : undefined
            }
            ref={resultsTableScrollRef}
            style={{ border: '1px solid #000', overflowX: 'auto' }}
          >
            <table ref={resultsTableElementRef} className="training-table training-table--thematic-account" style={compactTableStyle}>
              <colgroup>
                {tableColumns.map((column) => (
                  <col
                    key={column.key}
                    style={
                      column.width
                        ? {
                            minWidth: `${column.width}px`,
                            width: `${column.width}px`,
                          }
                        : undefined
                    }
                  />
                ))}
              </colgroup>
              <thead>
                {tableHeaderRows.length > 0 ? (
                  tableHeaderRows.map((headerRow, rowIndex) => (
                    <tr key={rowIndex}>
                      {headerRow.map((cell) => (
                        <th
                          colSpan={cell.colSpan || 1}
                          key={cell.key}
                          rowSpan={cell.rowSpan || 1}
                          style={{
                            ...compactThStyle,
                            color: cell.key === "militaryName" ? "#ff3030" : wordTableStyles.th.color,
                            height: cell.vertical ? (isBpPreparedSummary ? "78px" : isCompactSummaryTable ? "82px" : "205px") : undefined,
                          }}
                        >
                          <textarea
                            className="training-table-input training-table-input--header"
                            onChange={(event) => handleHeaderCellChange(rowIndex, headerRow.indexOf(cell), event.target.value)}
                            rows={Math.max(1, String(cell.label || "").split("\n").length)}
                            style={cell.vertical ? compactHeaderTextareaVerticalStyle : compactHeaderTextareaStyle}
                            ref={node=>{if(node&&!cell.vertical){node.style.height="auto";node.style.height=`${Math.max(32,node.scrollHeight)}px`;}}}
                            value={cell.label}
                          />
                        </th>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    {tableColumns.map((column, columnIndex) => (
                      <th key={column.key} style={compactThStyle}>
                        <textarea
                          className="training-table-input training-table-input--header"
                          onChange={(event) => handleColumnLabelChange(columnIndex, event.target.value)}
                          rows={Math.max(1, String(column.label || "").split("\n").length)}
                          style={compactHeaderTextareaStyle}
                          value={column.label}
                        />
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {editableRows.map((row, rowIndex) => {
                  if (row.__isCenteredSection) {
                    return (
                      <tr key={rowIndex}>
                        <td
                          colSpan={tableColumns.length}
                          style={(isInspectionBpFirstSummary || isInspectionBpSecondSummary || isInspectionBpFifthSummary) ? { ...compactTdStyle, position: 'relative' } : wordTableStyles.sectionFirstCol}
                        >
                          <div style={{...wordTableStyles.sectionContainer, justifyContent: 'center'}}>
                            <input
                              className="training-table-input"
                              onChange={(event) => handleSectionTitleChange(rowIndex, event.target.value)}
                              style={{
                                ...wordTableStyles.sectionTitleInput,
                                textAlign: 'center',
                                fontSize: (isInspectionBpFirstSummary || isInspectionBpSecondSummary || isInspectionBpFifthSummary) ? '10pt' : wordTableStyles.sectionTitleInput.fontSize,
                                paddingLeft: 0,
                              }}
                              type="text"
                              value={row.sectionTitle}
                            />
                            {(isInspectionBpFirstSummary || isInspectionBpSecondSummary || isInspectionBpFifthSummary) ? (
                              <button
                                onClick={() => handleDeleteSection(rowIndex)}
                                style={wordTableStyles.compactSectionDeleteButton}
                                type="button"
                              >
                                ×
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDeleteSection(rowIndex)}
                                style={wordTableStyles.buttonDanger}
                              ><T>{"Өчүрүү"}</T></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (row.__isSection) {
                    const columns = tableColumns;
                    const sectionColSpan = selectedTable.sectionColSpan || 2;
                    return (
                      <tr key={rowIndex}>
                        {columns.map((column, colIndex) => {
                          if (colIndex === 0) {
                            return (
                              <td key={column.key} style={wordTableStyles.sectionFirstCol} colSpan={sectionColSpan}>
                                <div style={wordTableStyles.sectionContainer}>
                                  <input
                                    className="training-table-input"
                                    onChange={(event) => handleSectionTitleChange(rowIndex, event.target.value)}
                                    style={wordTableStyles.sectionTitleInput}
                                    type="text"
                                    value={row.sectionTitle}
                                  />
                                  <button
                                    onClick={() => handleDeleteSection(rowIndex)}
                                    style={wordTableStyles.buttonDanger}
                                  ><T>{"Өчүрүү"}</T></button>
                                </div>
                              </td>
                            );
                          } else if (colIndex < sectionColSpan) {
                            return null;
                          } else {
                            return (
                              <td
                                key={column.key}
                                style={column.highlightSection ? wordTableStyles.sectionHighlightedCol : wordTableStyles.sectionEmptyCol}
                              >
                                <input
                                  className="training-table-input"
                                  onChange={(event) => handleCellChange(rowIndex, column.key, event.target.value)}
                                  type="text"
                                  value={row[column.key] || ""}
                                  style={wordTableStyles.sectionInput}
                                  placeholder=""
                                />
                              </td>
                            );
                          }
                        })}
                      </tr>
                    );
                  }

                  return (
                    <tr key={rowIndex}>
                      {tableColumns.map((column, colIndex) => {
                        const shouldMergeBpLabelCells =
                          (isInspectionBpFirstSummary || isInspectionBpSecondSummary || isInspectionBpFifthSummary) && row.number === "" && Boolean(row.subdivision);
                        const shouldMergeSummaryLabelCells =
                          shouldMergeBpLabelCells || row.__isSummary || row.subdivision === "Баары:";

                        if (shouldMergeSummaryLabelCells && colIndex === 0) {
                          return (
                            <td key={column.key} colSpan={2} style={compactTdStyle}>
                              <input
                                className="training-table-input"
                                onChange={(event) => handleCellChange(rowIndex, "subdivision", event.target.value)}
                                type="text"
                                value={row.subdivision || ""}
                                style={{...compactInputStyle, fontWeight: 'bold', textAlign: 'left'}}
                              />
                            </td>
                          );
                        }

                        if (shouldMergeSummaryLabelCells && colIndex === 1) {
                          return null;
                        }

                        return (
                          <td key={column.key} style={compactTdStyle}>
                            {column.type === "textarea" ? (
                              <textarea
                                className="training-table-input training-table-input--textarea"
                                onChange={(event) => handleCellChange(rowIndex, column.key, event.target.value)}
                                rows={column.rows || 2}
                                value={row[column.key] || ""}
                                style={isCompactSummaryTable ? { ...wordTableStyles.textarea, fontSize: '9pt', padding: '0 1px' } : wordTableStyles.textarea}
                              />
                            ) : (
                              <input
                                className="training-table-input"
                                onChange={(event) => handleCellChange(rowIndex, column.key, event.target.value)}
                                type={column.type === "number" ? "number" : "text"}
                                value={row[column.key] || ""}
                                style={compactInputStyle}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sectionsWithCreate.includes(selectedSubsectionId) && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
              <button
                onClick={handleAddKojResultColumn}
                style={wordTableStyles.button}
                type="button"
              ><T>{"+ Мамычаны кошуу"}</T></button>
            </div>
          )}
          <div style={wordTableStyles.footerWrapper}>
            <StudyNumberFooter
              aria-label={copyT("Таблицанын жыйынтык бөлүгү")}
              className="module-table-footer"
              onChange={handleFooterChange}
              rows={isInspectionSecondSummary ? 8 : isInspectionBpPlainSummary ? 6 : isInspectionBpFirstSummary ? 5 : 17}
              style={compactFooterTextareaStyle}
              value={editableFooter}
            />
          </div>
        </div>
      ) : (
        <div className="module-table-view">
          <button className="module-back-button" onClick={handleBack} type="button" style={wordTableStyles.backButton}><T>{"Артка"}</T></button>
          <div className="module-period-list">
            {selectedPeriods.map((period) => {
              const isCustomPeriod = customPeriods.some((customPeriod) => customPeriod.id === period.id);
              return (
                <div className="module-period-row" key={period.id}>
                  <button
                    className="module-period-card module-period-card--document"
                    onClick={() => handlePeriodClick(period.id)}
                    type="button"
                  >
                    <span aria-hidden="true" className="module-document-icon" />
                    <strong>{period.title}</strong>
                  </button>
                  {isCustomPeriod && (
                    <div className="module-period-actions">
                      <button onClick={() => handleEditDocument(period)} type="button"><T>{"Өзгөртүү"}</T></button>
                      <button onClick={() => handleDeleteDocument(period)} type="button"><T>{"Өчүрүү"}</T></button>
                    </div>
                  )}
                </div>
              );
            })}
            {selectedSectionId === "observation" &&
            sectionsWithCreate.includes(selectedSubsectionId) ? (
              <button
                className="module-period-add-button"
                onClick={handleCreateDocument}
                type="button"
              ><T>{"+ Кошуу"}</T></button>
            ) : null}
          </div>
          {user?.role === "outpost" && selectedSectionId === "observation" && (
            <div className="module-submission-list">
              <h3><T>{"Чыгыш"}</T></h3>
              {selectedObservationSubmissions.length > 0 ? selectedObservationSubmissions.map((submission) => (
                <div className="module-period-row" key={`observation-submission-${submission.id}`}>
                  <button
                    className="module-period-card module-period-card--document"
                    onClick={() => setSelectedResultSubmission(submission)}
                    type="button"
                  >
                    <span aria-hidden="true" className="module-document-icon" />
                    <span className="module-submission-card__content">
                      <strong><T>{submission.documentTitle}</T></strong>
                      <small><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(submission)}</small>
                      <small>
                        {submission.table?.subjects?.[selectedSubsectionId]?.periodTitle || selectedSubsection?.title}
                      </small>
                    </span>
                  </button>
                  <div className="module-period-actions">
                    <SubmissionEditPermissionButton onUpdated={(updated) => setResultSubmissions((items) => items.map((item) => item.id === updated.id ? updated : item))} submission={submission} />
                    <button
                      disabled={deletingResultSubmissionId === submission.id}
                      onClick={() => handleDeleteResultSubmission(submission, selectedSubsectionId)}
                      type="button"
                    >
                      <T>{deletingResultSubmissionId === submission.id ? "Өчүрүү..." : "Өчүрүү"}</T>
                    </button>
                  </div>
                </div>
              )) : (
                <p className="dashboard-state"><T>{"Жөнөтүлгөн документтер азырынча жок."}</T></p>
              )}
              {resultSubmissionListError && (
                <p className="dashboard-error">{resultSubmissionListError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {isResultSendDialogOpen && (
        <div className="lesson-period-dialog" role="dialog" aria-modal="true" aria-labelledby="result-send-dialog-title">
          <form
            className="lesson-period-dialog__panel"
            onSubmit={(event) => {
              event.preventDefault();
              handleSendResult();
            }}
          >
            <h2 id="result-send-dialog-title"><T>{"Документти жөнөтүү"}</T></h2>
            <input
              autoFocus
              onChange={(event) => {
                setResultSubmissionTitle(event.target.value);
                setResultSubmissionError("");
              }}
              placeholder="Иш кагаздардын аталышы"
              type="text"
              value={resultSubmissionTitle}
            />
            {resultSubmissionError && <p className="lesson-period-dialog__error">{resultSubmissionError}</p>}
            <div className="lesson-period-dialog__actions">
              <button
                disabled={isSendingResult}
                onClick={() => setIsResultSendDialogOpen(false)}
                type="button"
              ><T>{"Жокко чыгаруу"}</T></button>
              <button disabled={isSendingResult} type="submit">
                <T>{isSendingResult ? "Жөнөтүлүүдө..." : "Жөнөтүү"}</T>
              </button>
            </div>
          </form>
        </div>
      )}

      {isCreateDialogOpen && (
        <div className="lesson-period-dialog" role="dialog" aria-modal="true" aria-labelledby="create-dialog-title">
          <form className="lesson-period-dialog__panel" onSubmit={(event) => {
            event.preventDefault();
            handleSaveDocument();
          }}>
            <h2 id="create-dialog-title"><T>{"Документ түзүү"}</T></h2>
            <textarea
              className="lesson-period-dialog__textarea"
              onChange={(event) => setDocumentTitle(event.target.value)}
              rows={5}
              value={documentTitle}
            />
            <div className="lesson-period-dialog__actions">
              <button onClick={handleCloseCreateDialog} type="button"><T>{"Жокко чыгаруу"}</T></button>
              <button type="submit"><T>{"Сактоо"}</T></button>
            </div>
          </form>
        </div>
      )}

      {isEditDialogOpen && (
        <div className="lesson-period-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-dialog-title">
          <form className="lesson-period-dialog__panel" onSubmit={(event) => {
            event.preventDefault();
            handleUpdateDocument();
          }}>
            <h2 id="edit-dialog-title"><T>{"Өзгөртүү"}</T></h2>
            <textarea
              className="lesson-period-dialog__textarea"
              onChange={(event) => setDocumentTitle(event.target.value)}
              rows={5}
              value={documentTitle}
            />
            <div className="lesson-period-dialog__actions">
              <button onClick={handleCloseEditDialog} type="button"><T>{"Жокко чыгаруу"}</T></button>
              <button type="submit"><T>{"Сактоо"}</T></button>
            </div>
          </form>
        </div>
      )}


      <SubmissionForwardDialog
        onClose={() => setForwardingSubmission(null)}
        onForward={async (submission, title) => {
          const forwarded = await forwardThematicAccountSubmission(submission.id, title);
          setResultSubmissions((items) => [forwarded, ...items]);
        }}
        submission={forwardingSubmission}
      />
      {rowActionDialog && (
        <>
          <div
            style={wordTableStyles.dialogOverlay}
            onClick={() => setRowActionDialog(null)}
          />
          <div className="results-table-dialog" style={wordTableStyles.dialog} role="dialog" aria-modal="true">
            <h2 style={wordTableStyles.dialogTitle}>
              <T>{rowActionDialog === "add" ? "Сап кошуу" : "Сап өчүрүү"}</T>
            </h2>
            <div>
              <label style={wordTableStyles.dialogLabel}>
                <T>{rowActionDialog === "add"
                  ? "После какой строки добавить новую строку:"
                  : "Какую строку удалить:"}</T>
              </label>
              <select
                autoFocus
                value={selectedRowIndex}
                onChange={(event) => setSelectedRowIndex(Number(event.target.value))}
                style={wordTableStyles.dialogSelect}
              >
                {rowActionDialog === "add" ? (
                  <option value={-1}><T>{"В начало таблицы"}</T></option>
                ) : null}
                {editableRows.map((row, index) => {
                  if (row.__isSection || row.__isCenteredSection || row.__isSummary || row.__isResultColumn) {
                    return null;
                  }
                  const details =
                    row.personalNumber ||
                    row.fullName ||
                    row.name ||
                    row.subdivision ||
                    "";
                  return (
                    <option key={index} value={index}><T>{"Строка №"}</T>{row.number || index + 1}{details ? ` — ${details}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            {rowActionDialog === "add" && <p style={{fontSize:13}}>Номер присвоится автоматически. Следующие строки будут перенумерованы.</p>}
            <div style={wordTableStyles.dialogActions}>
              <button
                onClick={() => setRowActionDialog(null)}
                style={{...wordTableStyles.dialogButton, ...wordTableStyles.dialogButtonSecondary}}
                type="button"
              ><T>{"Жокко чыгаруу"}</T></button>
              <button
                onClick={handleConfirmRowAction}
                style={{
                  ...wordTableStyles.dialogButton,
                  ...wordTableStyles.dialogButtonPrimary,
                }}
                type="button"
              >
                <T>{rowActionDialog === "add" ? "Кошуу" : "Өчүрүү"}</T>
              </button>
            </div>
          </div>
        </>
      )}
      {isInsertSectionDialogOpen && (
        <>
          <div style={wordTableStyles.dialogOverlay} onClick={() => setIsInsertSectionDialogOpen(false)} />
          <div className="results-table-dialog" style={wordTableStyles.dialog} role="dialog" aria-modal="true">
            <h2 style={wordTableStyles.dialogTitle}>
              <T>{sectionInsertType === "centered" ? "Борбордук сап кошуу" : "Секция кошуу"}</T>
            </h2>
            <div>
              <label style={wordTableStyles.dialogLabel}>
                <T>{sectionInsertType === "centered" ? "Саптын тексти:" : "Секциянын аталышы:"}</T>
              </label>
              <input
                type="text"
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                placeholder={sectionInsertType === "centered" ? "Негизги бөлүкчөлөр" : "Мисалы: 1-бөлүмчө үчүн:"}
                style={wordTableStyles.dialogInput}
              />
            </div>
            <div>
              <label style={wordTableStyles.dialogLabel}><T>{"Кайсы саптан кийин кошуу:"}</T></label>
              <select
                value={insertPosition}
                onChange={(e) => setInsertPosition(Number(e.target.value))}
                style={wordTableStyles.dialogSelect}
              >
                <option value={0}><T>{"Башына"}</T></option>
                {editableRows.map((row, index) => {
                  const rowNumber = row.__isSection || row.__isCenteredSection || row.__isSummary
                    ? row.sectionTitle || row.subdivision
                    : `№${row.number}`;
                  return (
                    <option key={index} value={index + 1}>
                      {index + 1}<T>{"-саптан кийин ("}</T>{rowNumber})
                    </option>
                  );
                })}
                <option value={editableRows.length}><T>{"Аягына"}</T></option>
              </select>
            </div>
            <div style={wordTableStyles.dialogActions}>
              <button
                onClick={() => setIsInsertSectionDialogOpen(false)}
                style={{...wordTableStyles.dialogButton, ...wordTableStyles.dialogButtonSecondary}}
              ><T>{"Жокко чыгаруу"}</T></button>
              <button
                onClick={handleInsertSection}
                style={{...wordTableStyles.dialogButton, ...wordTableStyles.dialogButtonPrimary}}
              ><T>{"Кошуу"}</T></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

