import {useLanguage as useCopyLanguage} from "../../../i18n.jsx";
import MobileTableFit from "./MobileTableFit.jsx";
import { moduleNavigationKey } from "../../../utils/moduleNavigation.js";
import { notifySave } from "../../../utils/saveFeedback.js";
import AutoSizeHeader from "./AutoSizeHeader.jsx";
import { T } from "../../../i18n.jsx";
import { useHistoryState } from "../../../hooks/useHistoryState.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { annualKey, reportingYear, writeAnnualDraft } from "../../../annualWorkspace.js";

import {
  createLibraryPeriod,
  createLessonSchedulePeriod,
  createThematicAccountSubmission,
  deleteLibraryPeriod,
  deleteLessonSchedulePeriod,
  deleteThematicAccountSubmission,
  forwardThematicAccountSubmission,
  getThematicAccountSubmissions,
  markThematicAccountSubmissionRead,
  updateLibraryPeriod,
  updateThematicAccountSubmission,
} from "../../../api/dashboard.js";
import { getApiErrorMessage } from "../../../api/errors.js";
import {
  OUTPOSTS_BY_MILITARY_UNIT,
  formatOutpostName,
} from "../../../data/militaryUnits.js";
import { expandJournalColumns } from "../../../utils/journalColumns.js";
import useDocumentHistory from "../../../hooks/useDocumentHistory.js";
import { confirmDocumentSend } from "../../../utils/confirmDocumentSend.js";
import { getDocumentRegistrationCode } from "../../../utils/documentRegistration.js";
import SubmissionForwardDialog from "./SubmissionForwardDialog.jsx";
import JournalHorizontalScroll from "./JournalHorizontalScroll.jsx";
import SubmissionEditPermissionButton from "./SubmissionEditPermissionButton.jsx";
import MilitaryUnitIcon from "./MilitaryUnitIcon.jsx";

const TABLE_STORAGE_PREFIX = "munara-library-table";
const TABLE_FIELD_STORAGE_SUFFIX = "fields";
const TABLE_ACTION_STORAGE_SUFFIX = "action";
const CUSTOM_PERIODS_STORAGE_PREFIX = "munara-library-custom-periods";
const HIDDEN_THEMATIC_MONTHS_STORAGE_PREFIX =
  "munara-library-hidden-thematic-months";
const CUSTOM_THEMATIC_MONTHS_STORAGE_PREFIX =
  "munara-library-custom-thematic-months";
export const SAVED_TABLES_STORAGE_KEY = "munara-library-saved-tables";
const EMPTY_ARRAY = [];
const MULTILINE_COLUMN_KEYS = new Set([
  "activity",
  "completion_note",
  "topic_method",
]);
const COMMAND_THEMATIC_ACCOUNT_SECTION_ID = "command-thematic-account";
const WEEKLY_SCHEDULE_SECTION_IDS = new Set([
  "lesson-schedule",
  "command-lesson-schedule",
]);
const WEEKLY_SUBMISSION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const THEMATIC_ACCOUNT_SECTION_IDS = new Set(["thematic-account", "command-thematic-account"]);
const LESSON_SCHEDULE_SECTION_IDS = new Set(["lesson-schedule", "command-lesson-schedule"]);
const ADMIN_GROUPED_SUBMISSION_SECTION_IDS = new Set([
  "thematic-account",
  "lesson-schedule",
  "command-thematic-account",
  "command-lesson-schedule",
]);
const OUTPOST_SUBMISSION_SECTION_IDS = new Set([
  "thematic-account",
  "lesson-schedule",
  "command-thematic-account",
  "command-lesson-schedule",
  "typical-week",
  "combat-training-personnel-journal",
  "combat-training-command-journal",
  "meetings-thematic-account",
  "meetings-lesson-schedule",
  "meetings-combat-training-journal",
  "young-soldier-thematic-account",
  "young-soldier-lesson-schedule",
  "young-soldier-combat-training-journal",
]);
const COMMAND_SUBMISSION_SECTION_IDS = new Set([
  "command-thematic-account",
  "command-lesson-schedule",
]);

const getHiddenThematicMonthsStorageKey = (scope, documentId) =>
  `${HIDDEN_THEMATIC_MONTHS_STORAGE_PREFIX}:${scope || "default"}:${
    documentId || "default"
  }`;

const getCustomThematicMonthsStorageKey = (scope, documentId) =>
  `${CUSTOM_THEMATIC_MONTHS_STORAGE_PREFIX}:${scope || "default"}:${
    documentId || "default"
  }`;

const getStoredHiddenThematicMonths = (scope, documentId) => {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(
        getHiddenThematicMonthsStorageKey(scope, documentId)
      ) || "[]"
    );
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

const getStoredCustomThematicMonths = (scope, documentId) => {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(
        getCustomThematicMonthsStorageKey(scope, documentId)
      ) || "[]"
    );
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

const appendCustomThematicMonths = (table, customMonths) => {
  if (
    table?.variant !== "thematic-account" ||
    !Array.isArray(customMonths) ||
    customMonths.length === 0
  ) {
    return table;
  }

  const customColumns = customMonths.flatMap((month) =>
    ["1", "2", "3", "4", "5"].map((week) => ({
      key: `${month.key}_${week}`,
      label: week,
      width: 54,
    }))
  );
  const headerRows = (table.headerRows || []).map((row) => [...row]);
  if (headerRows[0]) {
    headerRows[0].push(
      ...customMonths.map((month) => ({
        key: month.key,
        label: month.label,
        defaultValue: month.label,
        editableKey: `${month.key}_label`,
        colSpan: 5,
      }))
    );
  }
  if (headerRows[1]) {
    headerRows[1].push(
      ...customMonths.flatMap((month) =>
        ["1", "2", "3", "4", "5"].map((week) => ({
          key: `${month.key}_${week}`,
          label: week,
        }))
      )
    );
  }

  return {
    ...table,
    columns: [...(table.columns || []), ...customColumns],
    headerRows,
    rows: (table.rows || []).map((row) => ({
      ...customColumns.reduce(
        (values, column) => ({ ...values, [column.key]: "" }),
        {}
      ),
      ...row,
    })),
  };
};

const hideThematicMonthColumns = (table, hiddenMonthKeys) => {
  if (
    table?.variant !== "thematic-account" ||
    !Array.isArray(hiddenMonthKeys) ||
    hiddenMonthKeys.length === 0
  ) {
    return table;
  }

  const isHiddenKey = (key) =>
    hiddenMonthKeys.some(
      (monthKey) => key === monthKey || String(key || "").startsWith(`${monthKey}_`)
    );

  return {
    ...table,
    columns: (table.columns || []).filter((column) => !isHiddenKey(column.key)),
    headerRows: (table.headerRows || []).map((row) =>
      row.filter((cell) => !isHiddenKey(cell.key))
    ),
  };
};
const REMOVED_THEMATIC_PERIOD_IDS = new Set(["period-1", "period-2", "period-3", "period-4"]);
const REMOVED_THEMATIC_PERIOD_TITLE_PARTS = [
  "2026-окуу жылынын 2 мезгилине",
  "2026-окуу жылынын 3 мезгилине",
  "2026-окуу жылынын 4 мезгилине",
  "20__-окуу жылынын 2 мезгилине",
  "20__-окуу жылынын 3 мезгилине",
  "20__-окуу жылынын 4 мезгилине",
];
const THEMATIC_ACCOUNT_UNIT_TEXT = "2027 аскер бөлүгүнүн";
const THEMATIC_ACCOUNT_YEAR_TEXT = "2026-окуу жылынын";
const THEMATIC_ACCOUNT_YEAR_PLACEHOLDER = "20__-окуу жылынын";

const buildThematicAccountTableTitle = (periodNumber) =>
  `20__-окуу жылынын ${periodNumber} мезгилине_______аскер бөлүгүнүн "__________" чек ара заставынын (тобунун, взвод, ротосынын) өздүк курамы  менен өтүлгүүчү   сабактардын тематикалык эсеп сааты.`;

const getPeriodNumber = (period) => {
  const idMatch = String(period?.id || "").match(/^period-(\d+)$/);
  if (idMatch) {
    return idMatch[1];
  }

  return String(period?.title || "").match(/20__-окуу жылынын\s+(\d+)\s+мезгилине/)?.[1];
};

const buildCommandThematicAccountTableTitle = (periodNumber = "___") =>
  `20__-окуу жылынын ${periodNumber} мезгилине_______аскер бөлүгүнүн "__________" чек ара заставынын (тобунун, взвод, ротосынын) сержант,  прапорщиктердин
өздүк курамы  менен өтүлгүүчү командирдик даярдык боюбнча  сабактардын тематикалык эсеп сааты.`;

const LESSON_SCHEDULE_MONTH_PLACEHOLDER = "";
const LESSON_SCHEDULE_WEEK_PLACEHOLDER = "1";

const buildLessonSchedulePeriodTitle = (weekNumber, month = "") =>
  `Сабактардын жүгүртмөсү ${month ? `"${month} "айынын ` : ""}${weekNumber} жумасы`;

const normalizeThematicAccountTitle = (title = "", isCommand = false, periodNumber) => {
  const rawTitle = String(title || "")
    .replace(THEMATIC_ACCOUNT_YEAR_TEXT, THEMATIC_ACCOUNT_YEAR_PLACEHOLDER)
    .replace(THEMATIC_ACCOUNT_UNIT_TEXT, "");
  const compactTitle = rawTitle.replace(/\s{2,}/g, " ").trim();
  if (isCommand && rawTitle.includes("тематикалык эсеп сааты")) {
    return buildCommandThematicAccountTableTitle(periodNumber);
  }

  const periodMatch = compactTitle.match(/20__-окуу жылынын\s+(\d+)\s+мезгилине/);
  const hasOldTableTitle =
    compactTitle.includes("чек ара заставынын сержанттары") ||
    compactTitle.includes("командирдик даярдык боюнча сабактардын тематикалык эсеп сааты");

  if (periodMatch && hasOldTableTitle) {
    return buildThematicAccountTableTitle(periodMatch[1]);
  }

  if (rawTitle.includes("өздүк курамы") && rawTitle.includes("тематикалык эсеп сааты")) {
    return rawTitle.trim();
  }

  return compactTitle;
};

const isRemovedThematicPeriod = (period) =>
  !String(period?.id || "").startsWith("admin-document-") &&
  (
    REMOVED_THEMATIC_PERIOD_IDS.has(period?.id) ||
    REMOVED_THEMATIC_PERIOD_TITLE_PARTS.some((titlePart) =>
      String(period?.title || "").includes(titlePart)
    )
  );

const normalizeThematicPeriod = (period, sectionId) => {
  const isCommand = sectionId === COMMAND_THEMATIC_ACCOUNT_SECTION_ID;
  const periodNumber = getPeriodNumber(period);

  return {
    ...period,
    title: normalizeThematicAccountTitle(period?.title, isCommand, periodNumber),
    table: period?.table
      ? {
          ...period.table,
          title: normalizeThematicAccountTitle(period.table.title, isCommand, periodNumber),
        }
      : period?.table,
  };
};

const getVisibleThematicPeriods = (periods = EMPTY_ARRAY, sectionId) =>
  periods
    .filter((period) => !isRemovedThematicPeriod(period))
    .map((period) => normalizeThematicPeriod(period, sectionId));

const getTableStorageKey = (scope, sectionId, periodId) =>
  `${TABLE_STORAGE_PREFIX}:${scope || "default"}:${sectionId || "default"}:${periodId || "default"}`;

const getHeaderStorageKey = (tableStorageKey) =>
  tableStorageKey ? `${tableStorageKey}:${TABLE_FIELD_STORAGE_SUFFIX}` : null;

const getActionStorageKey = (tableStorageKey) =>
  tableStorageKey ? `${tableStorageKey}:${TABLE_ACTION_STORAGE_SUFFIX}` : null;

const getTitleStorageKey = (tableStorageKey) =>
  tableStorageKey ? `${tableStorageKey}:title` : null;

const getCustomPeriodsStorageKey = (scope, sectionId, subsectionId) =>
  sectionId
    ? `${CUSTOM_PERIODS_STORAGE_PREFIX}:${scope || "default"}:${sectionId}:${
        subsectionId || "default"
      }`
    : null;

const getLatestSubmission = (submissions = EMPTY_ARRAY) =>
  [...submissions].sort(
    (left, right) =>
      new Date(right.updatedAt || right.createdAt) -
      new Date(left.updatedAt || left.createdAt)
  )[0] || null;

const formatWeeklyCountdown = (submission, now) => {
  const sentAt = new Date(submission?.updatedAt || submission?.createdAt || "").getTime();
  if (!Number.isFinite(sentAt)) return "";

  const remainingSeconds = Math.max(
    0,
    Math.ceil((sentAt + WEEKLY_SUBMISSION_WINDOW_MS - now) / 1000)
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

const WeeklySubmissionStatus = ({ submission, now }) => {
  const sentAt = new Date(submission?.updatedAt || submission?.createdAt || "").getTime();
  const isSent = Number.isFinite(sentAt) &&
    sentAt <= now &&
    now - sentAt < WEEKLY_SUBMISSION_WINDOW_MS;
  const countdown = formatWeeklyCountdown(submission, now);

  return (
    <span className="library-weekly-status-group">
      <span
        className={`library-weekly-status library-weekly-status--${
          isSent ? "sent" : "missing"
        }`}
      >
        <T>{isSent ? "Аткарылды" : "Аткарылган эмес"}</T>
      </span>
      <span className="library-weekly-countdown">
        <T>{isSent && countdown
          ? `Кийинки жөнөтүүгө чейин: ${countdown}`
          : "Азыр жөнөтүү керек"}</T>
      </span>
    </span>
  );
};

const getStoredRows = (rows, storageKey) => {
  if (!storageKey || typeof window === "undefined") {
    return rows;
  }

  try {
    const savedRows = JSON.parse(window.localStorage.getItem(storageKey) || "[]");

    if (!Array.isArray(savedRows)) {
      return rows;
    }

    const mergedRows = rows.map((row, index) => ({
      ...row,
      ...(savedRows[index] || {}),
      ...(row.topicPlaceholder && savedRows[index] && !savedRows[index].topicPlaceholder && savedRows[index].topic === row.topicPlaceholder
        ? { topic: "", topicPlaceholder: row.topicPlaceholder }
        : {}),
      ...(row.number !== undefined ? { number: row.number } : {}),
    }));
    return [...mergedRows, ...savedRows.slice(rows.length)];
  } catch {
    return rows;
  }
};

const getDefaultHeaderValues = (fields = []) =>
  fields.reduce((values, field) => {
    if (field.key) {
      values[field.key] = field.defaultValue ?? "";
    }

    return values;
  }, {});

const getStoredHeaderValues = (fields, storageKey) => {
  const defaults = getDefaultHeaderValues(fields);

  if (!storageKey || typeof window === "undefined") {
    return defaults;
  }

  try {
    const savedValues = JSON.parse(window.localStorage.getItem(storageKey) || "{}");

    if (!savedValues || Array.isArray(savedValues) || typeof savedValues !== "object") {
      return defaults;
    }

    return Object.keys(defaults).reduce(
      (values, key) => ({
        ...values,
        [key]: savedValues[key] ?? defaults[key],
      }),
      {
        ...defaults,
        ...Object.fromEntries(Object.entries(savedValues).filter(([key]) =>
          key === "__journalAttendanceCount" || /^attendance_\d+(_hours|_date)?$/.test(key)
        )),
      }
    );
  } catch {
    return defaults;
  }
};

const getStoredTableStatus = (storageKey) => {
  if (!storageKey || typeof window === "undefined") {
    return "editing";
  }

  const savedStatus = window.localStorage.getItem(storageKey);
  return ["editing", "saved", "submitted"].includes(savedStatus) ? savedStatus : "editing";
};

const getStoredTitle = (defaultTitle, storageKey) => {
  if (!storageKey || typeof window === "undefined") {
    return defaultTitle || "";
  }

  try {
    return window.localStorage.getItem(storageKey) || defaultTitle || "";
  } catch {
    return defaultTitle || "";
  }
};

const getSavedTables = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const savedTables = JSON.parse(window.localStorage.getItem(SAVED_TABLES_STORAGE_KEY) || "[]");
    return Array.isArray(savedTables) ? savedTables : [];
  } catch {
    return [];
  }
};

const upsertSavedTable = (savedTable) => {
  if (typeof window === "undefined" || !savedTable?.id) {
    return;
  }

  const currentTables = getSavedTables();
  const nextTables = [
    savedTable,
    ...currentTables.filter((table) => table.id !== savedTable.id),
  ];

  try {
    window.localStorage.setItem(SAVED_TABLES_STORAGE_KEY, JSON.stringify(nextTables));
  } catch {
    // Saving the table itself should still work if the registry cannot be updated.
  }
};

const getStoredCustomPeriods = (storageKey) => {
  if (!storageKey || typeof window === "undefined") {
    return [];
  }

  try {
    const periods = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(periods) ? periods : [];
  } catch {
    return [];
  }
};

const saveCustomPeriods = (storageKey, periods) => {
  if (!storageKey || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(periods));
  } catch {
    // The added table should still open in the current session if storage is unavailable.
  }
};

const removeTableStorage = (scope, sectionId, periodId) => {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getTableStorageKey(scope, sectionId, periodId);
  [
    storageKey,
    getHeaderStorageKey(storageKey),
    getActionStorageKey(storageKey),
    getTitleStorageKey(storageKey),
  ].forEach((key) => {
    if (key) {
      window.localStorage.removeItem(key);
    }
  });
};

const getEditableHeaderFields = (table) => {
  const headerFields = table?.headerFields || EMPTY_ARRAY;
  const tableHeaderCells = (table?.headerRows || EMPTY_ARRAY)
    .flat()
    .filter((cell) => cell.editableKey)
    .map((cell) => ({
      key: cell.editableKey,
      label: cell.label,
      defaultValue: cell.defaultValue ?? cell.label ?? "",
    }));

  return [...headerFields, ...tableHeaderCells];
};

const ensureCombatHoursDateColumn = (table) => {
  if (table?.variant !== "combat-subject-journal") {
    return table;
  }

  const columns = (table.columns || [])
    .filter((column) => column.key !== "hours_number")
    .map((column) => column.key === "attendance_marker"
      ? { ...column, readOnly: true }
      : column);
  const hoursColumnIndex = columns.findIndex((column) => column.key === "hours");
  if (hoursColumnIndex < 0) {
    return table;
  }

  if (!columns.some((column) => column.key === "hours_date")) {
    columns.splice(hoursColumnIndex, 0, {
      key: "hours_date",
      label: "\u041a\u04af\u043d\u04af",
      type: "date",
      width: 150,
    });
  }

  const headerRows = (table.headerRows || []).map((row, rowIndex) => {
    const nextRow = row.filter((cell) => cell.key !== "hours_number");
    if (rowIndex !== 0 || nextRow.some((cell) => cell.key === "hours_date")) {
      return nextRow;
    }

    const hoursHeaderIndex = nextRow.findIndex((cell) => cell.key === "hours");
    if (hoursHeaderIndex >= 0) {
      nextRow.splice(hoursHeaderIndex, 0, {
        key: "hours_date",
        label: "\u041a\u04af\u043d\u04af",
        rowSpan: nextRow[hoursHeaderIndex].rowSpan,
        fixed: true,
      });
    }
    return nextRow;
  });

  return {
    ...table,
    columns,
    headerRows,
    rows: (table.rows || []).map((row) => ({
      ...row,
      attendance_marker: "",
      hours_date: row.hours_date || row.hours_number || "",
    })),
  };
};

const createEmptyTableRow = (table, rowNumber) =>
  (table?.columns || EMPTY_ARRAY).reduce((row, column) => {
    row[column.key] = column.key === "number" ? rowNumber : "";
    return row;
  }, {});

const isMultilineColumn = (column) =>
  column.type === "textarea" || column.multiline || MULTILINE_COLUMN_KEYS.has(column.key);

const resizeTextareaToContent = (textarea) => {
  if (!textarea) return;
  textarea.style.height = "0px";
  textarea.style.height = `${textarea.scrollHeight}px`;
};

const restoreContentEditableCaret = (element, offset) => {
  if (!element || offset === null || offset === undefined) return;

  window.requestAnimationFrame(() => {
    if (!element.isConnected) return;

    const selection = window.getSelection();
    if (!selection) return;

    const textNode = element.firstChild?.nodeType === 3 ? element.firstChild : null;
    const range = document.createRange();
    if (textNode) {
      range.setStart(textNode, Math.min(offset, textNode.textContent?.length || 0));
    } else {
      range.setStart(element, 0);
    }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  });
};

const getNestedSections = (section) => section?.sections || section?.subsections || EMPTY_ARRAY;

const getSubmissionSenderLabel = (submission) => {
  if (submission?.senderRole === "outpost") {
    const outpost = submission.outpostName || submission.senderName || "Застава көрсөтүлгөн эмес";
    const sender = submission.senderName && submission.senderName !== outpost
      ? ` · Жөнөтүүчү: ${submission.senderName}`
      : "";
    return submission.unitNumber
      ? `Застава: ${outpost} · Аскер бөлүгү: ${submission.unitNumber}${sender}`
      : `Застава: ${outpost}${sender}`;
  }

  const militaryUnit = submission?.unitNumber || "көрсөтүлгөн эмес";
  const sender = submission?.senderName ? ` · Жөнөтүүчү: ${submission.senderName}` : "";
  return `Аскер бөлүгү: ${militaryUnit}${sender}`;
};

const escapeExportHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const exportCellValue = (value) => {
  const normalizedValue = Array.isArray(value) ? value.join("\n") : value;
  return escapeExportHtml(normalizedValue).replaceAll("\n", "<br>");
};

const getExportHeaderCellValue = (cell) =>
  cell?.defaultValue !== undefined ? cell.defaultValue : cell?.label;

const buildSubmissionExportHtml = (submission) => {
  const table = submission?.table || {};
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const headerRows = Array.isArray(table.headerRows) ? table.headerRows : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const headerFields = Array.isArray(table.headerFields) ? table.headerFields : [];
  const title = submission?.documentTitle || table.title || "Документ";
  const headerHtml = headerRows.length > 0
    ? headerRows.map((headerRow) => `
        <tr>${headerRow.map((cell) => `
          <th${cell.colSpan ? ` colspan="${Number(cell.colSpan)}"` : ""}${
            cell.rowSpan ? ` rowspan="${Number(cell.rowSpan)}"` : ""
          }>${exportCellValue(getExportHeaderCellValue(cell))}</th>`).join("")}
        </tr>`).join("")
    : `<tr>${columns.map((column) => `<th>${exportCellValue(column.label)}</th>`).join("")}</tr>`;
  const bodyHtml = rows.map((row, rowIndex) => row.rowType === "section"
    ? `<tr><td colspan="${columns.length}" style="font-weight:bold;text-align:${["thematic-account", "command-thematic-account"].includes(table.variant) ? "left" : "center"}">${exportCellValue(row.activity)}</td></tr>`
    : `
      <tr>${columns.map((column) => {
        if (table.variant === "combat-subject-journal" && column.key === "attendance_marker") return "";
        const color = table.cellColors?.[`${rowIndex}:${column.key}`];
        const background = color === "green" ? "#55b86a" : color === "red" ? "#e25b56" : "";
        const mergedPersonalNumber = table.variant === "combat-subject-journal" && column.key === "personal_number" && columns.some((item) => item.key === "attendance_marker");
        return `<td${mergedPersonalNumber ? ' colspan="2"' : ""}${background ? ` style="background:${background}"` : ""}>${
          exportCellValue(row?.[column.key])
        }</td>`;
      }).join("")}</tr>`).join("");
  const fieldsHtml = headerFields.map((field) => {
    if (field.text) return `<span>${exportCellValue(field.text)}</span>`;
    return `<span>${exportCellValue(field.prefix)}${exportCellValue(field.defaultValue)}${
      exportCellValue(field.suffix)
    }</span>`;
  }).join(" ");

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
  <meta charset="utf-8">
  <title>${escapeExportHtml(title)}</title>
  <style>
    body { font-family: "Times New Roman", serif; }
    h1 { font-size: 16pt; text-align: center; }
    .fields { margin-bottom: 12px; text-align: center; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #000; font-size: 9pt; padding: 3px; text-align: center; vertical-align: middle; }
    th { font-weight: bold; white-space: pre-line; }
  </style>
</head>
<body>
  <h1>${escapeExportHtml(title)}</h1>
  ${fieldsHtml ? `<div class="fields">${fieldsHtml}</div>` : ""}
  <table>
    <thead>${headerHtml}</thead>
    <tbody>${bodyHtml}</tbody>
  </table>
</body>
</html>`;
};

const downloadSubmissionTable = (submission) => {
  if (typeof window === "undefined") return;

  const safeTitle = String(submission?.documentTitle || "document")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .trim()
    .slice(0, 120) || "document";
  const blob = new Blob(["\ufeff", buildSubmissionExportHtml(submission)], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeTitle}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
};

const SubmissionExportButtons = ({ submission }) => (
  <button onClick={() => downloadSubmissionTable(submission)} type="button">
    Excel
  </button>
);

const hasSectionContent = (section) =>
  Boolean(
    OUTPOST_SUBMISSION_SECTION_IDS.has(section?.id) ||
      section?.table ||
      section?.periods?.length > 0 ||
      getNestedSections(section).length > 0
  );

const createTypicalWeekTable = (title) => ({
  title,
  variant: "typical-week",
  columns: [
    {key: "number", label: "№", width: 64},
    {key: "routine", label: "Күн тартиби", type: "textarea", width: 420},
    {key: "time", label: "Убакыт", width: 180},
    {key: "duration", label: "Узактыгы", width: 180},
  ],
  rows: [
    {number: "1", routine: "", time: "", duration: ""},
  ],
});

const thematicAccountPeriodConfig = {
  buttonLabel: "+ Кошуу",
  promptLabel: "Аталышы",
  usesServerCreate: true,
  usesTextDialog: true,
  userManaged: true,
  getDefaultTitle: () => "",
};
const lessonSchedulePeriodConfig = {
  buttonLabel: "+ Жуманы кошуу",
  promptLabel: "Жуманын аталышы",
  usesMonthDialog: true,
  usesServerCreate: true,
  getDefaultTitle: (weekNumber) => buildLessonSchedulePeriodTitle(weekNumber),
};
const typicalWeekPeriodConfig = {
  buttonLabel: "+ Кошуу",
  promptLabel: "Аталышы",
  usesTextDialog: true,
  userManaged: true,
  createTable: createTypicalWeekTable,
  getDefaultTitle: () => "",
};

const buildThematicAccountDocumentPlaceholder = (user, isCommand = false) => {
  const unitName = `${user?.region || "2021"} аскер бөлүгүнүн`;
  const outpostName = user?.role === "outpost"
    ? ` ${formatOutpostName(user?.outpost_name || "Жаштык")}нын`
    : "";
  const trainingType = isCommand ? " командирдик даярдоо боюнча" : "";
  return `${unitName}${outpostName}${trainingType} 20__окуу жылынын тематикалык эсеби`;
};

const customPeriodConfigs = {
  "command-lesson-schedule": lessonSchedulePeriodConfig,
  "command-thematic-account": thematicAccountPeriodConfig,
  "lesson-schedule": lessonSchedulePeriodConfig,
  "thematic-account": thematicAccountPeriodConfig,
  "typical-week": typicalWeekPeriodConfig,
  "typical-week-military-unit": typicalWeekPeriodConfig,
};

const lessonScheduleDays = [
  ["monday", "Дүйшөмбү"],
  ["tuesday", "Шейшемби"],
  ["wednesday", "Шаршемби"],
  ["thursday", "Бейшемби"],
  ["friday", "Жума"],
  ["saturday", "Ишемби"],
  ["sunday", "Жекшемби"],
  ["methodical", "Методикалык нускамалоо"],
];

const lessonScheduleRows = [
  "Эртең мененки дене тарбия көнүгүүлөрү",
  "Машыгуулар жана маалымдоолор",
  "1-саат",
  "2-саат",
  "3-саат",
  "4-саат",
  "5-саат",
  "6-саат",
  "Техниканы куралды тейлөө",
  "Өздүк даярдануу",
  "Жалпы спорттук иш-чаралар, тарбия иштери",
  "Түнкү сабактар",
  "1-саат",
  "2-саат",
  "3-саат",
];

const thematicAccountMonths = [
  {key: "december", label: "ДЕКАБРЬ", weeks: ["1", "2", "3", "4", "5"]},
  {key: "january", label: "ЯНВАРЬ", weeks: ["1", "2", "3", "4", "5"]},
  {key: "february", label: "ФЕВРАЛЬ", weeks: ["1", "2", "3", "4", "5"]},
  {key: "march", label: "МАРТ", weeks: ["1", "2", "3", "4", "5"]},
  {key: "june", label: "ИЮНЬ", weeks: ["1", "2", "3", "4", "5"]},
  {key: "july", label: "ИЮЛЬ", weeks: ["1", "2", "3", "4", "5"]},
  {key: "august", label: "АВГУСТ", weeks: ["1", "2", "3", "4", "5"]},
  {key: "september", label: "СЕНТЯБРЬ", weeks: ["1", "2", "3", "4", "5"]},
];

const thematicAccountWeekColumns = thematicAccountMonths.flatMap((month) =>
  month.weeks.map((week) => ({
    key: `${month.key}_${week}`,
    label: week,
    width: 54,
  }))
);

const thematicAccountSubjects = [
  {number: "1", topic: "Чек ара аскерлеринин\nтактикасы\n(ЧАВ)", hours: "35"},
  {number: "2", topic: "Тактикалык даярдоо\n(ТД)", hours: "16"},
  {number: "3", topic: "Коомдук мамлекеттик\nдаярдык (ОГП)", hours: "32"},
  {number: "4", topic: "Ок атуу даярдыгы\n(ОП)", hours: "40"},
  {number: "5", topic: "Дене-тарбия даярдыгы\n(ФП)", hours: "26"},
  {number: "6", topic: "Аскердик топография\n(ВТ)", hours: "4"},
  {number: "7", topic: "Инженердик даярдоо", hours: "4"},
  {number: "8", topic: "Радиациялык химиялык\nбиологиялык коргонуу\n(РХБЗ)", hours: "2"},
  {number: "9", topic: "Байланыш боюнча\nдаярдоо (ПиС)", hours: "2"},
  {number: "10", topic: "Саптык даярдоо (СП)", hours: "6"},
  {number: "11", topic: "КР КК жалпы аскердик\nуставы (ОБУ ВС КР)", hours: "6"},
  {number: "12", topic: "Аскердик медициналык\nдаярдоо (ВМП)", hours: "4"},
  {number: "13", topic: "Психологиялык даярдоо\n(ПП)", hours: "2"},
  {number: "14", topic: "Аскердик жана\nмыйзамдык\nукуктардын негиздери\n(ОЗВиП)", hours: "3"},
  {number: "15", topic: "Элдик\nгуманитардык\nукуктардын негиздери\n(ОМГП)", hours: "2"},
  {number: "16", topic: "Өртке каршы даярдоо\n(ППП)", hours: "2"},
  {number: "17", topic: "Кадрлык иштер (КШ)", hours: "6"},
  {number: "18", topic: "Атайын даярдык (СП)", hours: "30"},
  {number: "19", topic: "Жыйынтыгы", hours: "192", rowType: "total"},
];

const thematicAccountTotalHours = [
  "5",
  "12",
  "12",
  "12",
  "12",
  "12",
  "12",
  "12",
  "12",
  "12",
  "12",
  "12",
  "12",
  "12",
  "12",
  "12",
  "12",
  "12",
  "12",
  "7",
];

const firstCommandThematicAccountMonths = [
  {key: "december", label: "ДЕКАБРЬ", slots: ["", ""]},
  {key: "january", label: "ЯНВАРЬ", slots: ["", ""]},
  {key: "february", label: "ФЕВРАЛЬ", slots: ["", ""]},
  {key: "march", label: "МАРТ", slots: ["", ""]},
  {key: "june", label: "ИЮНЬ", slots: ["", ""]},
  {key: "july", label: "ИЮЛЬ", slots: ["", ""]},
  {key: "august", label: "АВГУСТ", slots: ["", ""]},
  {key: "september", label: "СЕНТЯБРЬ", slots: ["", ""]},
];

const secondCommandThematicAccountMonths = [
  {key: "june", label: "ИЮНЬ", slots: ["", ""]},
  {key: "july", label: "ИЮЛЬ", slots: ["", ""]},
  {key: "august", label: "АВГУСТ", slots: ["", ""]},
  {key: "september", label: "СЕНТЯБРЬ", slots: ["", ""]},
  {key: "october", label: "ОКТЯБРЬ", slots: ["", ""]},
];

const getCommandThematicAccountMonths = (periodId) =>
  periodId === "period-1" ? firstCommandThematicAccountMonths : secondCommandThematicAccountMonths;

const buildCommandThematicAccountColumns = (months) => months.flatMap((month) =>
  month.slots.map((slot, index) => ({
    key: `${month.key}_${index + 1}`,
    label: slot,
    type: "textarea",
    rows: 2,
    width: 92,
  }))
);

const createCommandThematicAccountRow = (row) => ({
  number: row.number,
});

const commandThematicAccountSubjects = [
  createCommandThematicAccountRow({
    number: "1",
    topic: "Чек ара черүү тактикасы (ТТП)",
    hours: "4",
    june_1: "1/1/1",
    july_1: "2/1/1",
    august_1: "4/1/1",
  }),
  createCommandThematicAccountRow({
    number: "2",
    topic: "Тактикалык даярдык (ТП)",
    hours: "5",
    june_2: "1/1/1",
    july_2: "2/1/1",
    august_1: "6/1/1",
    september_2: "8/1/1",
  }),
  createCommandThematicAccountRow({
    number: "3",
    topic: "Коомдук-мамлекеттик даярдык",
    hours: "8",
    june_1: "2",
    july_1: "2",
    august_1: "2",
    september_1: "2",
  }),
  createCommandThematicAccountRow({
    number: "4",
    topic: "Ок атуу даярдыгы (ОТ)",
    hours: "8/4",
    june_1: "1/1/2\n1/1/1",
    july_1: "1/2/2\n1/2/1",
    september_1: "5/1/1",
  }),
  createCommandThematicAccountRow({
    number: "5",
    topic: "Техникалык даярдык (Тех.Г):\n- унаа чопкутанк даярдыгы (АБТГ)\n\n- ракета-артиллериялык даярдык",
    topicRows: 4,
    hours: "--/4\n\n4/4",
    hoursRows: 4,
    june_1: "-----\n1/1/1",
    june_2: "1/1/2\n1/1/2",
    july_1: "-----\n2/1/1",
    july_2: "2/1/2\n-----",
    august_1: "5/1/2",
    august_2: "6/1/1",
  }),
  createCommandThematicAccountRow({
    number: "6",
    topic: "Айдоочулук",
    hours: "--/3",
    july_2: "-----\n1/1/1",
    september_2: "-----\n6/1/1",
  }),
  createCommandThematicAccountRow({
    number: "7",
    topic: "Атайын даярдык (СП) *",
    hours: "--/8",
    july_2: "--/1",
    august_2: "2",
    september_2: "2",
  }),
  createCommandThematicAccountRow({
    number: "8",
    topic: "Радиациялык химиялык биологиялык\nкоргонуу (РХБЗ)",
    hours: "1",
    july_1: "1/1/1",
    september_1: "2/1/1",
  }),
  createCommandThematicAccountRow({
    number: "9",
    topic: "Инженердик даярдык (ИП)",
    hours: "3",
    june_2: "1/1/1",
    july_2: "4/1/2",
    august_2: "4/1/2",
    september_2: "5/1/1",
  }),
  createCommandThematicAccountRow({
    number: "10",
    topic: "Байланыш боюнча даярдык (ПиС)",
    hours: "2",
    july_2: "1/1/2",
    september_1: "2/2/1",
  }),
  createCommandThematicAccountRow({
    number: "11",
    topic: "КР КК Аскердик жалпы усулдар\n(ОВУ ВС КР)",
    hours: "13/4",
    june_1: "1/1/1\n1/1/1",
    july_1: "2/1/1\n2/1/1",
    july_2: "3/1/2\n3/1/2",
    august_1: "4/1/1\n-----",
    august_2: "5/1/1\n-----",
    september_1: "6/1/1\n-----",
  }),
  createCommandThematicAccountRow({
    number: "12",
    topic: "Саптык даярдык (СП)",
    hours: "7/5",
    june_2: "1/1/3\n1/1/3",
    august_1: "4/1/1",
    september_1: "6/1/1",
  }),
  createCommandThematicAccountRow({
    number: "13",
    topic: "Дене-тарбия даярдыгы (ФП)",
    hours: "4",
    june_1: "1/1/2",
    july_1: "1/2/1",
    september_2: "2/1/2",
  }),
  createCommandThematicAccountRow({
    number: "14",
    topic: "Аскердик жер-тартыма (ВТ)",
    hours: "1",
    june_2: "1/1/1",
    september_2: "5/1/2",
  }),
  createCommandThematicAccountRow({
    number: "15",
    topic: "Аскердик мыйзам чыгаруунун жана\nукуктун негиздери (ОВЗиП)",
    hours: "4",
    august_2: "4/1/2",
  }),
  createCommandThematicAccountRow({
    number: "16",
    topic: "Ыкмалык даярдык (МП) **",
    hours: "-",
    june_1: "-",
    june_2: "-",
    july_1: "-",
    july_2: "-",
    august_1: "-",
    august_2: "-",
    september_1: "-",
    september_2: "-",
  }),
  createCommandThematicAccountRow({
    number: "17",
    topic: "Жыйынтыгы",
    hours: "64",
    june_1: "16",
    july_1: "16",
    august_1: "16",
    september_1: "16",
    rowType: "total",
  }),
];

export const buildThematicAccountLikePhoto = (table, isCommand = false, periodId) => {
  if (!table) {
    return table;
  }

  const months = isCommand ? getCommandThematicAccountMonths(periodId) : thematicAccountMonths;
  const scheduleColumns = isCommand ? buildCommandThematicAccountColumns(months) : thematicAccountWeekColumns;
  const columns = [
    {key: "number", label: "№\nк/м", readOnly: true, width: 42},
    {
      key: "topic",
      label: "Сабактардын\nаталышы",
      type: "textarea",
      rows: isCommand ? 2 : 4,
      width: isCommand ? 420 : 220,
    },
    {
      key: "hours",
      label: "Канча\nсаат",
      type: isCommand ? "textarea" : "number",
      rows: 2,
      width: isCommand ? 76 : 54,
    },
    ...scheduleColumns,
  ];
  const headerRows = isCommand
    ? [
        [
          {key: "number", label: "№\nк/м"},
          {key: "topic", label: "Сабактардын\nаталышы"},
          {key: "hours", label: "Канча\nсаат"},
          ...months.map((month) => ({
            key: month.key,
            label: month.label,
            defaultValue: month.label,
            editableKey: `${month.key}_label`,
            colSpan: month.slots.length,
          })),
        ],
      ]
    : [
        [
          {key: "number", label: "№\nк/м", rowSpan: 2},
          {key: "topic", label: "Сабактардын\nаталышы", rowSpan: 2},
          {key: "hours", label: "Канча\nсаат", rowSpan: 2},
      ...months.map((month) => ({
        key: month.key,
        label: month.label,
        defaultValue: month.label,
        editableKey: `${month.key}_label`,
        colSpan: (month.slots || month.weeks).length,
      })),
        ],
        months.flatMap((month) =>
          month.weeks.map((week) => ({
            key: `${month.key}_${week}`,
            label: week,
          }))
        ),
      ];
  const weekDefaults = thematicAccountWeekColumns.reduce((values, column, index) => {
    values[column.key] = "";
    if (index < thematicAccountTotalHours.length) {
      values[`total_${column.key}`] = thematicAccountTotalHours[index];
    }
    return values;
  }, {});
  const rows = thematicAccountSubjects.map((subject) => {
    const scheduleValues = thematicAccountWeekColumns.reduce((values, column) => {
      values[column.key] = subject.rowType === "total" ? weekDefaults[`total_${column.key}`] || "" : "";
      return values;
    }, {});

    return {
      ...scheduleValues,
      ...subject,
      ...(subject.rowType !== "total" ? { topic: "", topicPlaceholder: subject.topic } : {}),
    };
  });
  const commandRows = commandThematicAccountSubjects.map((row) => ({...row}));
  const commandPeriodNumber = String(periodId || "").match(/^period-(\d+)$/)?.[1];

  return {
    ...table,
    columns,
    headerRows,
    rows: isCommand ? commandRows : rows,
    title: normalizeThematicAccountTitle(table.title, isCommand, commandPeriodNumber),
    variant: isCommand ? "command-thematic-account" : "thematic-account",
  };
};

export const buildLessonScheduleLikePhoto = (table) => {
  if (!table || table.variant !== "lesson-schedule") {
    return table;
  }

  const columns = [
    {key: "time_marker", label: "Убактысы\nбашталышы\nаякташы", type: "line-list", inputType: "time", lines: 2, width: 96},
    {key: "activity", label: "Аткаруу иш-чарасы", type: "textarea", rows: 4, width: 150},
    ...lessonScheduleDays.flatMap(([dayKey]) => [
      {key: `${dayKey}_activity`, label: "", type: "textarea", rows: 4, width: 190},
      {key: `${dayKey}_instructor`, label: "Ким өткөрөт", type: "textarea", rows: 3, width: 90},
      {key: `${dayKey}_place`, label: "Өткөрүү орду", type: "textarea", rows: 3, width: 90},
    ]),
  ];

  const headerRows = [
    [
      {key: "time_marker", label: "Убактысы\nбашталышы\nаякташы", rowSpan: 2},
      {key: "activity", label: "Аткаруу\nиш-чарасы", rowSpan: 2},
      ...lessonScheduleDays.flatMap(([dayKey, label]) => [
        {
          key: `${dayKey}_activity`,
          label: `${label}\n20__ж. «__»____`,
          defaultValue: `${label}\n20__ж. «__»____`,
          editableKey: `${dayKey}_date`,
          rowSpan: 2,
        },
        {key: `${dayKey}_instructor`, label: "Ким өткөрөт", rowSpan: 2},
        {key: `${dayKey}_place`, label: "Өткөрүү орду", rowSpan: 2},
      ]),
    ],
  ];

  const visibleRows = lessonScheduleRows.filter(
    (label, index) =>
      label !== "Техниканы куралды тейлөө" &&
      !(label === "3-саат" && index === lessonScheduleRows.length - 1)
  );

  const rows = visibleRows.map((label) => {
    if (label === "Түнкү сабактар") {
      return {activity: label, rowType: "section"};
    }

    return {
      time_marker: ["", ""],
      activity: label,
      ...lessonScheduleDays.reduce(
        (values, [dayKey]) => ({
          ...values,
          [`${dayKey}_activity`]: "",
          [`${dayKey}_instructor`]: "",
          [`${dayKey}_place`]: "",
        }),
        {}
      ),
    };
  });

  return {
    ...table,
    columns,
    headerFields: [
      {key: "schedule_from_year", defaultValue: "20___"},
      {key: "schedule_from_year_suffix", defaultValue: "-ж."},
      {key: "schedule_from_quote_open", defaultValue: "“"},
      {key: "schedule_from_day", defaultValue: "___"},
      {key: "schedule_from_quote_close", defaultValue: "”"},
      {key: "schedule_from_month", defaultValue: "_______"},
      {key: "schedule_start_label", defaultValue: "баштап"},
      {key: "schedule_to_year", defaultValue: "20____"},
      {key: "schedule_to_year_suffix", defaultValue: "-ж."},
      {key: "schedule_to_quote_open", defaultValue: "“"},
      {key: "schedule_to_day", defaultValue: "___"},
      {key: "schedule_to_quote_close", defaultValue: "”"},
      {key: "schedule_to_month", defaultValue: "________"},
      {key: "schedule_end_label", defaultValue: "чейин"},
      {key: "schedule_unit_name", defaultValue: "______________________________________________"},
      {key: "schedule_unit_caption", defaultValue: "(бөлүкчөнүн аталышы)"},
    ],
    headerRows,
    rows,
    title: "САБАКТАРДЫН ЖҮГҮРТМӨСҮ",
    scheduleTitle: "САБАКТАРДЫН            ЖҮГҮРТМѲСҮ",
    variant: "lesson-schedule",
  };
};

export default function Library(props) {
  const [year, setYear] = useState(reportingYear);
  useEffect(() => {
    const check = () => setYear(reportingYear());
    const timer = setInterval(check, 30000);
    window.addEventListener("focus", check);
    return () => { clearInterval(timer); window.removeEventListener("focus", check); };
  }, []);
  return <LibraryEditor key={year} {...props} reportingYear={year} />;
}

function LibraryEditor({ data, onBack, onRefresh, onSubmissionCreated, reportingYear: year }) {
 const {t:copyT}=useCopyLanguage();

  const currentUser = useSelector((state) => state.auth.user);
  const tableViewRef = useRef(null);
  const tableScrollRef = useRef(null);
  const topScrollRef = useRef(null);
  const isScrollSyncingRef = useRef(false);
  const migratedLessonPeriodsRef = useRef(new Set());
  const sections = useMemo(
    () =>
      (data?.sections || []).map((section) =>
        section.id === "typical-week"
          ? { ...section, title: "Типтүү жумасы" }
          : section
      ),
    [data?.sections]
  );
  const [selectedSectionId, setSelectedSectionId] = useHistoryState(moduleNavigationKey("Library", currentUser, data), null);
  const [selectedSubsectionId, setSelectedSubsectionId] = useState(null);
  const [selectedNestedSubsectionId, setSelectedNestedSubsectionId] = useState(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [selectedAdminUnitNumber, setSelectedAdminUnitNumber] = useState(null);
  const [selectedAdminOutpostName, setSelectedAdminOutpostName] = useState(null);
  const [customPeriods, setCustomPeriods] = useState([]);
  const [editableRows, setEditableRows] = useState([]);
  const [editableHeaderValues, setEditableHeaderValues] = useState({});
  const [editableTitle, setEditableTitle] = useState("");
  const [tableStatus, setTableStatus] = useState("editing");
  const [tableNotice, setTableNotice] = useState("");
  const [activeCellColor, setActiveCellColor] = useState("");
  const [cellColors, setCellColors] = useState({});
  const [tableScrollWidth, setTableScrollWidth] = useState(1200);
  const [lessonPeriodDraft, setLessonPeriodDraft] = useState(null);
  const [lessonPeriodMonth, setLessonPeriodMonth] = useState("");
  const [lessonPeriodWeek, setLessonPeriodWeek] = useState("");
  const [lessonPeriodError, setLessonPeriodError] = useState("");
  const [isCreatingLessonPeriod, setIsCreatingLessonPeriod] = useState(false);
  const [customTableDraft, setCustomTableDraft] = useState(null);
  const [customTableTitle, setCustomTableTitle] = useState("");
  const [customTableError, setCustomTableError] = useState("");
  const [thematicSubmissions, setThematicSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);
  const [submissionDocumentTitle, setSubmissionDocumentTitle] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [isSubmittingThematicAccount, setIsSubmittingThematicAccount] = useState(false);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState(null);
  const [forwardingSubmission, setForwardingSubmission] = useState(null);
  const [submissionListError, setSubmissionListError] = useState("");
  const [deletingLessonPeriodId, setDeletingLessonPeriodId] = useState(null);
  const [weeklyStatusNow, setWeeklyStatusNow] = useState(() => Date.now());
  const [hiddenThematicMonths, setHiddenThematicMonths] = useState(() =>
    getStoredHiddenThematicMonths(data?.scope, data?.id)
  );
  const [customThematicMonths, setCustomThematicMonths] = useState(() =>
    getStoredCustomThematicMonths(data?.scope, data?.id)
  );
  const [thematicMonthDialog, setThematicMonthDialog] = useState(null);
  const directTable = data?.table;
  const selectedSection = sections.find((section) => section.id === selectedSectionId);
  const selectedSubsections = getNestedSections(selectedSection);
  const selectedSubsection = selectedSubsections.find((section) => section.id === selectedSubsectionId);
  const selectedNestedSubsections = getNestedSections(selectedSubsection);
  const selectedNestedSubsection = selectedNestedSubsections.find(
    (section) => section.id === selectedNestedSubsectionId
  );
  const activePeriodContainer = selectedNestedSubsection || selectedSubsection || selectedSection;
  const activePeriodContainerId = activePeriodContainer?.id;
  const basePeriods = activePeriodContainer?.periods || EMPTY_ARRAY;
  const isThematicAccountTable = THEMATIC_ACCOUNT_SECTION_IDS.has(activePeriodContainerId);
  const isCommandThematicAccountTable = activePeriodContainerId === COMMAND_THEMATIC_ACCOUNT_SECTION_ID;
  const isLessonSchedulePeriodList = LESSON_SCHEDULE_SECTION_IDS.has(activePeriodContainerId);
  const visibleBasePeriods = useMemo(
    () => (isThematicAccountTable ? getVisibleThematicPeriods(basePeriods, activePeriodContainerId) : basePeriods),
    [activePeriodContainerId, basePeriods, isThematicAccountTable]
  );
  const visibleCustomPeriods = useMemo(
    () => {
      if (isLessonSchedulePeriodList) {
        return EMPTY_ARRAY;
      }

      return isThematicAccountTable
        ? getVisibleThematicPeriods(customPeriods, activePeriodContainerId)
        : customPeriods;
    },
    [activePeriodContainerId, customPeriods, isLessonSchedulePeriodList, isThematicAccountTable]
  );
  const customPeriodsStorageKey = annualKey(getCustomPeriodsStorageKey(
    data?.scope,
    selectedSection?.id,
    [selectedSubsection?.id, selectedNestedSubsection?.id].filter(Boolean).join(":")
  ), currentUser?.id, year, true);
  const selectedPeriods = useMemo(
    () => [...visibleBasePeriods, ...visibleCustomPeriods],
    [visibleBasePeriods, visibleCustomPeriods]
  );
  const isRegionalCommandIncomingLocation =
    currentUser?.role === "regional" &&
    selectedSection?.id === "command-training" &&
    selectedSubsection?.id === "command-training-subunits";
  const isRegionalCommandMilitaryUnitLocation =
    currentUser?.role === "regional" &&
    selectedSection?.id === "command-training" &&
    selectedSubsection?.id === "command-training-military-unit";
  const isRegionalTypicalWeekIncomingLocation =
    currentUser?.role === "regional" &&
    selectedSection?.id === "typical-week" &&
    selectedSubsection?.id === "typical-week-subunits";
  const isRegionalTypicalWeekMilitaryUnitLocation =
    currentUser?.role === "regional" &&
    selectedSection?.id === "typical-week" &&
    selectedSubsection?.id === "typical-week-military-unit";
  const isRegionalPersonnelOutpostLocation =
    currentUser?.role === "regional" &&
    selectedSection?.id === "personnel-training" &&
    ["thematic-account", "lesson-schedule"].includes(selectedSubsection?.id);
  const isRegionalCommandOutpostLocation =
    isRegionalCommandIncomingLocation &&
    ["command-thematic-account", "command-lesson-schedule"].includes(
      selectedNestedSubsection?.id
    );
  const isRegionalTypicalWeekOutpostLocation =
    isRegionalTypicalWeekIncomingLocation;
  const isRegionalOutpostBrowserLocation =
    isRegionalPersonnelOutpostLocation ||
    isRegionalCommandOutpostLocation ||
    isRegionalTypicalWeekOutpostLocation;
  const submissionSectionId = data?.submissionSectionId || (
    ["typical-week-subunits", "typical-week-military-unit"].includes(activePeriodContainerId)
      ? "typical-week"
      : activePeriodContainerId
  );
  const isWeeklyScheduleSection = WEEKLY_SCHEDULE_SECTION_IDS.has(submissionSectionId);
  const showsOutpostSubmissions =
    OUTPOST_SUBMISSION_SECTION_IDS.has(submissionSectionId) &&
    (
      currentUser?.role !== "regional" ||
      (
        COMMAND_SUBMISSION_SECTION_IDS.has(submissionSectionId)
          ? isRegionalCommandIncomingLocation
          : submissionSectionId === "typical-week"
            ? activePeriodContainerId === "typical-week" || isRegionalTypicalWeekIncomingLocation
            : true
      )
    );
  const isRegionalIncomingViewer =
    isRegionalCommandIncomingLocation || isRegionalTypicalWeekIncomingLocation;
  const displayedPeriods = isRegionalIncomingViewer ? EMPTY_ARRAY : selectedPeriods;
  const sectionSubmissions = thematicSubmissions.filter(
    (submission) => submission.sectionId === submissionSectionId
  );
  const hasPendingOwnEditRequest = thematicSubmissions.some(
    (submission) =>
      String(submission.senderId) === String(currentUser?.id) &&
      submission.editRequestStatus === "pending"
  );
  const regionalOutpostSubmissions = isRegionalOutpostBrowserLocation
    ? sectionSubmissions.filter((submission) => submission.senderRole === "outpost")
    : EMPTY_ARRAY;
  const regionalOutpostNames = useMemo(
    () => Array.from(new Set([
      ...(OUTPOSTS_BY_MILITARY_UNIT[currentUser?.region] || []).map(([, name]) =>
        formatOutpostName(name)
      ),
      ...regionalOutpostSubmissions.map((submission) =>
        formatOutpostName(submission.outpostName)
      ),
    ].filter(Boolean))),
    [currentUser?.region, regionalOutpostSubmissions]
  );
  const selectedRegionalOutpostSubmissions = selectedAdminOutpostName
    ? regionalOutpostSubmissions.filter(
        (submission) =>
          formatOutpostName(submission.outpostName) === selectedAdminOutpostName
      )
    : EMPTY_ARRAY;
  const getRegionalOutpostWeeklySubmission = (outpostName) =>
    getLatestSubmission(
      regionalOutpostSubmissions.filter(
        (submission) =>
          formatOutpostName(submission.outpostName) === outpostName
      )
    );
  const handleOpenRegionalOutpost = (outpostName) => {
    const unreadSubmissionIds = regionalOutpostSubmissions
      .filter(
        (submission) =>
          formatOutpostName(submission.outpostName) === outpostName &&
          !submission.isRead
      )
      .map((submission) => submission.id);

    setSelectedAdminOutpostName(outpostName);
    if (unreadSubmissionIds.length === 0) return;

    const unreadIdSet = new Set(unreadSubmissionIds);
    setThematicSubmissions((items) =>
      items.map((item) =>
        unreadIdSet.has(item.id) ? { ...item, isRead: true } : item
      )
    );
    Promise.all(
      unreadSubmissionIds.map((submissionId) =>
        markThematicAccountSubmissionRead(submissionId)
      )
    ).catch(() => {
      setSubmissionListError(
        "Документтерди окулду деп белгилөө мүмкүн болгон жок."
      );
    });
  };
  const isAdminGroupedSubmissionSection =
    currentUser?.role === "admin" &&
    ADMIN_GROUPED_SUBMISSION_SECTION_IDS.has(submissionSectionId);
  const adminUnitNumbers = useMemo(
    () => Array.from(new Set([
      ...(data?.unitNumbers || EMPTY_ARRAY),
      ...sectionSubmissions.map((submission) => submission.unitNumber),
    ].map((unitNumber) => String(unitNumber || "").trim()).filter(Boolean))),
    [data?.unitNumbers, sectionSubmissions]
  );
  const selectedAdminUnitSubmissions = isAdminGroupedSubmissionSection
    ? sectionSubmissions.filter(
        (submission) => String(submission.unitNumber) === String(selectedAdminUnitNumber)
      )
    : EMPTY_ARRAY;
  const adminMilitaryUnitSubmissions = selectedAdminUnitSubmissions.filter(
    (submission) => submission.senderRole === "regional"
  );
  const adminOutpostSubmissions = selectedAdminUnitSubmissions.filter(
    (submission) => submission.senderRole === "outpost"
  );
  const adminOutpostNames = useMemo(
    () => Array.from(new Set([
      ...(OUTPOSTS_BY_MILITARY_UNIT[selectedAdminUnitNumber] || []).map(([, name]) =>
        formatOutpostName(name)
      ),
      ...adminOutpostSubmissions.map((submission) => formatOutpostName(submission.outpostName)),
    ].filter(Boolean))),
    [adminOutpostSubmissions, selectedAdminUnitNumber]
  );
  const selectedAdminOutpostSubmissions = selectedAdminOutpostName
    ? adminOutpostSubmissions.filter(
        (submission) => formatOutpostName(submission.outpostName) === selectedAdminOutpostName
      )
    : EMPTY_ARRAY;
  const getAdminOutpostWeeklySubmission = (outpostName) =>
    getLatestSubmission(
      adminOutpostSubmissions.filter(
        (submission) =>
          formatOutpostName(submission.outpostName) === outpostName
      )
    );
  const visibleSubmissions = currentUser?.role === "regional"
    ? sectionSubmissions.filter((submission) => submission.senderRole === "outpost")
    : currentUser?.role === "admin"
      ? ADMIN_GROUPED_SUBMISSION_SECTION_IDS.has(submissionSectionId)
        ? sectionSubmissions
        : sectionSubmissions.filter((submission) => submission.senderRole === "regional")
      : sectionSubmissions;
  const outgoingRegionalSubmissions = currentUser?.role === "regional"
    ? sectionSubmissions.filter((submission) => submission.senderRole === "regional")
    : EMPTY_ARRAY;
  const latestOwnWeeklySubmission = getLatestSubmission(
    sectionSubmissions.filter(
      (submission) => String(submission.senderId) === String(currentUser?.id)
    )
  );
  const latestRegionalWeeklySubmission = getLatestSubmission(
    outgoingRegionalSubmissions
  );
  const showsRegionalOutgoingSubmissions =
    currentUser?.role === "regional" &&
    OUTPOST_SUBMISSION_SECTION_IDS.has(submissionSectionId) &&
    !isRegionalTypicalWeekIncomingLocation &&
    (
      showsOutpostSubmissions ||
      isRegionalCommandMilitaryUnitLocation ||
      isRegionalTypicalWeekMilitaryUnitLocation
    );
  const selectedPeriod = selectedPeriods.find((period) => period.id === selectedPeriodId);
  const selectedPeriodNumber = getPeriodNumber(selectedPeriod);
  const documentRegistrationNumber = selectedSubmission
    ? getDocumentRegistrationCode(selectedSubmission)
    : data?.registrationCode || data?.registrationNumber || null;
  const sourceSelectedTable =
    selectedSubmission?.table ||
    directTable ||
    selectedPeriod?.table ||
    selectedNestedSubsection?.table ||
    selectedSubsection?.table ||
    selectedSection?.table;
  const shouldUseLessonSchedulePhotoLayout =
    activePeriodContainerId === "lesson-schedule" ||
    activePeriodContainerId === "command-lesson-schedule";
  const selectedTable = useMemo(
    () => {
      let nextTable;
      if (selectedSubmission) {
        nextTable = sourceSelectedTable;
      } else if (isThematicAccountTable) {
        nextTable = buildThematicAccountLikePhoto(
          sourceSelectedTable,
          isCommandThematicAccountTable,
          selectedPeriod?.id,
        );
      } else {
        nextTable = shouldUseLessonSchedulePhotoLayout
          ? buildLessonScheduleLikePhoto(sourceSelectedTable)
          : sourceSelectedTable;
      }
      nextTable = ensureCombatHoursDateColumn(nextTable);
      if (!data?.allowThematicMonthDeletion) return nextTable;
      return hideThematicMonthColumns(
        appendCustomThematicMonths(nextTable, customThematicMonths),
        hiddenThematicMonths
      );
    },
    [
      data?.allowThematicMonthDeletion,
      customThematicMonths,
      hiddenThematicMonths,
      isCommandThematicAccountTable,
      isThematicAccountTable,
      selectedSubmission,
      selectedPeriod?.id,
      activePeriodContainerId,
      shouldUseLessonSchedulePhotoLayout,
      sourceSelectedTable,
    ]
  );
  const expandedTable = useMemo(
    () => expandJournalColumns(selectedTable, editableHeaderValues.__journalAttendanceCount),
    [selectedTable, editableHeaderValues.__journalAttendanceCount]
  );
  const tableColumns = expandedTable?.columns || EMPTY_ARRAY;
  const tableHeaderFields = selectedTable?.headerFields || EMPTY_ARRAY;
  const thematicMonthOptions =
    data?.allowThematicMonthDeletion &&
    selectedTable?.variant === "thematic-account"
      ? (selectedTable.headerRows?.[0] || []).filter(
          (cell) =>
            Number(cell.colSpan) > 1 &&
            !["number", "topic", "hours"].includes(cell.key)
        )
      : EMPTY_ARRAY;
  const tableOwnerId = [
    selectedSection?.id,
    selectedSubsection?.id,
    selectedNestedSubsection?.id,
  ].filter(Boolean).join(":");
  const baseTableStorageKey = selectedTable
    ? data?.tableStorageKey ||
      getTableStorageKey(
        data?.scope,
        directTable ? data?.id || selectedTable?.id : tableOwnerId,
        selectedSubmission ? `submission-${selectedSubmission.id}` : selectedPeriod?.id
      )
    : null;
  const isThematicAccountPhotoTable =
    selectedTable?.variant === "thematic-account" ||
    selectedTable?.variant === "command-thematic-account";
  const isCommandThematicAccountPhotoTable = selectedTable?.variant === "command-thematic-account";
  const legacyTableStorageKey =
    baseTableStorageKey && selectedTable?.variant === "lesson-schedule"
      ? `${baseTableStorageKey}:photo-layout-v10`
      : baseTableStorageKey && selectedTable?.variant === "command-thematic-account"
        ? `${baseTableStorageKey}:command-thematic-photo-v3`
      : baseTableStorageKey && isThematicAccountPhotoTable
        ? `${baseTableStorageKey}:thematic-photo-v1`
      : baseTableStorageKey;
  const tableStorageKey = data?.readOnly || selectedSubmission || data?.tableStorageKey
    ? legacyTableStorageKey : annualKey(legacyTableStorageKey, currentUser?.id, year);
  const headerStorageKey = data?.headerStorageKey || getHeaderStorageKey(tableStorageKey);
  const titleStorageKey = getTitleStorageKey(tableStorageKey);
  const tableActionStorageKey = data?.tableActionStorageKey || getActionStorageKey(tableStorageKey);
  const cellColorStorageKey = tableStorageKey ? `${tableStorageKey}:cell-colors` : null;
  const canEditSelectedSubmission = Boolean(
    selectedSubmission?.canEdit &&
    ["outpost", "regional"].includes(currentUser?.role) &&
    String(selectedSubmission.senderId) === String(currentUser?.id) &&
    !data?.readOnly
  );
  const isViewingSubmission = Boolean(
    data?.readOnly || (selectedSubmission && !canEditSelectedSubmission)
  );
  const isDirectSubmissionUpdate = Boolean(data?.directSubmissionUpdate);
  const isTableEditing = (
    canEditSelectedSubmission ||
    tableStatus === "editing" ||
    (isDirectSubmissionUpdate && tableStatus !== "submitted")
  ) && !isViewingSubmission;
  const isSubmitDisabled =
    data?.disableSubmit ||
    (!isDirectSubmissionUpdate && !canEditSelectedSubmission && tableStatus === "submitted") ||
    isViewingSubmission ||
    isSubmittingThematicAccount;
  const tableHistory = useDocumentHistory({
    resetKey: tableStorageKey || "library-no-table",
    value: {
      rows: editableRows,
      headerValues: editableHeaderValues,
      title: editableTitle,
      cellColors,
    },
    onChange: (snapshot) => {
      setEditableRows(snapshot.rows || []);
      setEditableHeaderValues(snapshot.headerValues || {});
      setEditableTitle(snapshot.title || "");
      setCellColors(snapshot.cellColors || {});
      setTableStatus("editing");
      setTableNotice("");
    },
  });
  const customPeriodConfig = customPeriodConfigs[activePeriodContainerId];
  const isAdmin = currentUser?.role === "admin";
  const canAddCustomPeriod = Boolean(
    customPeriodConfig &&
      (!customPeriodConfig.adminOnly || isAdmin) &&
      (isAdmin ||
        customPeriodConfig.usesServerCreate ||
        customPeriodConfig.createTable ||
        selectedPeriods.some((period) => period.table)) &&
      (!customPeriodConfig.maxPeriods || selectedPeriods.length < customPeriodConfig.maxPeriods)
  );
  const canManageCustomPeriods = Boolean(
    customPeriodConfig &&
    (
      isAdmin ||
      (
        customPeriodConfig.userManaged &&
        ["outpost", "regional"].includes(currentUser?.role)
      )
    )
  );

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setWeeklyStatusNow(Date.now()),
      1000
    );
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setSelectedSectionId(null);
    setSelectedSubsectionId(null);
    setSelectedNestedSubsectionId(null);
    setSelectedPeriodId(null);
    setSelectedSubmission(null);
    setSelectedAdminUnitNumber(null);
    setSelectedAdminOutpostName(null);
  }, [data?.title, data?.scope]);

  useEffect(() => {
    if (
      !["outpost", "regional", "admin"].includes(currentUser?.role) ||
      !OUTPOST_SUBMISSION_SECTION_IDS.has(submissionSectionId)
    ) {
      setThematicSubmissions([]);
      return undefined;
    }

    let isActive = true;
    const refreshSubmissions = async () => {
      try {
        const items = await getThematicAccountSubmissions(undefined, [submissionSectionId]);
        if (isActive) setThematicSubmissions(Array.isArray(items) ? items : []);
      } catch {
        // Keep the last successfully loaded list and retry automatically.
      }
    };
    refreshSubmissions();
    const intervalId = window.setInterval(refreshSubmissions, 15000);
    window.addEventListener("focus", refreshSubmissions);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshSubmissions);
    };
  }, [currentUser?.id, currentUser?.role, submissionSectionId]);

  useEffect(() => {
    if (!hasPendingOwnEditRequest) {
      return undefined;
    }

    let isActive = true;
    const refreshEditRequestStatus = async () => {
      try {
        const items = await getThematicAccountSubmissions(undefined, [submissionSectionId]);
        if (isActive) {
          setThematicSubmissions(Array.isArray(items) ? items : []);
        }
      } catch {
        // The next polling cycle will retry without interrupting the user.
      }
    };
    const intervalId = window.setInterval(refreshEditRequestStatus, 5000);
    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [currentUser?.id, hasPendingOwnEditRequest]);

  useEffect(() => {
    if (currentUser?.role !== "admin") return;
    setSelectedSubmission((current) => {
      if (!current) return current;
      return thematicSubmissions.find((item) => item.id === current.id) || current;
    });
  }, [currentUser?.role, thematicSubmissions]);

  useEffect(() => {
    setSelectedSubsectionId(null);
    setSelectedNestedSubsectionId(null);
    setSelectedPeriodId(null);
    setSelectedSubmission(null);
    setSelectedAdminUnitNumber(null);
    setSelectedAdminOutpostName(null);
  }, [selectedSectionId]);

  useEffect(() => {
    setSelectedNestedSubsectionId(null);
    setSelectedPeriodId(null);
    setSelectedSubmission(null);
    setSelectedAdminUnitNumber(null);
    setSelectedAdminOutpostName(null);
  }, [selectedSubsectionId]);

  useEffect(() => {
    setSelectedPeriodId(null);
    setSelectedSubmission(null);
    setSelectedAdminUnitNumber(null);
    setSelectedAdminOutpostName(null);
  }, [selectedNestedSubsectionId]);

  useEffect(() => {
    setLessonPeriodDraft(null);
    setLessonPeriodMonth("");
    setLessonPeriodWeek("");
    setLessonPeriodError("");
    setIsCreatingLessonPeriod(false);
    setCustomTableDraft(null);
    setCustomTableTitle("");
    setCustomTableError("");
  }, [
    data?.scope,
    data?.title,
    selectedSectionId,
    selectedSubsectionId,
    selectedNestedSubsectionId,
  ]);

  useEffect(() => {
    if (isLessonSchedulePeriodList) {
      const storedPeriods = getStoredCustomPeriods(customPeriodsStorageKey);
      setCustomPeriods([]);

      if (
        storedPeriods.length > 0 &&
        activePeriodContainerId &&
        !migratedLessonPeriodsRef.current.has(customPeriodsStorageKey)
      ) {
        migratedLessonPeriodsRef.current.add(customPeriodsStorageKey);

        const existingTitles = new Set(basePeriods.map((period) => period.title));
        const periodsToMigrate = storedPeriods.filter(
          (period) => period?.title && !existingTitles.has(period.title)
        );

        if (periodsToMigrate.length === 0) {
          saveCustomPeriods(customPeriodsStorageKey, []);
          return;
        }

        const migrateLessonPeriods = async () => {
          try {
            for (const period of periodsToMigrate) {
              const weekMatch = String(period.title || "").match(/(\d+)\s*жумасы/);
              await createLessonSchedulePeriod({
                section: activePeriodContainerId,
                title: period.title,
                weekNumber: weekMatch?.[1] || "",
              });
            }

            saveCustomPeriods(customPeriodsStorageKey, []);

            if (onRefresh) {
              await onRefresh();
            }
          } catch {
            migratedLessonPeriodsRef.current.delete(customPeriodsStorageKey);
          }
        };

        migrateLessonPeriods();
      }

      return;
    }

    const storedPeriods = getStoredCustomPeriods(customPeriodsStorageKey);
    const nextPeriods = isThematicAccountTable
      ? getVisibleThematicPeriods(storedPeriods, activePeriodContainerId)
      : storedPeriods;

    setCustomPeriods(nextPeriods);

    if (
      isThematicAccountTable &&
      JSON.stringify(nextPeriods) !== JSON.stringify(storedPeriods)
    ) {
      saveCustomPeriods(customPeriodsStorageKey, nextPeriods);
    }
  }, [
    basePeriods,
    customPeriodsStorageKey,
    activePeriodContainerId,
    isLessonSchedulePeriodList,
    isThematicAccountTable,
    onRefresh,
    activePeriodContainerId,
  ]);

  useEffect(() => {
    setEditableRows(selectedTable ? getStoredRows(selectedTable.rows || [], tableStorageKey) : []);
  }, [selectedTable, tableStorageKey]);

  useEffect(() => {
    setEditableHeaderValues(
      selectedTable ? getStoredHeaderValues(getEditableHeaderFields(selectedTable), headerStorageKey) : {}
    );
  }, [selectedTable, headerStorageKey]);

  useEffect(() => {
    const storedTitle = selectedTable
      ? getStoredTitle(selectedTable.scheduleTitle || selectedTable.title, titleStorageKey)
      : "";

    const resolvedTitle = (
      isThematicAccountTable
        ? normalizeThematicAccountTitle(storedTitle, isCommandThematicAccountTable, selectedPeriodNumber)
        : storedTitle
    );
    setEditableTitle(data?.readOnly || selectedSubmission ? resolvedTitle : resolvedTitle.replace(/20__/g, String(year)));
  }, [
    isCommandThematicAccountTable,
    isThematicAccountTable,
    selectedPeriodNumber,
    selectedTable,
    titleStorageKey,
  ]);

  useEffect(() => {
    setTableStatus(
      selectedTable && !isDirectSubmissionUpdate
        ? getStoredTableStatus(tableActionStorageKey)
        : "editing"
    );
    setTableNotice("");
  }, [isDirectSubmissionUpdate, selectedTable, tableActionStorageKey]);

  useEffect(() => {
    setActiveCellColor("");
    if (!selectedTable?.enableCellColoring || !cellColorStorageKey || typeof window === "undefined") {
      setCellColors({});
      return;
    }

    if (selectedTable.cellColors && typeof selectedTable.cellColors === "object") {
      setCellColors(selectedTable.cellColors);
      return;
    }

    try {
      const storedColors = JSON.parse(window.localStorage.getItem(cellColorStorageKey) || "{}");
      setCellColors(storedColors && typeof storedColors === "object" ? storedColors : {});
    } catch {
      setCellColors({});
    }
  }, [cellColorStorageKey, selectedTable?.cellColors, selectedTable?.enableCellColoring]);

  useEffect(() => {
    const updateScrollWidth = () => {
      const table = tableScrollRef.current?.querySelector("table");
      const measuredWidth = table?.scrollWidth || tableScrollRef.current?.scrollWidth || 0;
      const fallbackWidth = Math.max(
        tableColumns.reduce((total, column) => total + (column.width || 120), 0),
        selectedTable?.variant === "combat-subject-journal" ? 2738 : 0,
        selectedTable?.variant === "command-thematic-account" ? 1500 : 0,
        selectedTable?.variant === "thematic-account" ? 1810 : 0,
        selectedTable?.variant === "lesson-schedule" ? 3206 : 1200
      );

      setTableScrollWidth(Math.max(measuredWidth, fallbackWidth));
    };

    updateScrollWidth();
    window.requestAnimationFrame(updateScrollWidth);
    window.addEventListener("resize", updateScrollWidth);

    return () => window.removeEventListener("resize", updateScrollWidth);
  }, [editableRows.length, selectedTable, tableColumns]);

  useEffect(() => {
    if (!tableStorageKey || editableRows.length === 0 || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(tableStorageKey, JSON.stringify(editableRows));
    } catch {
      // Editing should keep working even if browser storage is unavailable.
    }
  }, [editableRows, tableStorageKey]);

  useEffect(() => {
    if (
      !headerStorageKey ||
      getEditableHeaderFields(selectedTable).length === 0 ||
      typeof window === "undefined"
    ) {
      return;
    }

    try {
      window.localStorage.setItem(headerStorageKey, JSON.stringify(editableHeaderValues));
    } catch {
      // Editing should keep working even if browser storage is unavailable.
    }
  }, [editableHeaderValues, headerStorageKey, selectedTable]);

  useEffect(() => {
    if (!titleStorageKey || !selectedTable || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(titleStorageKey, editableTitle);
    } catch {
      // Editing should keep working even if browser storage is unavailable.
    }
  }, [editableTitle, selectedTable, titleStorageKey]);

  const handleCellChange = (rowIndex, columnKey, value) => {
    setEditableRows((currentRows) =>
      currentRows.map((row, index) => (index === rowIndex ? { ...row, [columnKey]: value } : row))
    );
  };

  const handlePaintJournalCell = (rowIndex, columnKey) => {
    if (
      !activeCellColor ||
      !selectedTable?.enableCellColoring ||
      !/^attendance_\d+$/.test(columnKey)
    ) {
      return;
    }

    const cellKey = `${rowIndex}:${columnKey}`;
    setCellColors((currentColors) => {
      const nextColors = { ...currentColors };
      if (nextColors[cellKey] === activeCellColor) {
        delete nextColors[cellKey];
      } else {
        nextColors[cellKey] = activeCellColor;
      }

      if (cellColorStorageKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(cellColorStorageKey, JSON.stringify(nextColors));
        } catch {
          // Coloring should continue to work if browser storage is unavailable.
        }
      }
      return nextColors;
    });
  };

  const handleCellLineChange = (rowIndex, column, lineIndex, value) => {
    setEditableRows((currentRows) =>
      currentRows.map((row, index) => {
        if (index !== rowIndex) {
          return row;
        }

        const currentValue = Array.isArray(row[column.key])
          ? row[column.key]
          : String(row[column.key] || "").split("\n");
        const minLines = column.lines || 1;
        const nextValue = Array.from(
          {length: Math.max(minLines, currentValue.length, lineIndex + 1)},
          (_, itemIndex) => currentValue[itemIndex] || ""
        );
        nextValue[lineIndex] = value;

        return {...row, [column.key]: nextValue};
      })
    );
  };

  const handleAddCellLine = (rowIndex, column) => {
    setEditableRows((currentRows) =>
      currentRows.map((row, index) => {
        if (index !== rowIndex) {
          return row;
        }

        const currentValue = Array.isArray(row[column.key])
          ? row[column.key]
          : String(row[column.key] || "").split("\n");
        const maxLines = column.maxLines || 20;

        if (currentValue.length >= maxLines) {
          return row;
        }

        return {...row, [column.key]: [...currentValue, ""]};
      })
    );
  };

  const handleRemoveCellLine = (rowIndex, column, lineIndex) => {
    setEditableRows((currentRows) =>
      currentRows.map((row, index) => {
        if (index !== rowIndex) {
          return row;
        }

        const currentValue = Array.isArray(row[column.key])
          ? row[column.key]
          : String(row[column.key] || "").split("\n");
        const minLines = column.lines || 1;

        if (currentValue.length <= minLines) {
          return row;
        }

        return {
          ...row,
          [column.key]: currentValue.filter((_, itemIndex) => itemIndex !== lineIndex),
        };
      })
    );
  };

  const handleHeaderFieldChange = (fieldKey, value) => {
    setEditableHeaderValues((currentValues) => ({
      ...currentValues,
      [fieldKey]: value,
    }));
  };

  const handleTitleChange = (event) => {
    setEditableTitle(event.target.value);
  };

  const handleEditableCellKeyDown = (event) => {
    if (event.key !== "Tab") {
      return;
    }

    const tableView = event.currentTarget.closest(".module-table-view");
    const editableCells = Array.from(
      tableView?.querySelectorAll('[data-table-cell="true"]') || []
    );
    const currentIndex = editableCells.indexOf(event.currentTarget);

    if (currentIndex === -1) {
      return;
    }

    event.preventDefault();
    const direction = event.shiftKey ? -1 : 1;
    const nextIndex =
      (currentIndex + direction + editableCells.length) % editableCells.length;
    editableCells[nextIndex]?.focus();
  };

  const syncHorizontalScroll = (source, targetRef) => {
    const target = targetRef.current;

    if (!target || isScrollSyncingRef.current) {
      return;
    }

    isScrollSyncingRef.current = true;
    target.scrollLeft = source.scrollLeft;
    window.requestAnimationFrame(() => {
      isScrollSyncingRef.current = false;
    });
  };

  const handleAddJournalColumn = () => {
    const count = tableColumns.filter((column) => /^attendance_\d+$/.test(column.key)).length;
    setEditableHeaderValues((current) => ({ ...current, __journalAttendanceCount: count + 1 }));
  };

  const handleAddTableRow = () => {
    if (!selectedTable) {
      return;
    }

    setEditableRows((currentRows) => [
      ...currentRows,
      createEmptyTableRow(
        selectedTable,
        currentRows.filter((row) => row.rowType !== "section").length + 1
      ),
    ]);
  };

  const handleAddTableSection = () => {
    setEditableRows((currentRows) => [
      ...currentRows,
      {rowType: "section", activity: "Секция"},
    ]);
  };

  const handleDeleteTableSection = () => {
    setEditableRows((currentRows) => {
      const lastSectionIndex = currentRows.reduce(
        (foundIndex, row, index) => (row.rowType === "section" ? index : foundIndex),
        -1
      );

      return lastSectionIndex === -1
        ? currentRows
        : currentRows.filter((_, index) => index !== lastSectionIndex);
    });
  };

  const handleDeleteTableRow = () => {
    setEditableRows((currentRows) => currentRows.slice(0, -1));
  };

  const handleDeleteThematicMonth = () => {
    if (thematicMonthOptions.length === 0) return;
    setThematicMonthDialog({
      mode: "delete",
      count: "1",
      error: "",
    });
  };

  const handleAddThematicMonths = () => {
    setThematicMonthDialog({
      mode: "add",
      count: "1",
      error: "",
    });
  };

  const handleConfirmThematicMonthDialog = (event) => {
    event.preventDefault();
    if (!thematicMonthDialog) return;

    const count = Number(thematicMonthDialog.count);
    const maximum =
      thematicMonthDialog.mode === "delete"
        ? thematicMonthOptions.length
        : 12;

    if (!Number.isInteger(count) || count < 1 || count > maximum) {
      setThematicMonthDialog((currentDialog) => ({
        ...currentDialog,
        error: `1ден ${maximum}гө чейинки бүтүн санды көрсөтүңүз.`,
      }));
      return;
    }

    if (thematicMonthDialog.mode === "delete") {
      const monthKeysToHide = thematicMonthOptions
        .slice(-count)
        .map((month) => month.key);
      const nextHiddenMonths = [
        ...new Set([...hiddenThematicMonths, ...monthKeysToHide]),
      ];
      setHiddenThematicMonths(nextHiddenMonths);
      try {
        window.localStorage.setItem(
          getHiddenThematicMonthsStorageKey(data?.scope, data?.id),
          JSON.stringify(nextHiddenMonths)
        );
      } catch {
        // The month remains hidden for the current session.
      }
      setTableNotice(`Ай мамычалары өчүрүлдү: ${count}.`);
    } else {
      const createdAt = Date.now();
      const nextMonths = Array.from({ length: count }, (_, index) => ({
        key: `custom_month_${createdAt}_${index + 1}`,
        label: `ЖАҢЫ АЙ ${customThematicMonths.length + index + 1}`,
      }));
      const nextCustomMonths = [...customThematicMonths, ...nextMonths];
      setCustomThematicMonths(nextCustomMonths);
      try {
        window.localStorage.setItem(
          getCustomThematicMonthsStorageKey(data?.scope, data?.id),
          JSON.stringify(nextCustomMonths)
        );
      } catch {
        // The new month columns remain available for the current session.
      }
      setTableNotice(`Ай мамычалары кошулду: ${count}.`);
    }

    setTableStatus("editing");
    setThematicMonthDialog(null);
  };

  const addCustomPeriodFromTemplate = (title, templatePeriod) => {
    const periodId = `custom-${Date.now()}`;
    const table = customPeriodConfig.createTable
      ? customPeriodConfig.createTable(title)
      : JSON.parse(JSON.stringify(templatePeriod.table));
    table.title = title;

    const nextCustomPeriod = {
      id: periodId,
      title,
      table,
    };
    const nextCustomPeriods = [...customPeriods, nextCustomPeriod];

    setCustomPeriods(nextCustomPeriods);
    saveCustomPeriods(customPeriodsStorageKey, nextCustomPeriods);
    setSelectedPeriodId(periodId);
  };

  const handleAddCustomPeriod = async () => {
    if (typeof window === "undefined") {
      return;
    }

    const templatePeriod = basePeriods.find((period) => period.table);

    if (
      !templatePeriod &&
      !isAdmin &&
      !customPeriodConfig.usesServerCreate &&
      !customPeriodConfig.createTable
    ) {
      return;
    }

    const nextPeriodNumber = selectedPeriods.length + 1;

    if (customPeriodConfig.usesMonthDialog) {
      setLessonPeriodDraft({
        templatePeriod,
        weekNumber: nextPeriodNumber,
      });
      setLessonPeriodMonth(LESSON_SCHEDULE_MONTH_PLACEHOLDER);
      setLessonPeriodWeek(String(nextPeriodNumber));
      setLessonPeriodError("");
      return;
    }

    if (customPeriodConfig.usesTextDialog) {
      setCustomTableDraft({templatePeriod});
      setCustomTableTitle(customPeriodConfig.getDefaultTitle(nextPeriodNumber));
      setCustomTableError("");
      return;
    }

    const defaultTitle = customPeriodConfig.getDefaultTitle(nextPeriodNumber);
    const title = window.prompt(customPeriodConfig.promptLabel, defaultTitle)?.trim();

    if (!title) {
      return;
    }

    if (isAdmin || customPeriodConfig.usesServerCreate) {
      try {
        await createLibraryPeriod({section: activePeriodContainerId, title});
        if (onRefresh) await onRefresh();
      } catch (error) {
        setTableNotice(getApiErrorMessage(error, "Документти кошуу мүмкүн болгон жок."));
      }
      return;
    }

    addCustomPeriodFromTemplate(title, templatePeriod);
  };

  const closeCustomTableDialog = () => {
    setCustomTableDraft(null);
    setCustomTableTitle("");
    setCustomTableError("");
  };

  const handleCreateCustomTable = async () => {
    const title = customTableTitle.trim();

    if (!title) {
      setCustomTableError("Аталышын жазыңыз.");
      return;
    }

    if (isAdmin || customPeriodConfig.usesServerCreate) {
      try {
        await createLibraryPeriod({
          section: activePeriodContainerId,
          title,
          table: customPeriodConfig.createTable?.(title),
        });
        if (onRefresh) await onRefresh();
        closeCustomTableDialog();
      } catch (error) {
        setCustomTableError(getApiErrorMessage(error, "Документти түзүү мүмкүн болгон жок."));
      }
      return;
    }

    addCustomPeriodFromTemplate(title, customTableDraft?.templatePeriod);
    closeCustomTableDialog();
  };

  const closeLessonPeriodDialog = () => {
    setLessonPeriodDraft(null);
    setLessonPeriodMonth("");
    setLessonPeriodWeek("");
    setLessonPeriodError("");
    setIsCreatingLessonPeriod(false);
  };

  const handleCreateLessonPeriod = async () => {
    if (!lessonPeriodDraft) {
      return;
    }

    const weekNumber = lessonPeriodWeek.trim() || LESSON_SCHEDULE_WEEK_PLACEHOLDER;
    const title = buildLessonSchedulePeriodTitle(
      weekNumber,
      lessonPeriodMonth.trim()
    );

    setIsCreatingLessonPeriod(true);
    setLessonPeriodError("");

    try {
      if (isAdmin) {
        await createLibraryPeriod({section: activePeriodContainerId, title});
      } else {
        await createLessonSchedulePeriod({
          section: activePeriodContainerId,
          title,
          weekNumber,
        });
      }

      if (onRefresh) {
        await onRefresh();
      }

      closeLessonPeriodDialog();
    } catch (error) {
      setLessonPeriodError(
        getApiErrorMessage(error, "Жуманы кошуу мүмкүн болгон жок.")
      );
    } finally {
      setIsCreatingLessonPeriod(false);
    }
  };

  const handleRenameCustomPeriod = async (period) => {
    if (typeof window === "undefined" || !canManageCustomPeriods) {
      return;
    }

    const title = window.prompt("Таблицанын аталышы", period.title)?.trim();

    if (!title) {
      return;
    }

    if (period.canEdit) {
      try {
        await updateLibraryPeriod(activePeriodContainerId, period.id, {title});
        if (onRefresh) await onRefresh();
      } catch (error) {
        setTableNotice(getApiErrorMessage(error, "Аталышын өзгөртүү мүмкүн болгон жок."));
      }
      return;
    }

    const nextCustomPeriods = customPeriods.map((customPeriod) =>
      customPeriod.id === period.id
        ? {
            ...customPeriod,
            title,
            table: {
              ...customPeriod.table,
              title,
            },
          }
        : customPeriod
    );

    setCustomPeriods(nextCustomPeriods);
    saveCustomPeriods(customPeriodsStorageKey, nextCustomPeriods);
  };

  const handleDeleteCustomPeriod = async (period) => {
    if (typeof window === "undefined" || !canManageCustomPeriods) {
      return;
    }

    const shouldDelete = window.confirm(`"${period.title}" өчүрүлсүнбү?`);

    if (!shouldDelete) {
      return;
    }

    if (period.canDelete) {
      setDeletingLessonPeriodId(period.id);
      try {
        await deleteLibraryPeriod(activePeriodContainerId, period.id);
        if (selectedPeriodId === period.id) setSelectedPeriodId(null);
        if (onRefresh) await onRefresh();
      } catch (error) {
        setTableNotice(getApiErrorMessage(error, "Документти өчүрүү мүмкүн болгон жок."));
      } finally {
        setDeletingLessonPeriodId(null);
      }
      return;
    }

    const nextCustomPeriods = customPeriods.filter((customPeriod) => customPeriod.id !== period.id);

    setCustomPeriods(nextCustomPeriods);
    saveCustomPeriods(customPeriodsStorageKey, nextCustomPeriods);
    removeTableStorage(data?.scope, selectedSection?.id, period.id);

    if (selectedPeriodId === period.id) {
      setSelectedPeriodId(null);
    }
  };

  const persistCurrentTable = (nextStatus) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (tableStorageKey) {
        window.localStorage.setItem(tableStorageKey, JSON.stringify(editableRows));
      }

      if (headerStorageKey) {
        window.localStorage.setItem(headerStorageKey, JSON.stringify(editableHeaderValues));
      }

      if (titleStorageKey) {
        window.localStorage.setItem(titleStorageKey, editableTitle);
      }

      if (tableActionStorageKey) {
        window.localStorage.setItem(tableActionStorageKey, nextStatus);
      }
    } catch {
      // Buttons should not break editing if browser storage is unavailable.
    }
  };

  const buildCurrentSubmissionTable = () => {
    const submittedHeaderFields = (selectedTable?.headerFields || []).map((field) => ({
      ...field,
      defaultValue: field.key
        ? editableHeaderValues[field.key] ?? field.defaultValue ?? ""
        : field.defaultValue,
    }));
    const submittedHeaderRows = (expandedTable?.headerRows || []).map((row) =>
      row.map((cell) => ({
        ...cell,
        defaultValue: cell.editableKey
          ? editableHeaderValues[cell.editableKey] ?? cell.defaultValue ?? cell.label ?? ""
          : cell.defaultValue,
      }))
    );

    return {
      ...expandedTable,
      title: editableTitle || selectedTable?.title || "",
      rows: editableRows,
      cellColors,
      headerFields: submittedHeaderFields,
      headerRows: submittedHeaderRows,
    };
  };

  const annualSnapshotKey = useRef(null);
  useEffect(() => {
    if (annualSnapshotKey.current !== tableStorageKey) {
      annualSnapshotKey.current = tableStorageKey;
      return;
    }
    if (!currentUser?.id || !selectedTable || !editableRows.length || data?.readOnly || selectedSubmission ||
      !["thematic-account", "command-thematic-account", "lesson-schedule", "command-lesson-schedule", "typical-week"].includes(submissionSectionId)) return;
    try {
      writeAnnualDraft(currentUser.id, {
        key: legacyTableStorageKey, year, sectionId: submissionSectionId,
        documentTitle: editableTitle || selectedTable.title || "Документ",
        table: buildCurrentSubmissionTable(), updatedAt: new Date().toISOString(),
      });
    } catch {
      setTableNotice("Не удалось сохранить годовую копию. Проверьте свободное место в браузере и сохраните документ.");
    }
  }, [tableStorageKey, editableRows, editableTitle, editableHeaderValues, cellColors]);

  const handleTableSave = async () => {
    persistCurrentTable("saved");
    upsertSavedTable({
      id: tableStorageKey,
      title: editableTitle || selectedTable?.title || selectedPeriod?.title || selectedSection?.title || data?.title,
      savedAt: new Date().toISOString(),
      scope: data?.scope,
      table: selectedTable ? {...expandedTable, title: editableTitle || selectedTable.title} : selectedTable,
      tableStorageKey,
      headerStorageKey,
      tableActionStorageKey,
    });
    setTableStatus("saved");
    setTableNotice("Таблица сакталды.");

    if (data?.autoSubmitOnSave && currentUser?.role === "outpost") {
      setIsSubmittingThematicAccount(true);
      try {
        const submission = await createThematicAccountSubmission({
          documentTitle:
            data?.submissionDocumentTitle || editableTitle || selectedTable?.title || data?.title,
          sectionId: submissionSectionId,
          periodId: data?.submissionPeriodId || "",
          table: buildCurrentSubmissionTable(),
        });
        setThematicSubmissions((items) => [
          submission,
          ...items.filter((item) => item.id !== submission.id),
        ]);
        setTableNotice("Толтурулду. Журнал сакталды жана жөнөтүлдү.");
      } catch (error) {
 notifySave(false); return;

        setTableNotice(
          getApiErrorMessage(error, "Журнал жергиликтүү сакталды, бирок жөнөтүү мүмкүн болгон жок.")
        );
      } finally {
        setIsSubmittingThematicAccount(false);
      }
    }
  
    notifySave();
};

  const markCurrentTableSubmitted = () => {
    persistCurrentTable("submitted");
    setTableStatus("submitted");
    setTableNotice("Таблица жөнөтүлдү.");
  };

  const resetCurrentTableToDefaults = () => {
    if (!selectedTable) {
      return;
    }

    if (typeof window !== "undefined") {
      try {
        [
          tableStorageKey,
          headerStorageKey,
          titleStorageKey,
          tableActionStorageKey,
          cellColorStorageKey,
        ].forEach((key) => {
          if (key) {
            window.localStorage.removeItem(key);
          }
        });

        const remainingSavedTables = getSavedTables().filter(
          (savedTable) => savedTable.id !== tableStorageKey
        );
        window.localStorage.setItem(
          SAVED_TABLES_STORAGE_KEY,
          JSON.stringify(remainingSavedTables)
        );
      } catch {
        // The in-memory reset below should still complete if storage is unavailable.
      }
    }

    setEditableRows((selectedTable.rows || []).map((row) => ({ ...row })));
    setEditableHeaderValues(
      getDefaultHeaderValues(getEditableHeaderFields(selectedTable))
    );
    setEditableTitle(selectedTable.scheduleTitle || selectedTable.title || "");
    setCellColors({});
    setActiveCellColor("");
    setTableStatus("editing");
    setTableNotice("Таблица жөнөтүлдү жана тазаланды.");
  };

  const completeCurrentTableSubmission = () => {
    if (selectedTable?.variant === "lesson-schedule") {
      resetCurrentTableToDefaults();
      return;
    }

    markCurrentTableSubmitted();
  };

  const handleTableSend = async () => {
    const canCreateSubmission = ["outpost", "regional"].includes(currentUser?.role);

    if (canEditSelectedSubmission) {
      setSubmissionDocumentTitle(selectedSubmission.documentTitle || editableTitle || "");
      setSubmissionError("");
      setSubmissionDialogOpen(true);
      return;
    }

    if (
      isDirectSubmissionUpdate &&
      canCreateSubmission &&
      OUTPOST_SUBMISSION_SECTION_IDS.has(submissionSectionId) &&
      !selectedSubmission
    ) {
      if (data?.requestSubmissionTitleOnUpdate) {
        setSubmissionDocumentTitle("");
        setSubmissionError("");
        setSubmissionDialogOpen(true);
        return;
      }

      if (!(await confirmDocumentSend())) return;

      setIsSubmittingThematicAccount(true);
      setTableNotice("");
      persistCurrentTable("editing");
      upsertSavedTable({
        id: tableStorageKey,
        title: editableTitle || selectedTable?.title || data?.title,
        savedAt: new Date().toISOString(),
        scope: data?.scope,
        table: selectedTable
          ? {...expandedTable, title: editableTitle || selectedTable.title}
          : selectedTable,
        tableStorageKey,
        headerStorageKey,
        tableActionStorageKey,
      });

      try {
        const submission = await createThematicAccountSubmission({
          documentTitle:
            data?.submissionDocumentTitle || editableTitle || selectedTable?.title || data?.title,
          sectionId: submissionSectionId,
          periodId: data?.submissionPeriodId || selectedPeriod?.id || "",
          table: buildCurrentSubmissionTable(),
        });
        setThematicSubmissions((items) => [
          submission,
          ...items.filter((item) => item.id !== submission.id),
        ]);
        persistCurrentTable("submitted");
        setTableStatus("submitted");
        setTableNotice("Журнал жөнөтүлдү.");
        onSubmissionCreated?.(submission);
      } catch (error) {
        setTableNotice(getApiErrorMessage(error, "Журналды жаңыртуу мүмкүн болгон жок."));
      } finally {
        setIsSubmittingThematicAccount(false);
      }
      return;
    }

    if (canCreateSubmission && OUTPOST_SUBMISSION_SECTION_IDS.has(submissionSectionId) && !selectedSubmission) {
      setSubmissionDocumentTitle("");
      setSubmissionError("");
      setSubmissionDialogOpen(true);
      return;
    }

    if (await confirmDocumentSend()) {
      completeCurrentTableSubmission();
    }
  };

  const handleSubmitThematicAccount = async () => {
    const documentTitle = submissionDocumentTitle.trim();
    if (!documentTitle) {
      setSubmissionError("Иш кагаздардын аталышын жазыңыз.");
      return;
    }

    if (canEditSelectedSubmission) {
      if (!(await confirmDocumentSend())) return;
      setIsSubmittingThematicAccount(true);
      setSubmissionError("");
      setTableNotice("");
      try {
        const updatedSubmission = await updateThematicAccountSubmission(
          selectedSubmission.id,
          {
            documentTitle,
            table: buildCurrentSubmissionTable(),
          }
        );
        setThematicSubmissions((items) => items.map((item) =>
          item.id === updatedSubmission.id ? updatedSubmission : item
        ));
        setSelectedSubmission(updatedSubmission);
        setTableStatus("submitted");
        setTableNotice("Документ өзгөртүлүп, кайра жөнөтүлдү.");
        setSubmissionDialogOpen(false);
        setSubmissionDocumentTitle("");
        onSubmissionCreated?.(updatedSubmission);
      } catch (error) {
        setSubmissionError(
          getApiErrorMessage(error, "Документти кайра жөнөтүү мүмкүн болгон жок.")
        );
      } finally {
        setIsSubmittingThematicAccount(false);
      }
      return;
    }

    if (!(await confirmDocumentSend())) return;

    setIsSubmittingThematicAccount(true);
    setSubmissionError("");
    const isUpdatingDirectSubmission =
      isDirectSubmissionUpdate &&
      OUTPOST_SUBMISSION_SECTION_IDS.has(submissionSectionId) &&
      !selectedSubmission;
    const shouldResetLessonSchedule =
      !isUpdatingDirectSubmission &&
      selectedTable?.variant === "lesson-schedule";
    const shouldMoveThematicPeriodToOutgoing = Boolean(
      !isUpdatingDirectSubmission &&
      !selectedSubmission &&
      currentUser?.role !== "admin" &&
      isThematicAccountTable &&
      selectedPeriod?.canDelete
    );
    const shouldMoveTypicalWeekToOutgoing = Boolean(
      !isUpdatingDirectSubmission &&
      !selectedSubmission &&
      currentUser?.role !== "admin" &&
      submissionSectionId === "typical-week" &&
      selectedPeriod &&
      customPeriods.some((period) => period.id === selectedPeriod.id)
    );

    if (isUpdatingDirectSubmission) {
      persistCurrentTable("editing");
      upsertSavedTable({
        id: tableStorageKey,
        title: editableTitle || selectedTable?.title || data?.title,
        savedAt: new Date().toISOString(),
        scope: data?.scope,
        table: selectedTable
          ? { ...expandedTable, title: editableTitle || selectedTable.title }
          : selectedTable,
        tableStorageKey,
        headerStorageKey,
        tableActionStorageKey,
      });
    }

    try {
      const submission = await createThematicAccountSubmission({
        documentTitle,
        sectionId: submissionSectionId,
        periodId: data?.submissionPeriodId || selectedPeriod?.id || "",
        table: buildCurrentSubmissionTable(),
      });
      setThematicSubmissions((items) => [
        submission,
        ...items.filter((item) => item.id !== submission.id),
      ]);
      if (isUpdatingDirectSubmission) {
        persistCurrentTable("submitted");
        setTableStatus("submitted");
        setTableNotice("Журнал жөнөтүлдү.");
      } else {
        completeCurrentTableSubmission();
      }
      if (shouldMoveTypicalWeekToOutgoing) {
        const nextCustomPeriods = customPeriods.filter(
          (period) => period.id !== selectedPeriod.id
        );
        setCustomPeriods(nextCustomPeriods);
        saveCustomPeriods(customPeriodsStorageKey, nextCustomPeriods);
        removeTableStorage(data?.scope, selectedSection?.id, selectedPeriod.id);
      }
      if (shouldMoveThematicPeriodToOutgoing || shouldMoveTypicalWeekToOutgoing) {
        setSelectedSubmission(null);
        setSelectedPeriodId(null);
        setTableNotice("");
        if (onRefresh) {
          await onRefresh();
        }
      } else if (shouldResetLessonSchedule) {
        setSelectedSubmission(null);
        setSelectedPeriodId(null);
      } else if (!isUpdatingDirectSubmission) {
        setSelectedSubmission(submission);
      }
      setSubmissionDialogOpen(false);
      setSubmissionDocumentTitle("");
      onSubmissionCreated?.(submission);
    } catch (error) {
      setSubmissionError(
        getApiErrorMessage(error, "Таблицаны жөнөтүү мүмкүн болгон жок.")
      );
    } finally {
      setIsSubmittingThematicAccount(false);
    }
  };

  const handleDeleteSubmission = async (submission) => {
    if (!window.confirm(`"${submission.documentTitle}" өчүрүлсүнбү?`)) {
      return;
    }

    setDeletingSubmissionId(submission.id);
    setSubmissionListError("");
    try {
      await deleteThematicAccountSubmission(submission.id);
      setThematicSubmissions((items) =>
        items.filter((item) => item.id !== submission.id)
      );
      if (selectedSubmission?.id === submission.id) {
        setSelectedSubmission(null);
      }
    } catch (error) {
      setSubmissionListError(
        getApiErrorMessage(error, "Документти өчүрүү мүмкүн болгон жок.")
      );
    } finally {
      setDeletingSubmissionId(null);
    }
  };

  const handleForwardSubmission = async (submission, documentTitle) => {
    const forwarded = await forwardThematicAccountSubmission(submission.id, documentTitle);
    setThematicSubmissions((items) => [
      forwarded,
      ...items.filter((item) => item.id !== forwarded.id),
    ]);
  };

  const handleDeleteLessonPeriod = async (period) => {
    if (!window.confirm(`"${period.title}" өчүрүлсүнбү?`)) {
      return;
    }

    setDeletingLessonPeriodId(period.id);
    setSubmissionListError("");
    try {
      await deleteLessonSchedulePeriod(activePeriodContainerId, period.id);
      if (selectedPeriodId === period.id) {
        setSelectedPeriodId(null);
      }
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      setSubmissionListError(
        getApiErrorMessage(error, "Жуманы өчүрүү мүмкүн болгон жок.")
      );
    } finally {
      setDeletingLessonPeriodId(null);
    }
  };

  const handleTableEdit = () => {
    persistCurrentTable("editing");
    setTableStatus("editing");
    setTableNotice("Өзгөртүү режими күйгүзүлдү.");
  };

  const handleTableBack = () => {
    if (selectedSubmission) {
      setSelectedSubmission(null);
      return;
    }

    if (selectedPeriodId) {
      setSelectedPeriodId(null);
      return;
    }

    if (selectedNestedSubsectionId) {
      setSelectedNestedSubsectionId(null);
      return;
    }

    if (selectedSubsectionId) {
      setSelectedSubsectionId(null);
      return;
    }

    setSelectedSectionId(null);
  };

  const handlePeriodListBack = () => {
    if (selectedNestedSubsectionId) {
      setSelectedNestedSubsectionId(null);
      return;
    }

    if (selectedSubsectionId) {
      setSelectedSubsectionId(null);
      return;
    }

    setSelectedSectionId(null);
  };

  const renderTableHeader = () => {
    if (selectedTable?.headerRows?.length > 0) {
      return expandedTable.headerRows.map((headerRow, rowIndex) => (
        <tr key={`header-row-${rowIndex}`}>
          {headerRow.map((cell, cellIndex) => (
            <th
              className={cell.key ? `training-table-header--${cell.key}` : undefined}
              colSpan={cell.colSpan || undefined}
              key={cell.key || `${rowIndex}-${cellIndex}`}
              rowSpan={cell.rowSpan || undefined}
            >
              {cell.editableKey ? (
                selectedTable?.variant === "combat-subject-journal" &&
                rowIndex === 1 &&
                /^attendance_\d+$/.test(cell.key || "") ? (
                  <div
                    aria-disabled={!isTableEditing}
                    aria-label={cell.label}
                    className="training-table-header-input training-table-header-input--vertical"
                    contentEditable={isTableEditing}
                    onInput={(event) => {
                      const element = event.currentTarget;
                      const selection = window.getSelection();
                      const caretOffset = selection && element.contains(selection.focusNode)
                        ? selection.focusOffset
                        : null;
                      handleHeaderFieldChange(cell.editableKey, element.textContent || "");
                      restoreContentEditableCaret(element, caretOffset);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                      }
                    }}
                    role="textbox"
                    spellCheck={false}
                    suppressContentEditableWarning
                  >
                    {editableHeaderValues[cell.editableKey] ?? cell.defaultValue ?? cell.label ?? ""}
                  </div>
                ) : selectedTable?.variant === "lesson-schedule" && cell.editableKey.endsWith("_date") ? (
                  <textarea
                    aria-label={cell.label}
                    className="training-table-header-input training-table-header-input--date"
                    disabled={!isTableEditing}
                    onChange={(event) => {
                      handleHeaderFieldChange(cell.editableKey, event.target.value);
                      resizeTextareaToContent(event.currentTarget);
                    }}
                    ref={resizeTextareaToContent}
                    rows={2}
                    value={String(
                      editableHeaderValues[cell.editableKey] ?? cell.defaultValue ?? cell.label ?? ""
                    ).replace(/([^\n])(20__ж\.)/, "$1\n$2")}
                  />
                ) : (
                  cell.key === "attendance_hours_label" ? <input aria-label={cell.label} className="training-table-header-input training-table-header-input--hour" disabled={!isTableEditing} onChange={(event) => handleHeaderFieldChange(cell.editableKey, event.target.value)} value={editableHeaderValues[cell.editableKey] ?? cell.defaultValue ?? cell.label ?? ""} /> : <AutoSizeHeader
                    aria-label={cell.label}
                    className="training-table-header-input"
                    disabled={!isTableEditing}
                    onChange={(event) => handleHeaderFieldChange(cell.editableKey, event.target.value)}
                    value={editableHeaderValues[cell.editableKey] ?? cell.defaultValue ?? cell.label ?? ""}
                  />
                )
              ) : (
                cell.vertical ? (
                  <span className="training-table-header-vertical"><T>{cell.label}</T></span>
                ) : (
                  cell.label
                )
              )}
            </th>
          ))}
        </tr>
      ));
    }

    return (
      <tr>
        {tableColumns.map((column) => (
          <th key={column.key}><T>{column.label}</T></th>
        ))}
      </tr>
    );
  };

  const renderHeaderField = (field, index) => {
    if (field.text) {
      return (
        <span className="module-table-meta-text" key={`text-${index}`}>
          {field.text}
        </span>
      );
    }

    const fieldValue = editableHeaderValues[field.key] ?? field.defaultValue ?? "";
    const fieldClassName = [
      "module-inline-field",
      field.type === "select" ? "module-inline-field--select" : "",
      field.key === "outpost" ? "module-inline-field--outpost" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <label className={fieldClassName} key={field.key}>
        {field.prefix && <span>{field.prefix}</span>}
        {field.type === "select" ? (
          <select
            aria-label={field.label}
            disabled={!isTableEditing}
            onChange={(event) => handleHeaderFieldChange(field.key, event.target.value)}
            value={fieldValue}
          >
            <option value="">{field.placeholder || "__"}</option>
            {(field.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            aria-label={field.label}
            disabled={!isTableEditing}
            onChange={(event) => handleHeaderFieldChange(field.key, event.target.value)}
            type="text"
            value={fieldValue}
          />
        )}
        {field.suffix && <span>{field.suffix}</span>}
      </label>
    );
  };

  const renderLessonScheduleTopHeader = () => {
    const fieldValue = (key) => editableHeaderValues[key] ?? "";
    const renderInput = (key, className = "") => (
      <input
        aria-label={key}
        className={className}
        disabled={!isTableEditing}
        onChange={(event) => handleHeaderFieldChange(key, event.target.value)}
        type="text"
        value={fieldValue(key)}
      />
    );

    return (
      <div className="lesson-schedule-top-header">
        <div className="lesson-schedule-top-header__period">
          {renderInput("schedule_from_year", "lesson-schedule-top-header__year")}
          {renderInput("schedule_from_year_suffix", "lesson-schedule-top-header__literal")}
          {renderInput("schedule_from_quote_open", "lesson-schedule-top-header__quote")}
          {renderInput("schedule_from_day", "lesson-schedule-top-header__day")}
          {renderInput("schedule_from_quote_close", "lesson-schedule-top-header__quote")}
          {renderInput("schedule_from_month", "lesson-schedule-top-header__month")}
          {renderInput("schedule_start_label", "lesson-schedule-top-header__word")}
          {renderInput("schedule_to_year", "lesson-schedule-top-header__year")}
          {renderInput("schedule_to_year_suffix", "lesson-schedule-top-header__literal")}
          {renderInput("schedule_to_quote_open", "lesson-schedule-top-header__quote")}
          {renderInput("schedule_to_day", "lesson-schedule-top-header__day")}
          {renderInput("schedule_to_quote_close", "lesson-schedule-top-header__quote")}
          {renderInput("schedule_to_month", "lesson-schedule-top-header__month")}
          {renderInput("schedule_end_label", "lesson-schedule-top-header__word")}
          <div className="lesson-schedule-top-header__unit-group">
            {renderInput("schedule_unit_name", "lesson-schedule-top-header__unit")}
            {renderInput("schedule_unit_caption", "lesson-schedule-top-header__caption")}
          </div>
        </div>
      </div>
    );
  };

  const tableClassName = [
    "training-table",
    selectedTable?.variant === "lesson-schedule" ? "training-table--lesson-schedule" : "",
    isThematicAccountPhotoTable ? "training-table--thematic-account" : "",
    isCommandThematicAccountPhotoTable ? "training-table--command-thematic-account" : "",
    selectedTable?.variant === "combat-subject-journal"
      ? "training-table--combat-subject-journal"
      : "",
    selectedTable?.variant === "combat-subject-journal" && selectedTable?.hideDate
      ? "training-table--combat-subject-journal-no-date"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const isLessonScheduleTable = selectedTable?.variant === "lesson-schedule";
  const isCombatSubjectJournalTable = selectedTable?.variant === "combat-subject-journal";
  const canManageTableSections = selectedTable?.variant === "typical-week" || isThematicAccountPhotoTable;
  const tableViewClassName = [
    "module-table-view",
    "module-table-view--word",
    isLessonScheduleTable || isThematicAccountPhotoTable ? "module-table-view--word-landscape" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const renderTableActions = () => (
    <div className="module-table-actions module-table-actions--top">
      <button disabled={!isTableEditing || !tableHistory.canUndo} onClick={tableHistory.undo} type="button"><T>{"↶ Артка"}</T></button>
      <button disabled={!isTableEditing || !tableHistory.canRedo} onClick={tableHistory.redo} type="button"><T>{"↷ Алдыга"}</T></button>
      <button disabled={!isTableEditing} onClick={handleAddTableRow} type="button"><T>{"+ Сап кошуу"}</T></button>
      {isCombatSubjectJournalTable && (
        <button disabled={!isTableEditing} onClick={handleAddJournalColumn} type="button"><T>{"+ Мамыча кошуу"}</T></button>
      )}
      {canManageTableSections && (
        <>
          <button disabled={!isTableEditing} onClick={handleAddTableSection} type="button"><T>{"+ Секцияны кошуу"}</T></button>
          <button
            disabled={!isTableEditing || !editableRows.some((row) => row.rowType === "section")}
            onClick={handleDeleteTableSection}
            type="button"
          ><T>{"Секцияны өчүрүү"}</T></button>
        </>
      )}
      <button disabled={!isTableEditing || editableRows.length === 0} onClick={handleDeleteTableRow} type="button"><T>{"Сапты өчүрүү"}</T></button>
      {thematicMonthOptions.length > 0 ? (
        <button
          disabled={!isTableEditing}
          onClick={handleDeleteThematicMonth}
          type="button"
        ><T>{"- Айды өчүрүү"}</T></button>
      ) : null}
      {data?.allowThematicMonthDeletion &&
      selectedTable?.variant === "thematic-account" ? (
        <button
          disabled={!isTableEditing}
          onClick={handleAddThematicMonths}
          type="button"
        ><T>{"+ Ай кошуу"}</T></button>
      ) : null}
      <button disabled={!isTableEditing || isSubmittingThematicAccount} onClick={handleTableSave} type="button"><T>{"Сактоо"}</T></button>
      {!data?.autoSubmitOnSave && !data?.hideSubmit && (
        <button disabled={isSubmitDisabled} onClick={handleTableSend} type="button">
          <T>{data?.submissionActionLabel || "Жөнөтүү"}</T>
        </button>
      )}
      <button disabled={isTableEditing} onClick={handleTableEdit} type="button"><T>{"Өзгөртүү"}</T></button>
    </div>
  );

  const renderAdminSubmissionRow = (submission) => (
    <div className="module-period-row" key={`admin-submission-${submission.id}`}>
      <button
        className="module-period-card module-period-card--document"
        onClick={() => setSelectedSubmission(submission)}
        type="button"
      >
        <span aria-hidden="true" className="module-document-icon" />
        <span className="module-submission-card__content">
          <strong><T>{submission.documentTitle}</T></strong>
          {submission.isCorrected ? <small className="submission-corrected-status"><T>{"Өзгөрүлдү"}</T></small> : null}
          <small>{getSubmissionSenderLabel(submission)}</small>
        </span>
      </button>
      <div className="module-period-actions">
        <button
          disabled={deletingSubmissionId === submission.id}
          onClick={() => handleDeleteSubmission(submission)}
          type="button"
        >
          <T>{deletingSubmissionId === submission.id ? "Өчүрүү..." : "Өчүрүү"}</T>
        </button>
      </div>
    </div>
  );

  const renderRegionalOutpostSubmissionRow = (submission) => (
    <div className="module-period-row" key={`regional-outpost-submission-${submission.id}`}>
      <button
        className="module-period-card module-period-card--document"
        onClick={() => setSelectedSubmission(submission)}
        type="button"
      >
        <span aria-hidden="true" className="module-document-icon" />
        <span className="module-submission-card__content">
          <strong><T>{submission.documentTitle}</T></strong>
          {submission.isCorrected ? <small className="submission-corrected-status"><T>{"Өзгөрүлдү"}</T></small> : null}
          <small>{getSubmissionSenderLabel(submission)}</small>
        </span>
      </button>
      <div className="module-period-actions">
        <SubmissionEditPermissionButton
          onUpdated={(updated) =>
            setThematicSubmissions((items) =>
              items.map((item) => item.id === updated.id ? updated : item)
            )
          }
          submission={submission}
        />
        <button onClick={() => setForwardingSubmission(submission)} type="button"><T>{"Жөнөтүү"}</T></button>
        <button
          disabled={deletingSubmissionId === submission.id}
          onClick={() => handleDeleteSubmission(submission)}
          type="button"
        >
          <T>{deletingSubmissionId === submission.id ? "Өчүрүү..." : "Өчүрүү"}</T>
        </button>
      </div>
    </div>
  );

  return (
    <section className="module-panel">
      {thematicMonthDialog ? (
        <div
          className="thematic-month-dialog"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setThematicMonthDialog(null);
            }
          }}
          role="presentation"
        >
          <form
            aria-labelledby="thematic-month-dialog-title"
            aria-modal="true"
            className="thematic-month-dialog__panel"
            onSubmit={handleConfirmThematicMonthDialog}
            role="dialog"
          >
            <div className="thematic-month-dialog__icon" aria-hidden="true">
              {thematicMonthDialog.mode === "delete" ? "−" : "+"}
            </div>
            <h2 id="thematic-month-dialog-title">
              <T>{thematicMonthDialog.mode === "delete"
                ? "Айларды өчүрүү"
                : "Айларды кошуу"}</T>
            </h2>
            <p>
              <T>{thematicMonthDialog.mode === "delete"
                ? `Өчүрүлө турган мамычалардын санын көрсөтүңүз. Жеткиликтүү: ${thematicMonthOptions.length}.`
                : "Кошула турган жаңы ай мамычаларынын санын көрсөтүңүз."}</T>
            </p>
            <label><T>{"Количество месяцев"}</T><input
                autoFocus
                inputMode="numeric"
                max={
                  thematicMonthDialog.mode === "delete"
                    ? thematicMonthOptions.length
                    : 12
                }
                min="1"
                onChange={(event) =>
                  setThematicMonthDialog((currentDialog) => ({
                    ...currentDialog,
                    count: event.target.value,
                    error: "",
                  }))
                }
                type="number"
                value={thematicMonthDialog.count}
              />
            </label>
            {thematicMonthDialog.error ? (
              <p className="thematic-month-dialog__error" role="alert">
                {thematicMonthDialog.error}
              </p>
            ) : null}
            <div className="thematic-month-dialog__actions">
              <button
                className="thematic-month-dialog__cancel"
                onClick={() => setThematicMonthDialog(null)}
                type="button"
              ><T>{"Жокко чыгаруу"}</T></button>
              <button className="thematic-month-dialog__confirm" type="submit">
                <T>{thematicMonthDialog.mode === "delete"
                  ? "Өчүрүү"
                  : "Кошуу"}</T>
              </button>
            </div>
          </form>
        </div>
      ) : null}
      <header>
        <h1><T>{data?.title || "Сабактардын тематикасынын эсеби жана жүгүртмөсү"}</T></h1>
        {!data?.readOnly && !selectedSubmission ? <p><T>Отчётный год</T>: <strong>{year}</strong></p> : null}
        <p>
          <T>{data?.description || (
            data?.scope
              ? `${data.scope}нын аскер бөлүгү үчүн уруксат документтер`
              : "Учурдагы рол үчүн уруксат документтер"
          )}</T>
        </p>
      </header>
      {selectedTable ? (
        <div
          className={tableViewClassName}
          onScroll={(event) => syncHorizontalScroll(event.currentTarget, topScrollRef)}
          ref={tableViewRef}
        >
          <JournalHorizontalScroll scrollRef={tableViewRef} tableRef={tableScrollRef} />
          {(!directTable || onBack) && (
            <button
              className="module-back-button"
              onClick={directTable && onBack ? onBack : handleTableBack}
              type="button"
            ><T>{"Артка"}</T></button>
          )}
          {documentRegistrationNumber ? (
            <div className="document-registration-number"><T>{"Каттоо № "}</T>{documentRegistrationNumber}
            </div>
          ) : null}
          {isLessonScheduleTable && renderLessonScheduleTopHeader()}
          <textarea
            aria-label="Таблицанын аталышы"
            className="module-table-title module-table-title-input"
            disabled={!isTableEditing}
            onChange={handleTitleChange}
            rows={3}
            value={editableTitle}
          />
          {!isLessonScheduleTable && tableHeaderFields.length > 0 && (
            <div className="module-table-meta">
              {tableHeaderFields.map((field, index) => renderHeaderField(field, index))}
            </div>
          )}
          {!isViewingSubmission && renderTableActions()}
          {selectedTable?.enableCellColoring && (
            <div className="journal-cell-color-palette" aria-label={copyT("Таблицанын түсүн тандоо")}>
              <label>
                <button
                  aria-label="ай жыйынтыгын боё"
                  aria-pressed={activeCellColor === "green"}
                  className={`journal-cell-color-swatch journal-cell-color-swatch--green${
                    activeCellColor === "green" ? " is-active" : ""
                  }`}
                  onClick={() => setActiveCellColor("green")}
                  type="button"
                />
                <span><T>{"ай жыйынтыгын боё"}</T></span>
              </label>
              <label>
                <button
                  aria-label="жыл жыйынтыгын боё"
                  aria-pressed={activeCellColor === "red"}
                  className={`journal-cell-color-swatch journal-cell-color-swatch--red${
                    activeCellColor === "red" ? " is-active" : ""
                  }`}
                  onClick={() => setActiveCellColor("red")}
                  type="button"
                />
                <span><T>{"жыл жыйынтыгын боё"}</T></span>
              </label>
            </div>
          )}
          <div
            className="module-table-scroll-top"
            onScroll={(event) => syncHorizontalScroll(event.currentTarget, tableViewRef)}
            ref={topScrollRef}
          >
            <div style={{ width: `${tableScrollWidth}px` }} />
          </div>
          <div
            className="table-wrap"
            ref={tableScrollRef}
          >
            <MobileTableFit><table className={tableClassName}>
              {tableColumns.some((column) => column.width) && (
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
              )}
              <thead>{renderTableHeader()}</thead>
              <tbody>
                {editableRows.map((row, rowIndex) => {
                  if (row.rowType === "section") {
                    return (
                      <tr className="training-table-section-row" key={row.id || row.number || rowIndex}>
                        <td colSpan={tableColumns.length}>
                          <input
                            aria-label="Секциянын аталышы"
                            className="training-table-input"
                            data-table-cell={isTableEditing ? "true" : undefined}
                            disabled={!isTableEditing}
                            onChange={(event) => handleCellChange(rowIndex, "activity", event.target.value)}
                            onKeyDown={handleEditableCellKeyDown}
                            type="text"
                            value={row.activity || ""}
                          />
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      className={row.rowType ? `training-table-row--${row.rowType}` : undefined}
                      key={row.id || row.number || rowIndex}
                    >
                      {tableColumns.map((column) => {
                        if (selectedTable?.variant === "combat-subject-journal" && column.key === "attendance_marker") return null;
                        const paintCellKey = `${rowIndex}:${column.key}`;
                        const paintedColor = cellColors[paintCellKey];
                        const cellClassName = [
                          `training-table-cell--${column.key}`,
                          column.type === "line-list" ? "training-table-cell--line-list" : "",
                          paintedColor ? "training-table-cell--painted" : "",
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <td
                            className={cellClassName}
                            colSpan={selectedTable?.variant === "combat-subject-journal" && column.key === "personal_number" && tableColumns.some((item) => item.key === "attendance_marker") ? 2 : undefined}
                            key={column.key}
                            onClick={() => handlePaintJournalCell(rowIndex, column.key)}
                            style={
                              paintedColor === "green"
                                ? { backgroundColor: "#55b86a" }
                                : paintedColor === "red"
                                  ? { backgroundColor: "#e25b56" }
                                  : undefined
                            }
                          >
                          {(column.key === "number" && !column.editable) || column.readOnly ? (
                            column.key === "attendance_marker" ? null : row[column.key]
                          ) : column.type === "line-list" ? (
                            <div className="training-table-line-list">
                              {(() => {
                                const cellValue = Array.isArray(row[column.key])
                                  ? row[column.key]
                                  : String(row[column.key] || "").split("\n");
                                const lineCount = Math.max(column.lines || 1, cellValue.length);

                                return Array.from({length: lineCount}, (_, lineIndex) => {
                                  const canRemoveLine = column.canAddLines && lineCount > (column.lines || 1);

                                  return (
                                    <div className="training-table-line-row" key={`${column.key}-${lineIndex}`}>
                                      <input
                                        aria-label={`${column.label || "line"} ${row.number || rowIndex + 1}.${lineIndex + 1}`}
                                        className="training-table-input training-table-line-input"
                                        data-table-cell={isTableEditing ? "true" : undefined}
                                        disabled={!isTableEditing}
                                        onChange={(event) =>
                                          handleCellLineChange(rowIndex, column, lineIndex, event.target.value)
                                        }
                                        onKeyDown={handleEditableCellKeyDown}
                                        tabIndex={isTableEditing ? 0 : -1}
                                        type={column.inputType || "text"}
                                        value={cellValue[lineIndex] || ""}
                                      />
                                      {canRemoveLine && (
                                        <button
                                          aria-label={copyT("Сапты өчүрүү")}
                                          className="training-table-line-remove"
                                          disabled={!isTableEditing}
                                          onClick={() => handleRemoveCellLine(rowIndex, column, lineIndex)}
                                          type="button"
                                        >
                                          x
                                        </button>
                                      )}
                                    </div>
                                  );
                                });
                              })()}
                              {column.canAddLines && isTableEditing && (
                                <button
                                  className="training-table-line-add"
                                  disabled={!isTableEditing || (Array.isArray(row[column.key]) ? row[column.key].length : String(row[column.key] || "").split("\n").length) >= (column.maxLines || 20)}
                                  onClick={() => handleAddCellLine(rowIndex, column)}
                                  type="button"
                                ><T>{"+ сап"}</T></button>
                              )}
                            </div>
                          ) : isMultilineColumn(column) ? (
                            <textarea
                              aria-label={`${column.label} ${row.number || rowIndex + 1}`}
                              className={`training-table-input training-table-input--textarea${isLessonScheduleTable ? " training-table-input--auto-grow" : ""}`}
                              data-table-cell={isTableEditing ? "true" : undefined}
                              disabled={!isTableEditing}
                              placeholder={column.key === "topic" ? row.topicPlaceholder || "" : undefined}
                              onChange={(event) =>
                                handleCellChange(rowIndex, column.key, event.target.value)
                              }
                              onInput={(event) => resizeTextareaToContent(event.currentTarget)}
                              onKeyDown={handleEditableCellKeyDown}
                              ref={isLessonScheduleTable ? resizeTextareaToContent : undefined}
                              rows={row[`${column.key}Rows`] || column.rows || 3}
                              tabIndex={isTableEditing ? 0 : -1}
                              value={Array.isArray(row[column.key]) ? row[column.key].join("\n") : row[column.key] ?? ""}
                            />
                          ) : (
                            <input
                              aria-label={`${column.label} ${row.number || rowIndex + 1}`}
                              className="training-table-input"
                              data-table-cell={isTableEditing ? "true" : undefined}
                              disabled={!isTableEditing}
                              min={column.key === "hours" || column.type === "number" ? "0" : undefined}
                              onChange={(event) => handleCellChange(rowIndex, column.key, event.target.value)}
                              onKeyDown={handleEditableCellKeyDown}
                              step={column.type === "number" ? "1" : undefined}
                              type={column.type || (column.key === "hours" ? "number" : "text")}
                              tabIndex={isTableEditing ? 0 : -1}
                              value={row[column.key] ?? ""}
                            />
                          )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table></MobileTableFit>
          </div>
          {!isViewingSubmission && <div className="module-table-actions">
            <button disabled={!isTableEditing || !tableHistory.canUndo} onClick={tableHistory.undo} type="button"><T>{"↶ Артка"}</T></button>
            <button disabled={!isTableEditing || !tableHistory.canRedo} onClick={tableHistory.redo} type="button"><T>{"↷ Алдыга"}</T></button>
            <button disabled={!isTableEditing} onClick={handleAddTableRow} type="button"><T>{"+ Сап кошуу"}</T></button>
      {isCombatSubjectJournalTable && (
        <button disabled={!isTableEditing} onClick={handleAddJournalColumn} type="button"><T>{"+ Мамыча кошуу"}</T></button>
      )}
            {canManageTableSections && (
              <>
                <button disabled={!isTableEditing} onClick={handleAddTableSection} type="button"><T>{"+ Секцияны кошуу"}</T></button>
                <button
                  disabled={!isTableEditing || !editableRows.some((row) => row.rowType === "section")}
                  onClick={handleDeleteTableSection}
                  type="button"
                ><T>{"Секцияны өчүрүү"}</T></button>
              </>
            )}
            <button disabled={!isTableEditing || editableRows.length === 0} onClick={handleDeleteTableRow} type="button"><T>{"Сапты өчүрүү"}</T></button>
            {thematicMonthOptions.length > 0 ? (
              <button
                disabled={!isTableEditing}
                onClick={handleDeleteThematicMonth}
                type="button"
              ><T>{"- Айды өчүрүү"}</T></button>
            ) : null}
            {data?.allowThematicMonthDeletion &&
            selectedTable?.variant === "thematic-account" ? (
              <button
                disabled={!isTableEditing}
                onClick={handleAddThematicMonths}
                type="button"
              ><T>{"+ Ай кошуу"}</T></button>
            ) : null}
            <button disabled={!isTableEditing || isSubmittingThematicAccount} onClick={handleTableSave} type="button"><T>{"Сактоо"}</T></button>
            {!data?.autoSubmitOnSave && !data?.hideSubmit && (
              <button disabled={isSubmitDisabled} onClick={handleTableSend} type="button">
                <T>{data?.submissionActionLabel || "Жөнөтүү"}</T>
              </button>
            )}
            <button disabled={isTableEditing} onClick={handleTableEdit} type="button"><T>{"Өзгөртүү"}</T></button>
          </div>}
          {tableNotice && <p className="module-table-status">{tableNotice}</p>}
        </div>
      ) : selectedSubsections.length > 0 && !selectedSubsectionId ? (
        <div className="module-table-view">
          <button className="module-back-button" onClick={() => setSelectedSectionId(null)} type="button"><T>{"Артка"}</T></button>
          <div className="module-document-list">
            {selectedSubsections.map((section) => (
              <button
                className="module-document-card"
                key={section.id || section.title}
                onClick={() => setSelectedSubsectionId(section.id)}
                type="button"
              >
                <span aria-hidden="true" className="module-document-icon" />
                <strong><T>{section.title}</T></strong>
              </button>
            ))}
            {(selectedSection?.periods || EMPTY_ARRAY).map((period) => (
              <button
                className="module-document-card"
                key={period.id || period.title}
                onClick={() => setSelectedPeriodId(period.id)}
                type="button"
              >
                <span aria-hidden="true" className="module-document-icon" />
                <strong>{period.title}</strong>
              </button>
            ))}
          </div>
        </div>
      ) : selectedNestedSubsections.length > 0 && !selectedNestedSubsectionId ? (
        <div className="module-table-view">
          <button className="module-back-button" onClick={() => setSelectedSubsectionId(null)} type="button"><T>{"Артка"}</T></button>
          <div className="module-document-list">
            {selectedNestedSubsections.map((section) => (
              <button
                className="module-document-card"
                key={section.id || section.title}
                onClick={() => setSelectedNestedSubsectionId(section.id)}
                type="button"
              >
                <span aria-hidden="true" className="module-document-icon" />
                <strong><T>{section.title}</T></strong>
              </button>
            ))}
          </div>
        </div>
      ) : isRegionalOutpostBrowserLocation ? (
        <div className="module-table-view">
          <button
            className="module-back-button"
            onClick={() => {
              if (selectedAdminOutpostName) {
                setSelectedAdminOutpostName(null);
              } else {
                handlePeriodListBack();
              }
            }}
            type="button"
          ><T>{"Артка"}</T></button>
          <div className="module-period-list">
            {selectedAdminOutpostName ? (
              <>
                <h2>{selectedAdminOutpostName}</h2>
                {isWeeklyScheduleSection ? (
                  <WeeklySubmissionStatus
                    now={weeklyStatusNow}
                    submission={getRegionalOutpostWeeklySubmission(
                      selectedAdminOutpostName
                    )}
                  />
                ) : null}
                <div className="module-submission-list">
                  <h3><T>{"Заставадан жөнөтүлгөн документтер"}</T></h3>
                  {selectedRegionalOutpostSubmissions.length > 0 ? (
                    selectedRegionalOutpostSubmissions.map(
                      renderRegionalOutpostSubmissionRow
                    )
                  ) : (
                    <p className="module-submission-list__empty"><T>{"Бул заставадан жөнөтүлгөн документтер азырынча жок."}</T></p>
                  )}
                  {submissionListError && (
                    <p className="lesson-period-dialog__error">{submissionListError}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2>{currentUser?.region}<T>{" аскер бөлүгүнүн заставалары"}</T></h2>
                {regionalOutpostNames.length > 0 ? (
                  <div className="saved-table-list">
                    {regionalOutpostNames.map((outpostName) => {
                      const unreadDocumentCount = regionalOutpostSubmissions.filter(
                        (submission) =>
                          formatOutpostName(submission.outpostName) === outpostName &&
                          !submission.isRead
                      ).length;

                      return (
                        <button
                          className={`saved-table-card${
                            unreadDocumentCount > 0
                              ? " saved-table-card--with-notification"
                              : ""
                          }`}
                          key={outpostName}
                          onClick={() => handleOpenRegionalOutpost(outpostName)}
                          type="button"
                        >
                          <strong><T>{outpostName}</T></strong>
                          {isWeeklyScheduleSection ? (
                            <WeeklySubmissionStatus
                              now={weeklyStatusNow}
                              submission={getRegionalOutpostWeeklySubmission(
                                outpostName
                              )}
                            />
                          ) : null}
                          {unreadDocumentCount > 0 ? (
                            <span
                              aria-label={`Новых документов: ${unreadDocumentCount}`}
                              className="combat-journal-notification-badge"
                            >
                              {unreadDocumentCount}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="dashboard-state"><T>{"Бул аскер бөлүгүнө катталган заставалар азырынча жок."}</T></p>
                )}
              </>
            )}
            {isWeeklyScheduleSection ? (
              <div className="module-submission-list">
                <h3><T>{"Аскер бөлүктүн администраторго жөнөтүү"}</T></h3>
                <WeeklySubmissionStatus
                  now={weeklyStatusNow}
                  submission={latestRegionalWeeklySubmission}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : isAdminGroupedSubmissionSection ? (
        <div className="module-table-view">
          <button
            className="module-back-button"
            onClick={() => {
              if (selectedAdminOutpostName) {
                setSelectedAdminOutpostName(null);
              } else if (selectedAdminUnitNumber) {
                setSelectedAdminUnitNumber(null);
              } else {
                handlePeriodListBack();
              }
            }}
            type="button"
          ><T>{"Артка"}</T></button>
          {selectedAdminOutpostName ? (
            <div className="module-period-list">
              <h2>{selectedAdminOutpostName}</h2>
              {isWeeklyScheduleSection ? (
                <WeeklySubmissionStatus
                  now={weeklyStatusNow}
                  submission={getAdminOutpostWeeklySubmission(
                    selectedAdminOutpostName
                  )}
                />
              ) : null}
              <div className="module-submission-list">
                <h3><T>{"Заставадан жөнөтүлгөн документтер"}</T></h3>
                {selectedAdminOutpostSubmissions.length > 0 ? (
                  selectedAdminOutpostSubmissions.map(renderAdminSubmissionRow)
                ) : (
                  <p className="module-submission-list__empty"><T>{"Бул заставадан жөнөтүлгөн документтер азырынча жок."}</T></p>
                )}
                {submissionListError && (
                  <p className="lesson-period-dialog__error">{submissionListError}</p>
                )}
              </div>
            </div>
          ) : selectedAdminUnitNumber ? (
            <div className="module-period-list">
              <h2>{selectedAdminUnitNumber}<T>{" аскер бөлүгү"}</T></h2>
              {isWeeklyScheduleSection ? (
                <WeeklySubmissionStatus
                  now={weeklyStatusNow}
                  submission={getLatestSubmission(adminMilitaryUnitSubmissions)}
                />
              ) : null}
              <div className="module-submission-list">
                <h3><T>{"Аскер бөлүктөн жөнөтүлгөн документтер"}</T></h3>
                {adminMilitaryUnitSubmissions.length > 0 ? (
                  adminMilitaryUnitSubmissions.map(renderAdminSubmissionRow)
                ) : (
                  <p className="module-submission-list__empty"><T>{"Аскер бөлүктөн жөнөтүлгөн документтер азырынча жок."}</T></p>
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
                        {isWeeklyScheduleSection ? (
                          <WeeklySubmissionStatus
                            now={weeklyStatusNow}
                            submission={getAdminOutpostWeeklySubmission(outpostName)}
                          />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="module-submission-list__empty"><T>{"Бул аскер бөлүгүнө караштуу заставалар табылган жок."}</T></p>
                )}
                {submissionListError && (
                  <p className="lesson-period-dialog__error">{submissionListError}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="module-document-list">
              {adminUnitNumbers.length > 0 ? (
                adminUnitNumbers.map((unitNumber) => (
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
                    {isWeeklyScheduleSection ? (
                      <WeeklySubmissionStatus
                        now={weeklyStatusNow}
                        submission={getLatestSubmission(
                          sectionSubmissions.filter(
                            (submission) =>
                              submission.senderRole === "regional" &&
                              String(submission.unitNumber) === String(unitNumber)
                          )
                        )}
                      />
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="module-submission-list__empty"><T>{"Катталган аскер бөлүктөрү азырынча жок."}</T></p>
              )}
            </div>
          )}
        </div>
      ) : displayedPeriods.length > 0 || canAddCustomPeriod || isRegionalIncomingViewer || showsOutpostSubmissions || showsRegionalOutgoingSubmissions ? (
        <div className="module-table-view">
          <button className="module-back-button" onClick={handlePeriodListBack} type="button"><T>{"Артка"}</T></button>
          <div className="module-period-list">
            {isWeeklyScheduleSection &&
            ["outpost", "regional"].includes(currentUser?.role) ? (
              <div className="module-submission-list">
                <h3>
                  <T>{currentUser?.role === "outpost"
                    ? "Заставадан аскер бөлүккө жөнөтүү"
                    : "Аскер бөлүгүнөн администраторго жөнөтүү"}</T>
                </h3>
                <WeeklySubmissionStatus
                  now={weeklyStatusNow}
                  submission={latestOwnWeeklySubmission}
                />
              </div>
            ) : null}
            {displayedPeriods.map((period) => {
              const isCustomPeriod = customPeriods.some((customPeriod) => customPeriod.id === period.id);
              const showAdminPeriodActions = canManageCustomPeriods && (period.canEdit || isCustomPeriod);
              const showLessonPeriodDelete = !isAdmin && isLessonSchedulePeriodList && period.canDelete;
              const showPeriodActions = showAdminPeriodActions || showLessonPeriodDelete || isLessonSchedulePeriodList;

              return (
                <div className="module-period-row" key={period.id}>
                  <button
                    className="module-period-card module-period-card--document"
                    onClick={() => setSelectedPeriodId(period.id)}
                    type="button"
                  >
                    <span aria-hidden="true" className="module-document-icon" />
                    <strong>{period.title}</strong>
                  </button>
                  {showPeriodActions && (
                    <div className="module-period-actions">
                      {showAdminPeriodActions && (
                        <button onClick={() => handleRenameCustomPeriod(period)} type="button"><T>{"Өзгөртүү"}</T></button>
                      )}
                      {(showLessonPeriodDelete || (isLessonSchedulePeriodList && !isAdmin)) && (
                        <button
                          disabled={deletingLessonPeriodId === period.id}
                          onClick={() => handleDeleteLessonPeriod(period)}
                          type="button"
                        >
                          <T>{deletingLessonPeriodId === period.id ? "Өчүрүү..." : "Өчүрүү"}</T>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {canAddCustomPeriod && !isRegionalIncomingViewer && (
              <button className="module-period-add-button" onClick={handleAddCustomPeriod} type="button">
                {customPeriodConfig.buttonLabel}
              </button>
            )}
            {(showsOutpostSubmissions || showsRegionalOutgoingSubmissions) && (
              <div className="module-submission-list">
                {showsOutpostSubmissions ? (
                  <><h3><T>{currentUser?.role === "outpost" ? "Чыгыш" : "Кириш"}</T></h3>
                {visibleSubmissions.length > 0 ? (
                  visibleSubmissions.map((submission) => (
                    <div className="module-period-row" key={`submission-${submission.id}`}>
                      <button
                        className="module-period-card module-period-card--document"
                        onClick={() => setSelectedSubmission(submission)}
                        type="button"
                      >
                        <span aria-hidden="true" className="module-document-icon" />
                        <span className="module-submission-card__content">
                          <strong><T>{submission.documentTitle}</T></strong>
                          {submission.isCorrected ? <small className="submission-corrected-status"><T>{"Өзгөрүлдү"}</T></small> : null}
                          <small>{getSubmissionSenderLabel(submission)}</small>
                          <small><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(submission)}</small>
                        </span>
                      </button>
                      <div className="module-period-actions">
                          {currentUser?.role === "outpost" && isThematicAccountTable ? (
                            <SubmissionExportButtons submission={submission} />
                          ) : null}
                          <SubmissionEditPermissionButton
                            onUpdated={(updated) => setThematicSubmissions((items) => items.map((item) => item.id === updated.id ? updated : item))}
                            submission={submission}
                          />
                          {currentUser?.role === "regional" && submission.senderRole === "outpost" ? (
                            <button onClick={() => setForwardingSubmission(submission)} type="button"><T>{"Жөнөтүү"}</T></button>
                          ) : null}
                          <button
                            disabled={deletingSubmissionId === submission.id}
                            onClick={() => handleDeleteSubmission(submission)}
                            type="button"
                          >
                            <T>{deletingSubmissionId === submission.id ? "Өчүрүү..." : "Өчүрүү"}</T>
                          </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="module-submission-list__empty"><T>{"Жөнөтүлгөн документтер азырынча жок."}</T></p>
                )}</>
                ) : null}
                {submissionListError && (
                  <p className="lesson-period-dialog__error">{submissionListError}</p>
                )}
                {showsRegionalOutgoingSubmissions ? (
                  <>
                    <h3><T>{"Чыгыш"}</T></h3>
                    {outgoingRegionalSubmissions.length > 0 ? (
                      outgoingRegionalSubmissions.map((submission) => (
                        <div className="module-period-row" key={`outgoing-${submission.id}`}>
                          <button
                            className="module-period-card module-period-card--document"
                            onClick={() => setSelectedSubmission(submission)}
                            type="button"
                          >
                            <span aria-hidden="true" className="module-document-icon" />
                            <span className="module-submission-card__content">
                              <strong><T>{submission.documentTitle}</T></strong>
                              {submission.isCorrected ? <small className="submission-corrected-status"><T>{"Өзгөрүлдү"}</T></small> : null}
                              <small><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(submission)}</small>
                            </span>
                          </button>
                          <div className="module-period-actions">
                            {isThematicAccountTable ? (
                              <SubmissionExportButtons submission={submission} />
                            ) : null}
                            <SubmissionEditPermissionButton
                              onUpdated={(updated) => setThematicSubmissions((items) => items.map((item) => item.id === updated.id ? updated : item))}
                              submission={submission}
                            />
                            <button disabled={deletingSubmissionId === submission.id} onClick={() => handleDeleteSubmission(submission)} type="button">
                              <T>{deletingSubmissionId === submission.id ? "Өчүрүү..." : "Өчүрүү"}</T>
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="module-submission-list__empty"><T>{"Жөнөтүлгөн документтер азырынча жок."}</T></p>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : sections.length > 0 ? (
        <div className="module-metric-grid module-section-grid">
          {sections.map((section) => (
            hasSectionContent(section) ? (
              <button
                className="module-metric module-section-card"
                key={section.id || section.title}
                onClick={() => setSelectedSectionId(section.id)}
                type="button"
              >
                <strong><T>{section.title}</T></strong>
              </button>
            ) : (
              <article className="module-metric module-section-card" key={section.id || section.title}>
                <strong><T>{section.title}</T></strong>
              </article>
            )
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><T>{"Документ"}</T></th>
                <th><T>{"Тип"}</T></th>
                <th><T>{"Жаңыртылды"}</T></th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.type}</td>
                  <td>{item.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SubmissionForwardDialog
        onClose={() => setForwardingSubmission(null)}
        onForward={handleForwardSubmission}
        submission={forwardingSubmission}
      />
      {submissionDialogOpen && (
        <div className="lesson-period-dialog" role="dialog" aria-modal="true" aria-labelledby="submission-dialog-title">
          <form
            className="lesson-period-dialog__panel"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmitThematicAccount();
            }}
          >
            <h2 id="submission-dialog-title">
              <T>{canEditSelectedSubmission
                ? "Документти оңдоп кайра жөнөтүү"
                : isDirectSubmissionUpdate && data?.requestSubmissionTitleOnUpdate
                ? "Журналды жаңылоо"
                : "Таблицаны жөнөтүү"}</T>
            </h2>
            <label className="module-inline-field">
              <span><T>{"Иш кагаздардын аталышы"}</T></span>
              <input
                autoFocus
                onChange={(event) => {
                  setSubmissionDocumentTitle(event.target.value);
                  setSubmissionError("");
                }}
                placeholder="Иш кагаздардын аталышы"
                type="text"
                value={submissionDocumentTitle}
              />
            </label>
            {submissionError && <p className="lesson-period-dialog__error">{submissionError}</p>}
            <div className="lesson-period-dialog__actions">
              <button
                disabled={isSubmittingThematicAccount}
                onClick={() => setSubmissionDialogOpen(false)}
                type="button"
              ><T>{"Жокко чыгаруу"}</T></button>
              <button disabled={isSubmittingThematicAccount} type="submit">
                <T>{canEditSelectedSubmission
                  ? isSubmittingThematicAccount
                    ? "Кайра жөнөтүлүүдө..."
                    : "Кайра жөнөтүү"
                  : isDirectSubmissionUpdate && data?.requestSubmissionTitleOnUpdate
                  ? isSubmittingThematicAccount
                    ? "Жаңыртылууда..."
                    : "Жаңылоо"
                  : isSubmittingThematicAccount
                    ? "Жөнөтүлүүдө..."
                    : "Жөнөтүү"}</T>
              </button>
            </div>
          </form>
        </div>
      )}
      {customTableDraft && (
        <div className="lesson-period-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-table-dialog-title">
          <form className="lesson-period-dialog__panel lesson-period-dialog__panel--document-create" onSubmit={(event) => {
            event.preventDefault();
            handleCreateCustomTable();
          }}>
            <h2 id="custom-table-dialog-title"><T>{customPeriodConfig?.promptLabel || "Аталышы"}</T></h2>
            <label className="module-inline-field">
              <span><T>{"Аталышы"}</T></span>
              <input
                autoFocus
                onChange={(event) => {
                  setCustomTableTitle(event.target.value);
                  setCustomTableError("");
                }}
                placeholder={THEMATIC_ACCOUNT_SECTION_IDS.has(activePeriodContainerId)
                  ? buildThematicAccountDocumentPlaceholder(
                      currentUser,
                      activePeriodContainerId === COMMAND_THEMATIC_ACCOUNT_SECTION_ID
                    )
                  : "Аталышын жазыңыз"}
                type="text"
                value={customTableTitle}
              />
            </label>
            {customTableError && <p className="lesson-period-dialog__error">{customTableError}</p>}
            <div className="lesson-period-dialog__actions">
              <button onClick={closeCustomTableDialog} type="button"><T>{"Жокко чыгаруу"}</T></button>
              <button type="submit"><T>{"Кошуу"}</T></button>
            </div>
          </form>
        </div>
      )}
      {lessonPeriodDraft && (
        <div className="lesson-period-dialog" role="dialog" aria-modal="true" aria-labelledby="lesson-period-dialog-title">
          <form className="lesson-period-dialog__panel" onSubmit={(event) => {
            event.preventDefault();
            handleCreateLessonPeriod();
          }}>
            <h2 id="lesson-period-dialog-title">{customPeriodConfig?.promptLabel || "Жуманын аталышы"}</h2>
            <div className="lesson-period-title-builder">
              <span><T>{"Сабактардын жүгүртмөсү \""}</T></span>
              <input
                aria-label="Айы"
                autoFocus
                className="lesson-period-title-builder__input lesson-period-title-builder__input--month"
                onChange={(event) => setLessonPeriodMonth(event.target.value)}
                placeholder={LESSON_SCHEDULE_MONTH_PLACEHOLDER}
                value={lessonPeriodMonth}
              />
              <span><T>{" \"айынын "}</T></span>
              <input
                aria-label="Жуманын номери"
                className="lesson-period-title-builder__input lesson-period-title-builder__input--week"
                inputMode="numeric"
                onChange={(event) => setLessonPeriodWeek(event.target.value)}
                placeholder={LESSON_SCHEDULE_WEEK_PLACEHOLDER}
                value={lessonPeriodWeek}
              />
              <span><T>{" жумасы"}</T></span>
            </div>
            {lessonPeriodError && <p className="lesson-period-dialog__error">{lessonPeriodError}</p>}
            <div className="lesson-period-dialog__actions">
              <button disabled={isCreatingLessonPeriod} onClick={closeLessonPeriodDialog} type="button"><T>{"Жокко чыгаруу"}</T></button>
              <button disabled={isCreatingLessonPeriod} type="submit">
                <T>{isCreatingLessonPeriod ? "Кошулууда..." : "Кошуу"}</T>
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
