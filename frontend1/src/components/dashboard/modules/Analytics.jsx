import {printAnalysisDocument} from "../../../utils/printAnalysis.js";
import {useLanguage as useCopyLanguage} from "../../../i18n.jsx";
import { moduleNavigationKey } from "../../../utils/moduleNavigation.js";
import { notifySave } from "../../../utils/saveFeedback.js";
import DocumentRichEditor, {richTextToPlain} from "./DocumentRichEditor.jsx";
import FitDocumentPages from "./FitDocumentPages.jsx";
import { isMonthlyAnalysisSubmitted, formatMonthlyAnalysisCountdown } from "../../../utils/monthlyAnalysisStatus.js";
import { T } from "../../../i18n.jsx";
import { useHistoryState } from "../../../hooks/useHistoryState.js";
﻿import React, { useEffect, useRef, useState } from "react";

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

const kyrgyzstanCoatOfArmsUrl =
  "https://upload.wikimedia.org/wikipedia/commons/f/f1/Emblem_of_Kyrgyzstan.svg";
const MONTHLY_ANALYSIS_REGISTRY_COUNTER_KEY = "monthly-analysis-registry-counter";
const MONTHLY_ANALYSIS_DRAFT_STORAGE_KEY = "monthly-analysis-draft";
const MONTHLY_ANALYSIS_DOCUMENTS_STORAGE_KEY = "monthly-analysis-documents";
const MONTHLY_ANALYSIS_ACTIVE_DOCUMENT_ID_KEY = "monthly-analysis-active-document-id";
const ANALYSIS_DOCUMENTS_BY_SECTION_KEY = "analysis-documents-by-section";
const ANALYSIS_ACTIVE_IDS_BY_SECTION_KEY = "analysis-active-document-ids-by-section";
const ANALYTICS_SECTIONS_STORAGE_KEY = "analytics-section-titles";
const ADMIN_ANALYSIS_WORKSPACE_ID = "admin-analysis-workspace";
const MONTHLY_ANALYSIS_SECTION_ID = "monthly-analysis";
const PERIOD_ANALYSIS_SECTION_ID = "period-analysis";
const YEAR_ANALYSIS_SECTION_ID = "year-analysis";

const YEAR_ANALYSIS_REPORTING_YEAR = 2026;

const getMonthlyAnalysisDraftStorageKey = (sectionId) =>
  `${MONTHLY_ANALYSIS_DRAFT_STORAGE_KEY}:${sectionId || "monthly-analysis"}`;

const getLatestAnalysisSubmission = (submissions = []) =>
  [...submissions].sort(
    (left, right) =>
      new Date(right.updatedAt || right.createdAt) -
      new Date(left.updatedAt || left.createdAt)
  )[0] || null;

const MonthlyAnalysisSubmissionStatus = ({ submission, now }) => {
  const isSubmitted = isMonthlyAnalysisSubmitted(submission, now);

  return (
    <span className="analysis-monthly-status-group">
      <span
        className={`analysis-monthly-status analysis-monthly-status--${
          isSubmitted ? "sent" : "missing"
        }`}
      >
        <T>{isSubmitted ? "Аткарылды" : "Аткарылган эмес"}</T>
      </span>
      <span className="analysis-monthly-countdown"><T>{"До 28 числа: "}</T>{formatMonthlyAnalysisCountdown(now)}
      </span>
    </span>
  );
};

const getPeriodAnalysisReportingCycle = (now) => {
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

const isPeriodAnalysisSubmitted = (submission, now) => {
  const sentAt = new Date(
    submission?.updatedAt || submission?.createdAt || ""
  ).getTime();
  if (!Number.isFinite(sentAt) || sentAt > now) return false;

  return sentAt >= getPeriodAnalysisReportingCycle(now).startedAt.getTime();
};

const formatPeriodAnalysisCountdown = (now) => {
  const remainingSeconds = Math.max(
    0,
    Math.ceil((getPeriodAnalysisReportingCycle(now).endsAt.getTime() - now) / 1000)
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

const PeriodAnalysisSubmissionStatus = ({ submission, now }) => {
  const isSubmitted = isPeriodAnalysisSubmitted(submission, now);
  const cycle = getPeriodAnalysisReportingCycle(now);

  return (
    <span className="analysis-period-status-group">
      <span
        className={`analysis-period-status analysis-period-status--${
          isSubmitted ? "sent" : "missing"
        }`}
      >
        <T>{isSubmitted ? "Аткарылды" : "Аткарылган эмес"}</T>
      </span>
      <span className="analysis-period-countdown"><T>{"До 1 "}</T>{cycle.nextMonthLabel}: {formatPeriodAnalysisCountdown(now)}
      </span>
    </span>
  );
};

const getYearAnalysisDeadline = () =>
  new Date(YEAR_ANALYSIS_REPORTING_YEAR, 10, 1, 0, 0, 0, 0);

const isYearAnalysisSubmitted = (submission, now) => {
  const sentAt = new Date(
    submission?.updatedAt || submission?.createdAt || ""
  ).getTime();
  if (!Number.isFinite(sentAt) || sentAt > now) return false;

  const reportingYearStartedAt = new Date(
    YEAR_ANALYSIS_REPORTING_YEAR - 1,
    10,
    1,
    0,
    0,
    0,
    0
  ).getTime();
  return sentAt >= reportingYearStartedAt;
};

const formatYearAnalysisCountdown = (now) => {
  const remainingSeconds = Math.max(
    0,
    Math.ceil((getYearAnalysisDeadline().getTime() - now) / 1000)
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

const YearAnalysisSubmissionStatus = ({ submission, now }) => {
  const isSubmitted = isYearAnalysisSubmitted(submission, now);

  return (
    <span className="analysis-period-status-group">
      <span
        className={`analysis-period-status analysis-period-status--${
          isSubmitted ? "sent" : "missing"
        }`}
      >
        <T>{isSubmitted ? "Аткарылды" : "Аткарылган эмес"}</T>
      </span>
      <span className="analysis-period-countdown"><T>{"До 1 ноября: "}</T>{formatYearAnalysisCountdown(now)}
      </span>
    </span>
  );
};

const DEFAULT_ANALYTICS_SECTIONS = [
  {
    id: "monthly-analysis",
    title: "Айдын талдоосу",
  },
  {
    id: "period-analysis",
    title: "Окуу жылынын жарым жылдык талдоосу",
  },
  {
    id: "year-analysis",
    title: "Окуу жылынын жылдык талдоосу",
  },
];

const getStoredAnalyticsSections = () => {
  if (typeof window === "undefined") return DEFAULT_ANALYTICS_SECTIONS;

  try {
    const storedTitles = JSON.parse(
      window.localStorage.getItem(ANALYTICS_SECTIONS_STORAGE_KEY) || "{}"
    );
    return DEFAULT_ANALYTICS_SECTIONS.map((section) => ({
      ...section,
      title:
        typeof storedTitles[section.id] === "string" && storedTitles[section.id].trim()
          ? storedTitles[section.id].trim()
          : section.title,
    }));
  } catch {
    return DEFAULT_ANALYTICS_SECTIONS;
  }
};

export default function Analytics({ data, user }) {
 const {t:copyT}=useCopyLanguage();

  const commanderSignatureCanvasRef = useRef(null);
  const isDrawingCommanderSignatureRef = useRef(false);
  const hasHydratedMonthlyAnalysisRef = useRef(false);
  const monthlyAnalysisPhotoInputRef = useRef(null);
  const monthlyAnalysisVideoInputRef = useRef(null);
  const monthlyAnalysisDocumentInputRef = useRef(null);
  const monthlyAnalysisDocumentsRef = useRef([]);
  const activeMonthlyAnalysisDocumentIdRef = useRef(null);
  const analysisDocumentsBySectionRef = useRef({});
  const analysisActiveIdsBySectionRef = useRef({});
  const analyticsStorageNamespace =
    typeof data?.storageNamespace === "string" && data.storageNamespace.trim()
      ? data.storageNamespace.trim()
      : "";
  const getAnalyticsStorageKey = (storageKey) =>
    analyticsStorageNamespace
      ? `${storageKey}:${analyticsStorageNamespace}`
      : storageKey;
  const registryCounterStorageKey =
    data?.registryCounterStorageKey ||
    getAnalyticsStorageKey(MONTHLY_ANALYSIS_REGISTRY_COUNTER_KEY);
  const getAnalyticsDraftStorageKey = (sectionId) =>
    getAnalyticsStorageKey(getMonthlyAnalysisDraftStorageKey(sectionId));
  const [analyticsSections, setAnalyticsSections] = useState(getStoredAnalyticsSections);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  const [selectedAnalyticsScope, setSelectedAnalyticsScope] = useState(
    data?.directEditor ? "regional-unit" : null
  );
  const [selectedSectionId, setSelectedSectionId] = useHistoryState(moduleNavigationKey("Analytics", user, data), 
    data?.initialSectionId || null
  );
  const [selectedAdminUnitNumber, setSelectedAdminUnitNumber] = useState(null);
  const [selectedAdminOutpostName, setSelectedAdminOutpostName] = useState(null);
  const [monthlyAnalysisDocuments, setMonthlyAnalysisDocuments] = useState([]);
  const [activeMonthlyAnalysisDocumentId, setActiveMonthlyAnalysisDocumentId] = useState(null);
  const [analysisDocumentsBySection, setAnalysisDocumentsBySection] = useState({
    "monthly-analysis": [],
    "period-analysis": [],
    "year-analysis": [],
  });
  const [analysisActiveIdsBySection, setAnalysisActiveIdsBySection] = useState({
    "monthly-analysis": null,
    "period-analysis": null,
    "year-analysis": null,
  });
  const [monthlyAnalysisCreated, setMonthlyAnalysisCreated] = useState(false);
  const [monthlyAnalysisTitle, setMonthlyAnalysisTitle] = useState("");
  const [monthlyAnalysisTitleRich,setMonthlyAnalysisTitleRich]=useState("");
  const [monthlyAnalysisBody, setMonthlyAnalysisBody] = useState("");
  const [monthlyAnalysisExtraPages, setMonthlyAnalysisExtraPages] = useState([]);
  const [monthlyAnalysisAttachments, setMonthlyAnalysisAttachments] = useState([]);
  const monthlyAnalysisAttachmentUrlsRef = useRef([]);
  const monthlyAnalysisBodyTextareaRef = useRef(null);
  const monthlyAnalysisExtraTextareaRefs = useRef([]);
  const [monthlyAnalysisCommanderTitle, setMonthlyAnalysisCommanderTitle] = useState("");
  const [monthlyAnalysisCommanderRank, setMonthlyAnalysisCommanderRank] = useState("");
  const [monthlyAnalysisCommanderName, setMonthlyAnalysisCommanderName] = useState("");
  const [monthlyAnalysisCommanderSignature, setMonthlyAnalysisCommanderSignature] = useState("");
  const [isCommanderSignatureDialogOpen, setIsCommanderSignatureDialogOpen] = useState(false);
  const [isMonthlyDocumentOpen, setIsMonthlyDocumentOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isMonthlyAnalysisPickerOpen, setIsMonthlyAnalysisPickerOpen] = useState(false);
  const [selectedMonthlyAnalysisSourceDocumentIds, setSelectedMonthlyAnalysisSourceDocumentIds] = useState([]);
  const [draftMonthlyAnalysisTitle, setDraftMonthlyAnalysisTitle] = useState("");
  const [monthlyAnalysisRegistryNumber, setMonthlyAnalysisRegistryNumber] = useState(null);
  const [monthlyAnalysisAddressee, setMonthlyAnalysisAddressee] = useState(
    data?.defaultAddressee ||
      "КР Мамлекетик чек ара кызматынын күжүрмөн даярдоо башкармалыгынын башчысына"
  );
  const [monthlyAnalysisAddresseeRich,setMonthlyAnalysisAddresseeRich]=useState("");
  const [analysisSubmissions, setAnalysisSubmissions] = useState([]);

  const [analysisLoadState, setAnalysisLoadState] = useState("loading");
  const [analysisRetry, setAnalysisRetry] = useState(0);
  const [selectedAnalysisSubmission, setSelectedAnalysisSubmission] = useState(null);
  const [isAnalysisSendDialogOpen, setIsAnalysisSendDialogOpen] = useState(false);
  const [analysisSubmissionTitle, setAnalysisSubmissionTitle] = useState("");
  const [analysisSubmissionError, setAnalysisSubmissionError] = useState("");
  const [isSendingAnalysis, setIsSendingAnalysis] = useState(false);
  const [deletingAnalysisSubmissionId, setDeletingAnalysisSubmissionId] = useState(null);
  const [forwardingSubmission, setForwardingSubmission] = useState(null);
  const [monthlyStatusNow, setMonthlyStatusNow] = useState(() => Date.now());
  const isRegionalSubunitAnalysis =
    user?.role === "regional" && selectedAnalyticsScope === "subunits";
  const canEditAnalysis =
    user?.role !== "regional" || selectedAnalyticsScope === "regional-unit";
  const selectedSection = analyticsSections.find((section) => section.id === selectedSectionId);
  const isOwnedAnalysisDocument = (document) =>
    document?.ownerId
      ? String(document.ownerId) === String(user?.id)
      : user?.role !== "regional";
  const currentAnalysisSectionDocuments = selectedSectionId
    ? (analysisDocumentsBySection[selectedSectionId] || []).filter(isOwnedAnalysisDocument)
    : [];
  const currentAnalysisSubmissions = selectedSectionId
    ? analysisSubmissions.filter(
        (submission) =>
          submission.sectionId === (
            user?.role === "admin"
              ? "combat-training-analysis-regional"
              : "combat-training-analysis"
          ) &&
          (user?.role === "regional"
            ? submission.senderRole === "outpost"
            : user?.role === "admin"
              ? submission.senderRole === "regional"
              : true) &&
          submission.table?.sectionId === selectedSectionId
      )
    : [];
  const currentRegionalOutgoingSubmissions = selectedSectionId && user?.role === "regional"
    ? analysisSubmissions.filter(
        (submission) =>
          submission.senderRole === "regional" &&
          submission.table?.sectionId === selectedSectionId
      )
    : [];
  const displayedAnalysisSubmissions =
    user?.role === "regional" && selectedAnalyticsScope === "regional-unit"
      ? currentRegionalOutgoingSubmissions
      : currentAnalysisSubmissions;
  const regionalOutpostNames = Array.from(new Set([
    ...(OUTPOSTS_BY_MILITARY_UNIT[user?.region] || []).map(([, name]) =>
      formatOutpostName(name)
    ),
    ...currentAnalysisSubmissions.map((submission) =>
      formatOutpostName(submission.outpostName)
    ),
  ].filter(Boolean)));
  const selectedRegionalAnalysisSubmissions = selectedAdminOutpostName
    ? currentAnalysisSubmissions.filter(
        (submission) =>
          formatOutpostName(submission.outpostName) === selectedAdminOutpostName
      )
    : [];
  const currentAdminAnalysisSubmissions = selectedSectionId && user?.role === "admin"
    ? analysisSubmissions.filter(
        (submission) =>
          ["combat-training-analysis", "combat-training-analysis-regional"].includes(
            submission.sectionId
          ) && submission.table?.sectionId === selectedSectionId
      )
    : [];
  const adminUnitNumbers = Array.from(new Set([
    ...(data?.unitNumbers || []),
    ...currentAdminAnalysisSubmissions.map((submission) => submission.unitNumber),
  ].map((unitNumber) => String(unitNumber || "").trim()).filter(Boolean)));
  const selectedAdminAnalysisSubmissions = currentAdminAnalysisSubmissions.filter(
    (submission) => String(submission.unitNumber) === String(selectedAdminUnitNumber)
  );
  const adminMilitaryUnitSubmissions = selectedAdminAnalysisSubmissions.filter(
    (submission) => submission.senderRole === "regional"
  );
  const adminOutpostSubmissions = selectedAdminAnalysisSubmissions.filter(
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
    : [];
  const getRegionalOutpostAnalysisSubmission = (outpostName) =>
    getLatestAnalysisSubmission(
      currentAnalysisSubmissions.filter(
        (submission) =>
          formatOutpostName(submission.outpostName) === outpostName
      )
    );
  const getAdminOutpostAnalysisSubmission = (outpostName) =>
    getLatestAnalysisSubmission(
      adminOutpostSubmissions.filter(
        (submission) =>
          formatOutpostName(submission.outpostName) === outpostName
      )
    );
  const latestRegionalAnalysisSubmission = getLatestAnalysisSubmission(
    currentRegionalOutgoingSubmissions
  );
  const latestOwnMonthlySubmission = getLatestAnalysisSubmission(
    analysisSubmissions.filter(
      (submission) =>
        submission.table?.sectionId === MONTHLY_ANALYSIS_SECTION_ID &&
        String(submission.senderId) === String(user?.id)
    )
  );
  const latestOwnPeriodSubmission = getLatestAnalysisSubmission(
    analysisSubmissions.filter(
      (submission) =>
        submission.table?.sectionId === PERIOD_ANALYSIS_SECTION_ID &&
        String(submission.senderId) === String(user?.id)
    )
  );
  const latestOwnYearSubmission = getLatestAnalysisSubmission(
    analysisSubmissions.filter(
      (submission) =>
        submission.table?.sectionId === YEAR_ANALYSIS_SECTION_ID &&
        String(submission.senderId) === String(user?.id)
    )
  );
  const renderAnalysisReportingStatus = (
    submission,
    sectionId = selectedSectionId
  ) => {
    if (analysisLoadState === "loading") return <p role="status"><T>{"Загрузка отчётов..."}</T></p>;
    if (analysisLoadState === "error") return <div role="alert"><T>{"Не удалось загрузить отчёты. Статус не определён."}</T> <button type="button" onClick={() => setAnalysisRetry(v => v + 1)}><T>{"Повторить"}</T></button></div>;
    if (sectionId === MONTHLY_ANALYSIS_SECTION_ID) {
      return (
        <MonthlyAnalysisSubmissionStatus
          now={monthlyStatusNow}
          submission={submission}
        />
      );
    }

    if (sectionId === PERIOD_ANALYSIS_SECTION_ID) {
      return (
        <PeriodAnalysisSubmissionStatus
          now={monthlyStatusNow}
          submission={submission}
        />
      );
    }

    if (sectionId === YEAR_ANALYSIS_SECTION_ID) {
      return (
        <YearAnalysisSubmissionStatus
          now={monthlyStatusNow}
          submission={submission}
        />
      );
    }

    return null;
  };
  const analysisSourceSectionId =
    selectedSectionId === "year-analysis"
      ? "period-analysis"
      : selectedSectionId === "period-analysis"
        ? "monthly-analysis"
        : "monthly-analysis";
  const monthlyAnalysisPlaceholder =
    "2021 аскер болугунун кара-бак чек ара заставасынын декабрь айына талдоосу";
  const periodAnalysisPlaceholder =
    "2030 аскер бөлүгүнүн Көк-Таш чек ара заставасынын 1-окуу мезгилинин жыйынтыгы жана талдоосу";
  const yearAnalysisPlaceholder = "Окуу жылынын жыйынтыгы жана талдоосу";
  const monthlyAnalysisSourceDocuments = data?.submissionSourceSectionId
    ? analysisSubmissions
        .filter(
          (submission) =>
            submission.sectionId === data.submissionSourceSectionId &&
            submission.senderRole === "regional"
        )
        .map((submission) => ({
          ...(submission.table?.document || {}),
          id: `submission-${submission.id}`,
          sourceDocumentTitle: submission.documentTitle,
          sourceOutpostName: submission.unitNumber || submission.senderName,
        }))
    : user?.role === "regional" && selectedAnalyticsScope === "regional-unit"
      ? analysisSubmissions
          .filter(
            (submission) =>
              submission.sectionId === "combat-training-analysis" &&
              submission.table?.sectionId === selectedSectionId
          )
          .map((submission) => ({
            ...(submission.table?.document || {}),
            id: `submission-${submission.id}`,
            sourceDocumentTitle: submission.documentTitle,
            sourceOutpostName: submission.outpostName || submission.senderName,
          }))
      : (analysisDocumentsBySection[analysisSourceSectionId] || []).filter(isOwnedAnalysisDocument);
  const monthlyAnalysisSourcePlaceholder =
    analysisSourceSectionId === "period-analysis"
      ? periodAnalysisPlaceholder
      : monthlyAnalysisPlaceholder;
  const monthlyAnalysisPickerTitle = data?.submissionSourceSectionId
    ? "Аскер бөлүктөрү жөнөткөн талдоолорду тандоо"
    : user?.role === "regional" && selectedAnalyticsScope === "regional-unit"
      ? "Застава жөнөткөн талдоолордон тандоо"
      : selectedSectionId === "year-analysis"
      ? "Окуу мезгилеринин жыйынтыгы жана талдоосунан тандоо"
      : "Айдын талдоосунан тандоо";
  const monthlyAnalysisPickerEmptyText = data?.submissionSourceSectionId
    ? "Аскер бөлүктөрү жөнөткөн документтер азырынча жок"
    : user?.role === "regional" && selectedAnalyticsScope === "regional-unit"
      ? "Застава жөнөткөн документтер азырынча жок"
      : selectedSectionId === "year-analysis"
      ? "Окуу мезгилеринин жыйынтыгында документ жок"
      : "Айдын талдоосунда документ жок";
  const currentAnalysisPlaceholder =
    selectedSectionId === "period-analysis"
      ? periodAnalysisPlaceholder
      : selectedSectionId === "year-analysis"
        ? yearAnalysisPlaceholder
        : monthlyAnalysisPlaceholder;
  const currentDate = new Date();
  const currentDay = String(currentDate.getDate()).padStart(2, "0");
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, "0");
  const currentYear = currentDate.getFullYear();
  const formattedDocumentDate = `"${currentDay}"${currentMonth}"${currentYear}-ж`;
  const formattedRegistryNumber = `${currentMonth}/${monthlyAnalysisRegistryNumber || "__"}`;
  const formattedRegistrationCode = selectedAnalysisSubmission
    ? getDocumentRegistrationCode(selectedAnalysisSubmission)
    : `${formattedDocumentDate} ${formattedRegistryNumber}`;
  const isMonthlyAnalysisSent = Boolean(monthlyAnalysisRegistryNumber || data?.archiveReadOnly);
  const activeMonthlyAnalysisDocument = monthlyAnalysisDocuments.find(
    (document) => document.id === activeMonthlyAnalysisDocumentId
  );

  useEffect(() => {
    if (!["outpost", "regional", "admin"].includes(user?.role)) {
      setAnalysisSubmissions([]);
      return undefined;
    }

    let isActive = true;
    setAnalysisLoadState("loading");
    getThematicAccountSubmissions(undefined, [
      "combat-training-analysis",
      "combat-training-analysis-regional",
      data?.submissionSectionId,
      data?.submissionSourceSectionId,
    ])
      .then((items) => {
        if (isActive) {
          setAnalysisLoadState("ready");
          setAnalysisSubmissions(
            (Array.isArray(items) ? items : []).filter((item) =>
              [
                "combat-training-analysis",
                "combat-training-analysis-regional",
                data?.submissionSectionId,
                data?.submissionSourceSectionId,
              ].includes(item.sectionId)
            )
          );
        }
      })
      .catch(() => {
        if (isActive) setAnalysisLoadState("error");
      });

    return () => {
      isActive = false;
    };
  }, [
    data?.submissionSectionId,
    data?.submissionSourceSectionId,
    analysisRetry,
    user?.id,
    user?.role,
  ]);

  const createMonthlyAnalysisDocumentId = () =>
    `monthly-analysis-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const createMonthlyAnalysisAttachmentId = () =>
    `monthly-analysis-attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const sanitizeMonthlyAnalysisAttachments = (attachments) =>
    (Array.isArray(attachments) ? attachments : []).map(({ objectUrl, ...attachment }) => attachment);

  const syncMonthlyAnalysisTextareaHeight = (element) => {
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  };

  const applyMonthlyAnalysisSourceDocumentToCurrentDocument = (sourceDocument) => {
    if (!sourceDocument) return;

    const nextAttachments = Array.isArray(sourceDocument.attachments) ? sourceDocument.attachments : [];
    const nextExtraPages = Array.isArray(sourceDocument.extraPages) ? sourceDocument.extraPages : [];

    setMonthlyAnalysisAddressee(sourceDocument.addressee || "");
    setMonthlyAnalysisAddresseeRich(sourceDocument.addresseeRich||"");
    setMonthlyAnalysisTitle(sourceDocument.title || "");
    setMonthlyAnalysisTitleRich(sourceDocument.titleRich||"");
    setMonthlyAnalysisBody(sourceDocument.body || "");
    setMonthlyAnalysisAttachments(nextAttachments);
    setMonthlyAnalysisExtraPages(nextExtraPages);
    setMonthlyAnalysisCommanderTitle(sourceDocument.commanderTitle || "");
    setMonthlyAnalysisCommanderRank(sourceDocument.commanderRank || "");
    setMonthlyAnalysisCommanderName(sourceDocument.commanderName || "");
    setMonthlyAnalysisCommanderSignature(sourceDocument.commanderSignature || "");

    updateActiveMonthlyAnalysisDocument({
      addressee: sourceDocument.addressee || "",
      addresseeRich: sourceDocument.addresseeRich || "",
      attachments: sanitizeMonthlyAnalysisAttachments(nextAttachments),
      body: sourceDocument.body || "",
      commanderName: sourceDocument.commanderName || "",
      commanderRank: sourceDocument.commanderRank || "",
      commanderSignature: sourceDocument.commanderSignature || "",
      commanderTitle: sourceDocument.commanderTitle || "",
      extraPages: nextExtraPages,
      title: sourceDocument.title || "",
      titleRich: sourceDocument.titleRich || "",
    });

    persistMonthlyAnalysisDraft({
      addressee: sourceDocument.addressee || "",
      addresseeRich: sourceDocument.addresseeRich || "",
      attachments: sanitizeMonthlyAnalysisAttachments(nextAttachments),
      body: sourceDocument.body || "",
      commanderName: sourceDocument.commanderName || "",
      commanderRank: sourceDocument.commanderRank || "",
      commanderSignature: sourceDocument.commanderSignature || "",
      commanderTitle: sourceDocument.commanderTitle || "",
      draftTitle: sourceDocument.title || "",
      extraPages: nextExtraPages,
      title: sourceDocument.title || "",
      titleRich: sourceDocument.titleRich || "",
    });
  };

  const handleToggleMonthlyAnalysisSourceDocument = (documentId) => {
    setSelectedMonthlyAnalysisSourceDocumentIds((currentIds) =>
      currentIds.includes(documentId)
        ? currentIds.filter((currentId) => currentId !== documentId)
        : [...currentIds, documentId]
    );
  };

  const composeMonthlyAnalysisDocumentsText = (documents) =>
    documents
      .map((document, index) => {
        const parts = [];
        if (document.title) parts.push(document.title);
        if (document.body) parts.push(document.body);
        return parts.filter(Boolean).join("\n\n").trim();
      })
      .filter(Boolean)
      .join("\n\n");

  const applyMonthlyAnalysisDocumentToState = (document) => {
    if (!document) return;

    setMonthlyAnalysisCreated(Boolean(document.created));
    setMonthlyAnalysisTitle(document.title || "");
    setMonthlyAnalysisTitleRich(document.titleRich||"");
    setMonthlyAnalysisBody(document.body || "");
    setMonthlyAnalysisExtraPages(Array.isArray(document.extraPages) ? document.extraPages : []);
    setMonthlyAnalysisAttachments(Array.isArray(document.attachments) ? document.attachments : []);
    monthlyAnalysisAttachmentUrlsRef.current = [];
    setMonthlyAnalysisCommanderTitle(document.commanderTitle || "");
    setMonthlyAnalysisCommanderRank(document.commanderRank || "");
    setMonthlyAnalysisCommanderName(document.commanderName || "");
    setMonthlyAnalysisCommanderSignature(document.commanderSignature || "");
    setMonthlyAnalysisAddressee(document.addressee || "");
    setMonthlyAnalysisAddresseeRich(document.addresseeRich||"");
    setMonthlyAnalysisRegistryNumber(
      typeof document.registryNumber === "number" && Number.isFinite(document.registryNumber)
        ? document.registryNumber
        : null
    );
  };

  const updateActiveMonthlyAnalysisDocument = (partialDocument) => {
    const activeDocumentId = activeMonthlyAnalysisDocumentIdRef.current;
    if (!activeDocumentId) return;

    setMonthlyAnalysisDocuments((currentDocuments) => {
      const nextDocuments = currentDocuments.map((document) =>
        document.id === activeDocumentId
          ? { ...document, ...partialDocument, updatedAt: Date.now() }
          : document
      );

      monthlyAnalysisDocumentsRef.current = nextDocuments;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          getAnalyticsStorageKey(MONTHLY_ANALYSIS_DOCUMENTS_STORAGE_KEY),
          JSON.stringify(nextDocuments)
        );
      }

      return nextDocuments;
    });
  };

  const persistMonthlyAnalysisDraft = (nextPartialState = {}) => {
    if (typeof window === "undefined") return;

    const draftPayload = {
      addressee: monthlyAnalysisAddressee,
      addresseeRich: monthlyAnalysisAddresseeRich,
      body: monthlyAnalysisBody,
      commanderName: monthlyAnalysisCommanderName,
      commanderRank: monthlyAnalysisCommanderRank,
      commanderSignature: monthlyAnalysisCommanderSignature,
      commanderTitle: monthlyAnalysisCommanderTitle,
      created: monthlyAnalysisCreated,
      draftTitle: draftMonthlyAnalysisTitle,
      attachments: monthlyAnalysisAttachments,
      extraPages: monthlyAnalysisExtraPages,
      isCreateDialogOpen,
      isMonthlyDocumentOpen,
      registryNumber: monthlyAnalysisRegistryNumber,
      selectedSectionId,
      title: monthlyAnalysisTitle,
      titleRich: monthlyAnalysisTitleRich,
      ...nextPartialState,
    };

    window.localStorage.setItem(
      getAnalyticsDraftStorageKey(selectedSectionId),
      JSON.stringify(draftPayload)
    );
  };

  useEffect(() => {
    try {
      const storedDocumentsBySectionValue = window.localStorage.getItem(
        getAnalyticsStorageKey(ANALYSIS_DOCUMENTS_BY_SECTION_KEY)
      );
      if (storedDocumentsBySectionValue) {
        const parsedDocumentsBySectionValue = JSON.parse(storedDocumentsBySectionValue);
        if (parsedDocumentsBySectionValue && typeof parsedDocumentsBySectionValue === "object") {
          analysisDocumentsBySectionRef.current = parsedDocumentsBySectionValue;
          setAnalysisDocumentsBySection(parsedDocumentsBySectionValue);
        }
      }

      const storedActiveIdsBySectionValue = window.localStorage.getItem(
        getAnalyticsStorageKey(ANALYSIS_ACTIVE_IDS_BY_SECTION_KEY)
      );
      if (storedActiveIdsBySectionValue) {
        const parsedActiveIdsBySectionValue = JSON.parse(storedActiveIdsBySectionValue);
        if (parsedActiveIdsBySectionValue && typeof parsedActiveIdsBySectionValue === "object") {
          analysisActiveIdsBySectionRef.current = parsedActiveIdsBySectionValue;
          setAnalysisActiveIdsBySection(parsedActiveIdsBySectionValue);
        }
      }

      const storedDocumentsValue = window.localStorage.getItem(
        getAnalyticsStorageKey(MONTHLY_ANALYSIS_DOCUMENTS_STORAGE_KEY)
      );
      if (storedDocumentsValue) {
        const parsedDocumentsValue = JSON.parse(storedDocumentsValue);
        if (Array.isArray(parsedDocumentsValue)) {
          setMonthlyAnalysisDocuments(parsedDocumentsValue);
          monthlyAnalysisDocumentsRef.current = parsedDocumentsValue;
          analysisDocumentsBySectionRef.current = {
            ...(analysisDocumentsBySectionRef.current || {}),
            "monthly-analysis": parsedDocumentsValue,
          };
          setAnalysisDocumentsBySection(analysisDocumentsBySectionRef.current);
        }
      }

      const storedActiveDocumentId = window.localStorage.getItem(
        getAnalyticsStorageKey(MONTHLY_ANALYSIS_ACTIVE_DOCUMENT_ID_KEY)
      );
      if (storedActiveDocumentId) {
        setActiveMonthlyAnalysisDocumentId(storedActiveDocumentId);
        activeMonthlyAnalysisDocumentIdRef.current = storedActiveDocumentId;
        analysisActiveIdsBySectionRef.current = {
          ...(analysisActiveIdsBySectionRef.current || {}),
          "monthly-analysis": storedActiveDocumentId,
        };
        setAnalysisActiveIdsBySection((currentValue) => ({
          ...currentValue,
          "monthly-analysis": storedActiveDocumentId,
        }));
      }

      const storedValue = window.localStorage.getItem(
        getAnalyticsStorageKey(MONTHLY_ANALYSIS_DRAFT_STORAGE_KEY)
      );
      if (!storedValue) {
        hasHydratedMonthlyAnalysisRef.current = true;
        return;
      }

      const parsedValue = JSON.parse(storedValue);
      if (parsedValue && typeof parsedValue === "object") {
        if (typeof parsedValue.selectedSectionId === "string" || parsedValue.selectedSectionId === null) {
          setSelectedSectionId(parsedValue.selectedSectionId);
        }
        if (typeof parsedValue.created === "boolean") setMonthlyAnalysisCreated(parsedValue.created);
        if (typeof parsedValue.title === "string") {setMonthlyAnalysisTitle(parsedValue.title);setMonthlyAnalysisTitleRich(parsedValue.titleRich||"");}
        if (typeof parsedValue.draftTitle === "string") setDraftMonthlyAnalysisTitle(parsedValue.draftTitle);
        if (typeof parsedValue.body === "string") setMonthlyAnalysisBody(parsedValue.body);
        if (Array.isArray(parsedValue.extraPages)) setMonthlyAnalysisExtraPages(parsedValue.extraPages);
        if (Array.isArray(parsedValue.attachments)) setMonthlyAnalysisAttachments(parsedValue.attachments);
        if (typeof parsedValue.commanderTitle === "string") {
          setMonthlyAnalysisCommanderTitle(parsedValue.commanderTitle);
        }
        if (typeof parsedValue.commanderRank === "string") {
          setMonthlyAnalysisCommanderRank(parsedValue.commanderRank);
        }
        if (typeof parsedValue.commanderName === "string") {
          setMonthlyAnalysisCommanderName(parsedValue.commanderName);
        }
        if (typeof parsedValue.commanderSignature === "string") {
          setMonthlyAnalysisCommanderSignature(parsedValue.commanderSignature);
        }
        if (typeof parsedValue.addressee === "string") {
          setMonthlyAnalysisAddressee(parsedValue.addressee);setMonthlyAnalysisAddresseeRich(parsedValue.addresseeRich||"");
        }
        setIsMonthlyDocumentOpen(false);
        setIsCreateDialogOpen(false);
        if (typeof parsedValue.registryNumber === "number" && Number.isFinite(parsedValue.registryNumber)) {
          setMonthlyAnalysisRegistryNumber(parsedValue.registryNumber);
        }
      }
    } catch {
      // Ignore invalid stored data and continue with defaults.
    } finally {
      hasHydratedMonthlyAnalysisRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!data?.directEditor || !data?.directDocumentId) return;

    const sectionId = data.initialSectionId || MONTHLY_ANALYSIS_SECTION_ID;
    const storedSectionDocuments =
      analysisDocumentsBySectionRef.current[sectionId] || [];
    const storedDocument = storedSectionDocuments.find(
      (document) => document.id === data.directDocumentId
    );
    const directDocument = {
      addressee:
        data?.defaultAddressee ||
        "КР Мамлекетик чек ара кызматынын күжүрмөн даярдоо башкармалыгынын башчысына",
      attachments: [],
      body: "",
      commanderName: "",
      commanderRank: "",
      commanderSignature: "",
      commanderTitle: "",
      created: true,
      extraPages: [],
      isMonthlyDocumentOpen: true,
      registryNumber: null,
      ownerId: user?.id || null,
      sectionId,
      updatedAt: Date.now(),
      ...storedDocument,
      id: data.directDocumentId,
      title: data.directDocumentTitle || storedDocument?.title || "",
    };
    const nextDocuments = [
      directDocument,
      ...storedSectionDocuments.filter(
        (document) => document.id !== data.directDocumentId
      ),
    ];
    const nextDocumentsBySection = {
      ...analysisDocumentsBySectionRef.current,
      [sectionId]: nextDocuments,
    };
    const nextActiveIdsBySection = {
      ...analysisActiveIdsBySectionRef.current,
      [sectionId]: data.directDocumentId,
    };

    monthlyAnalysisDocumentsRef.current = nextDocuments;
    activeMonthlyAnalysisDocumentIdRef.current = data.directDocumentId;
    analysisDocumentsBySectionRef.current = nextDocumentsBySection;
    analysisActiveIdsBySectionRef.current = nextActiveIdsBySection;
    setMonthlyAnalysisDocuments(nextDocuments);
    setActiveMonthlyAnalysisDocumentId(data.directDocumentId);
    setAnalysisDocumentsBySection(nextDocumentsBySection);
    setAnalysisActiveIdsBySection(nextActiveIdsBySection);
    setSelectedAnalyticsScope("regional-unit");
    setSelectedSectionId(sectionId);
    setMonthlyAnalysisCreated(true);
    setIsCreateDialogOpen(false);
    setIsMonthlyDocumentOpen(true);
    applyMonthlyAnalysisDocumentToState(directDocument);
  }, [
    data?.directDocumentId,
    data?.directDocumentTitle,
    data?.directEditor,
    data?.defaultAddressee,
    data?.initialSectionId,
    user?.id,
  ]);

  useEffect(() => {
    const submission = data?.directSubmission;
    if (!data?.directEditor || !submission) return;

    const document = submission.table?.document || {};
    const sectionId =
      submission.table?.sectionId || data.initialSectionId || MONTHLY_ANALYSIS_SECTION_ID;
    setSelectedAnalyticsScope("regional-unit");
    setSelectedSectionId(sectionId);
    setSelectedAnalysisSubmission(submission);
    setMonthlyAnalysisCreated(true);
    setIsCreateDialogOpen(false);
    setIsMonthlyDocumentOpen(true);
    setActiveMonthlyAnalysisDocumentId(null);
    applyMonthlyAnalysisDocumentToState({
      ...document,
      id: `submission-${submission.id}`,
      registryNumber: submission.registrationNumber || submission.id,
      sectionId,
      title: document.title || submission.documentTitle || "",
    });
  }, [data?.directEditor, data?.directSubmission, data?.initialSectionId]);

  useEffect(() => {
    if (!selectedSectionId || !analyticsSections.some((section) => section.id === selectedSectionId)) return;

    if (analysisDocumentsBySection !== analysisDocumentsBySectionRef.current) return;
    const nextDocuments = analysisDocumentsBySection[selectedSectionId] || [];
    const nextActiveDocumentId = analysisActiveIdsBySection[selectedSectionId] || null;

    setMonthlyAnalysisDocuments(nextDocuments);
    monthlyAnalysisDocumentsRef.current = nextDocuments;
    setActiveMonthlyAnalysisDocumentId(nextActiveDocumentId);
    activeMonthlyAnalysisDocumentIdRef.current = nextActiveDocumentId;
  }, [selectedSectionId, analysisDocumentsBySection, analysisActiveIdsBySection]);

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setMonthlyStatusNow(Date.now()),
      1000
    );
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!hasHydratedMonthlyAnalysisRef.current) return;
    if (!selectedSectionId || !analyticsSections.some((section) => section.id === selectedSectionId)) return;

    try {
      const storedValue = window.localStorage.getItem(
        getAnalyticsDraftStorageKey(selectedSectionId)
      );
      if (!storedValue) return;

      const parsedValue = JSON.parse(storedValue);
      if (!parsedValue || typeof parsedValue !== "object") return;

      if (typeof parsedValue.created === "boolean") setMonthlyAnalysisCreated(parsedValue.created);
      if (typeof parsedValue.title === "string") {setMonthlyAnalysisTitle(parsedValue.title);setMonthlyAnalysisTitleRich(parsedValue.titleRich||"");}
      if (typeof parsedValue.draftTitle === "string") setDraftMonthlyAnalysisTitle(parsedValue.draftTitle);
      if (typeof parsedValue.body === "string") setMonthlyAnalysisBody(parsedValue.body);
      if (Array.isArray(parsedValue.extraPages)) setMonthlyAnalysisExtraPages(parsedValue.extraPages);
      if (Array.isArray(parsedValue.attachments)) setMonthlyAnalysisAttachments(parsedValue.attachments);
      if (typeof parsedValue.commanderTitle === "string") {
        setMonthlyAnalysisCommanderTitle(parsedValue.commanderTitle);
      }
      if (typeof parsedValue.commanderRank === "string") {
        setMonthlyAnalysisCommanderRank(parsedValue.commanderRank);
      }
      if (typeof parsedValue.commanderName === "string") {
        setMonthlyAnalysisCommanderName(parsedValue.commanderName);
      }
      if (typeof parsedValue.commanderSignature === "string") {
        setMonthlyAnalysisCommanderSignature(parsedValue.commanderSignature);
      }
      if (typeof parsedValue.addressee === "string") {
        setMonthlyAnalysisAddressee(parsedValue.addressee);setMonthlyAnalysisAddresseeRich(parsedValue.addresseeRich||"");
      }
      if (typeof parsedValue.registryNumber === "number" && Number.isFinite(parsedValue.registryNumber)) {
        setMonthlyAnalysisRegistryNumber(parsedValue.registryNumber);
      }
      if (data?.directEditor) {
        setIsMonthlyDocumentOpen(true);
      } else if (typeof parsedValue.isMonthlyDocumentOpen === "boolean") {
        setIsMonthlyDocumentOpen(parsedValue.isMonthlyDocumentOpen);
      }
      if (typeof parsedValue.isCreateDialogOpen === "boolean") {
        setIsCreateDialogOpen(parsedValue.isCreateDialogOpen);
      }
    } catch {
      // Ignore invalid section draft data.
    }
  }, [data?.directEditor, selectedSectionId]);

  useEffect(() => {
    if (!hasHydratedMonthlyAnalysisRef.current) return;
    if (activeMonthlyAnalysisDocument) {
      applyMonthlyAnalysisDocumentToState(activeMonthlyAnalysisDocument);
    }
  }, [activeMonthlyAnalysisDocument]);

  useEffect(() => {
    syncMonthlyAnalysisTextareaHeight(monthlyAnalysisBodyTextareaRef.current);
  }, [monthlyAnalysisBody]);

  useEffect(() => {
    monthlyAnalysisExtraTextareaRefs.current.forEach((textarea) => {
      syncMonthlyAnalysisTextareaHeight(textarea);
    });
  }, [monthlyAnalysisExtraPages]);

  useEffect(() => {
    return () => {
      monthlyAnalysisAttachmentUrlsRef.current.forEach((attachmentUrl) => {
        try {
          URL.revokeObjectURL(attachmentUrl);
        } catch {
          // ignore cleanup failures
        }
      });
      monthlyAnalysisAttachmentUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedMonthlyAnalysisRef.current) return;
    if (analysisDocumentsBySection !== analysisDocumentsBySectionRef.current) return;
    persistMonthlyAnalysisDraft();
    window.localStorage.setItem(
      getAnalyticsStorageKey(MONTHLY_ANALYSIS_DOCUMENTS_STORAGE_KEY),
      JSON.stringify(monthlyAnalysisDocumentsRef.current)
    );
    if (activeMonthlyAnalysisDocumentIdRef.current) {
      window.localStorage.setItem(
        getAnalyticsStorageKey(MONTHLY_ANALYSIS_ACTIVE_DOCUMENT_ID_KEY),
        activeMonthlyAnalysisDocumentIdRef.current
      );
    } else {
      window.localStorage.removeItem(
        getAnalyticsStorageKey(MONTHLY_ANALYSIS_ACTIVE_DOCUMENT_ID_KEY)
      );
    }

    if (selectedSectionId && analyticsSections.some((section) => section.id === selectedSectionId)) {
      const nextDocumentsBySection = {
        ...analysisDocumentsBySectionRef.current,
        [selectedSectionId]: monthlyAnalysisDocumentsRef.current,
      };
      const nextActiveIdsBySection = {
        ...analysisActiveIdsBySectionRef.current,
        [selectedSectionId]: activeMonthlyAnalysisDocumentIdRef.current,
      };

      analysisDocumentsBySectionRef.current = nextDocumentsBySection;
      analysisActiveIdsBySectionRef.current = nextActiveIdsBySection;
      setAnalysisDocumentsBySection(nextDocumentsBySection);
      setAnalysisActiveIdsBySection(nextActiveIdsBySection);

      window.localStorage.setItem(
        getAnalyticsStorageKey(ANALYSIS_DOCUMENTS_BY_SECTION_KEY),
        JSON.stringify(nextDocumentsBySection)
      );
      window.localStorage.setItem(
        getAnalyticsStorageKey(ANALYSIS_ACTIVE_IDS_BY_SECTION_KEY),
        JSON.stringify(nextActiveIdsBySection)
      );
    }
  }, [
    monthlyAnalysisAddressee,
    monthlyAnalysisAddresseeRich,
    monthlyAnalysisBody,
    monthlyAnalysisCommanderName,
    monthlyAnalysisCommanderRank,
    monthlyAnalysisCommanderSignature,
    monthlyAnalysisCommanderTitle,
    monthlyAnalysisCreated,
    draftMonthlyAnalysisTitle,
    monthlyAnalysisAttachments,
    monthlyAnalysisExtraPages,
    isCreateDialogOpen,
    isMonthlyDocumentOpen,
    monthlyAnalysisRegistryNumber,
    monthlyAnalysisTitle,
    monthlyAnalysisTitleRich,
  ]);

  const handleCreateMonthlyAnalysis = () => {
    setDraftMonthlyAnalysisTitle("");
    setIsMonthlyAnalysisPickerOpen(false);
    persistMonthlyAnalysisDraft({
      draftTitle: "",
      isCreateDialogOpen: true,
    });
    setIsCreateDialogOpen(true);
  };

  const handleSelectAnalyticsSection = (sectionId) => {
    setSelectedSectionId(sectionId);
    setSelectedAdminUnitNumber(null);
    setSelectedAdminOutpostName(null);
    setIsMonthlyDocumentOpen(false);
    setIsCreateDialogOpen(false);
    setIsMonthlyAnalysisPickerOpen(false);
    persistMonthlyAnalysisDraft({
      isCreateDialogOpen: false,
      isMonthlyDocumentOpen: false,
      selectedSectionId: sectionId,
    });
  };

  const openMonthlyAnalysisDocument = (documentId) => {
    const document = currentAnalysisSectionDocuments.find((currentDocument) => currentDocument.id === documentId);
    if (!document) return;

    setActiveMonthlyAnalysisDocumentId(documentId);
    activeMonthlyAnalysisDocumentIdRef.current = documentId;
    setSelectedSectionId(selectedSectionId || document.sectionId || "monthly-analysis");
    setIsMonthlyDocumentOpen(true);
    setIsCreateDialogOpen(false);
    setIsMonthlyAnalysisPickerOpen(false);
    applyMonthlyAnalysisDocumentToState(document);
    persistMonthlyAnalysisDraft({
      activeDocumentId: documentId,
      attachments: Array.isArray(document.attachments) ? document.attachments : [],
      addressee: document.addressee || "",
      body: document.body || "",
      commanderName: document.commanderName || "",
      commanderRank: document.commanderRank || "",
      commanderSignature: document.commanderSignature || "",
      commanderTitle: document.commanderTitle || "",
      created: Boolean(document.created),
      extraPages: Array.isArray(document.extraPages) ? document.extraPages : [],
      isMonthlyDocumentOpen: true,
      registryNumber:
        typeof document.registryNumber === "number" && Number.isFinite(document.registryNumber)
          ? document.registryNumber
          : null,
      title: document.title || "",
    });

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        getAnalyticsStorageKey(MONTHLY_ANALYSIS_ACTIVE_DOCUMENT_ID_KEY),
        documentId
      );
    }
  };

  const handleDeleteMonthlyAnalysisDocument = (documentId) => {
    const currentDocuments = monthlyAnalysisDocumentsRef.current;
      const documentToDelete = currentDocuments.find((currentDocument) => currentDocument.id === documentId);
      if (!documentToDelete || documentToDelete.registryNumber) return;

      const nextDocuments = currentDocuments.filter((currentDocument) => currentDocument.id !== documentId);
      monthlyAnalysisDocumentsRef.current = nextDocuments;

      const sectionKey = selectedSectionId || "monthly-analysis";
      const nextDocumentsBySection = {
        ...analysisDocumentsBySectionRef.current,
        [sectionKey]: nextDocuments,
      };
      const nextActiveIdsBySection = {
        ...analysisActiveIdsBySectionRef.current,
        [sectionKey]:
          activeMonthlyAnalysisDocumentId === documentId && nextDocuments.length > 0
            ? nextDocuments[nextDocuments.length - 1].id
            : activeMonthlyAnalysisDocumentId === documentId
              ? null
              : analysisActiveIdsBySectionRef.current[sectionKey] || null,
      };

      analysisDocumentsBySectionRef.current = nextDocumentsBySection;
      analysisActiveIdsBySectionRef.current = nextActiveIdsBySection;
      setAnalysisDocumentsBySection(nextDocumentsBySection);
      setAnalysisActiveIdsBySection(nextActiveIdsBySection);

      if (activeMonthlyAnalysisDocumentId === documentId) {
        const nextActiveDocument = nextDocuments[nextDocuments.length - 1] || null;
        setActiveMonthlyAnalysisDocumentId(nextActiveDocument ? nextActiveDocument.id : null);
        activeMonthlyAnalysisDocumentIdRef.current = nextActiveDocument ? nextActiveDocument.id : null;

        if (nextActiveDocument) {
          applyMonthlyAnalysisDocumentToState(nextActiveDocument);
        } else {
          setMonthlyAnalysisCreated(false);
          setMonthlyAnalysisTitle("");setMonthlyAnalysisTitleRich("");
          setMonthlyAnalysisBody("");
          setMonthlyAnalysisExtraPages([]);
          setMonthlyAnalysisAttachments([]);
          setMonthlyAnalysisCommanderTitle("");
          setMonthlyAnalysisCommanderRank("");
          setMonthlyAnalysisCommanderName("");
          setMonthlyAnalysisCommanderSignature("");
          setMonthlyAnalysisRegistryNumber(null);
          setIsMonthlyDocumentOpen(false);
        }
      }

      persistMonthlyAnalysisDraft({
        activeDocumentId:
          activeMonthlyAnalysisDocumentId === documentId && nextDocuments.length > 0
            ? nextDocuments[nextDocuments.length - 1].id
            : null,
        isMonthlyDocumentOpen: false,
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          getAnalyticsStorageKey(MONTHLY_ANALYSIS_DOCUMENTS_STORAGE_KEY),
          JSON.stringify(nextDocuments)
        );
        window.localStorage.setItem(
          getAnalyticsStorageKey(ANALYSIS_DOCUMENTS_BY_SECTION_KEY),
          JSON.stringify(nextDocumentsBySection)
        );
        window.localStorage.setItem(
          getAnalyticsStorageKey(ANALYSIS_ACTIVE_IDS_BY_SECTION_KEY),
          JSON.stringify(nextActiveIdsBySection)
        );
      }

      setMonthlyAnalysisDocuments(nextDocuments);
  };

  const handleSaveMonthlyAnalysis = () => {
    const newDocumentId = createMonthlyAnalysisDocumentId();
    const newDocument = {
      id: newDocumentId,
      addressee: "КР Мамлекетик чек ара кызматынын күжүрмөн даярдоо башкармалыгынын башчысына",
      attachments: [],
      body: "",
      commanderName: "",
      commanderRank: "",
      commanderSignature: "",
      commanderTitle: "",
      created: true,
      extraPages: [],
      isMonthlyDocumentOpen: false,
      registryNumber: null,
      ownerId: user?.id || null,
      sectionId: selectedSectionId || "monthly-analysis",
      title: draftMonthlyAnalysisTitle,
      updatedAt: Date.now(),
    };

    const nextDocuments = [...monthlyAnalysisDocumentsRef.current, newDocument];
    monthlyAnalysisDocumentsRef.current = nextDocuments;
    setMonthlyAnalysisDocuments(nextDocuments);

    const sectionKey = selectedSectionId || "monthly-analysis";
    const nextDocumentsBySection = {
      ...analysisDocumentsBySectionRef.current,
      [sectionKey]: nextDocuments,
    };
    const nextActiveIdsBySection = {
      ...analysisActiveIdsBySectionRef.current,
      [sectionKey]: newDocumentId,
    };
    analysisDocumentsBySectionRef.current = nextDocumentsBySection;
    analysisActiveIdsBySectionRef.current = nextActiveIdsBySection;
    setAnalysisDocumentsBySection(nextDocumentsBySection);
    setAnalysisActiveIdsBySection(nextActiveIdsBySection);

    setActiveMonthlyAnalysisDocumentId(newDocumentId);
    activeMonthlyAnalysisDocumentIdRef.current = newDocumentId;
    applyMonthlyAnalysisDocumentToState(newDocument);
    setMonthlyAnalysisCreated(true);
    setIsMonthlyDocumentOpen(true);
    setIsCreateDialogOpen(false);
    setSelectedSectionId(selectedSectionId || "monthly-analysis");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        getAnalyticsStorageKey(MONTHLY_ANALYSIS_DOCUMENTS_STORAGE_KEY),
        JSON.stringify(nextDocuments.length ? nextDocuments : [...monthlyAnalysisDocumentsRef.current, newDocument])
      );
      window.localStorage.setItem(
        getAnalyticsStorageKey(MONTHLY_ANALYSIS_ACTIVE_DOCUMENT_ID_KEY),
        newDocumentId
      );
      window.localStorage.setItem(
        getAnalyticsStorageKey(ANALYSIS_DOCUMENTS_BY_SECTION_KEY),
        JSON.stringify(nextDocumentsBySection)
      );
      window.localStorage.setItem(
        getAnalyticsStorageKey(ANALYSIS_ACTIVE_IDS_BY_SECTION_KEY),
        JSON.stringify(nextActiveIdsBySection)
      );
    }
    persistMonthlyAnalysisDraft({
      created: true,
      draftTitle: draftMonthlyAnalysisTitle,
      isCreateDialogOpen: false,
      isMonthlyDocumentOpen: true,
      activeDocumentId: newDocumentId,
      title: draftMonthlyAnalysisTitle,
    });
  
    notifySave();
};

  const handleStartSectionEdit = (section) => {
    setEditingSectionId(section.id);
    setEditingSectionTitle(section.title);
  };

  const handleSaveSectionTitle = (event) => {
    event.preventDefault();
    const nextTitle = editingSectionTitle.trim();
    if (!editingSectionId || !nextTitle) return;

    const nextSections = analyticsSections.map((section) =>
      section.id === editingSectionId ? { ...section, title: nextTitle } : section
    );
    setAnalyticsSections(nextSections);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          ANALYTICS_SECTIONS_STORAGE_KEY,
          JSON.stringify(
            nextSections.reduce(
              (titles, section) => ({ ...titles, [section.id]: section.title }),
              {}
            )
          )
        );
      } catch {
 notifySave(false); return;

        // The changed title remains available for the current session.
      }
    }

    setEditingSectionId(null);
    setEditingSectionTitle("");
  
    notifySave();
};

  const handleSaveCurrentMonthlyAnalysisDocument = () => {
    if (!activeMonthlyAnalysisDocumentIdRef.current) return;

    updateActiveMonthlyAnalysisDocument({
      addressee: monthlyAnalysisAddressee,
      addresseeRich: monthlyAnalysisAddresseeRich,
      attachments: sanitizeMonthlyAnalysisAttachments(monthlyAnalysisAttachments),
      body: monthlyAnalysisBody,
      commanderName: monthlyAnalysisCommanderName,
      commanderRank: monthlyAnalysisCommanderRank,
      commanderSignature: monthlyAnalysisCommanderSignature,
      commanderTitle: monthlyAnalysisCommanderTitle,
      extraPages: monthlyAnalysisExtraPages,
      title: monthlyAnalysisTitle,
      titleRich: monthlyAnalysisTitleRich,
    });
    persistMonthlyAnalysisDraft({
      addressee: monthlyAnalysisAddressee,
      addresseeRich: monthlyAnalysisAddresseeRich,
      attachments: sanitizeMonthlyAnalysisAttachments(monthlyAnalysisAttachments),
      body: monthlyAnalysisBody,
      commanderName: monthlyAnalysisCommanderName,
      commanderRank: monthlyAnalysisCommanderRank,
      commanderSignature: monthlyAnalysisCommanderSignature,
      commanderTitle: monthlyAnalysisCommanderTitle,
      draftTitle: monthlyAnalysisTitle,
      extraPages: monthlyAnalysisExtraPages,
      title: monthlyAnalysisTitle,
      titleRich: monthlyAnalysisTitleRich,
    });
  };

  const handleSendMonthlyAnalysis = () => {
    const canSend =
      user?.role === "outpost" ||
      (user?.role === "regional" && selectedAnalyticsScope === "regional-unit");
    if (isMonthlyAnalysisSent || !canSend) return;
    setAnalysisSubmissionTitle("");
    setAnalysisSubmissionError("");
    setIsAnalysisSendDialogOpen(true);
  };

  const handleConfirmSendMonthlyAnalysis = async () => {
    const documentTitle = analysisSubmissionTitle.trim();
    if (!documentTitle) {
      setAnalysisSubmissionError("Иш кагаздардын аталышын жазыңыз.");
      return;
    }

    if (!(await confirmDocumentSend())) return;

    const currentCounter = Number(
      window.localStorage.getItem(registryCounterStorageKey) || "0"
    );
    const nextCounter = currentCounter + 1;
    const document = {
      ...(activeMonthlyAnalysisDocument || {}),
      addressee: monthlyAnalysisAddressee,
      addresseeRich: monthlyAnalysisAddresseeRich,
      attachments: sanitizeMonthlyAnalysisAttachments(monthlyAnalysisAttachments),
      body: monthlyAnalysisBody,
      commanderName: monthlyAnalysisCommanderName,
      commanderRank: monthlyAnalysisCommanderRank,
      commanderSignature: monthlyAnalysisCommanderSignature,
      commanderTitle: monthlyAnalysisCommanderTitle,
      extraPages: monthlyAnalysisExtraPages,
      registryNumber: nextCounter,
      sectionId: selectedSectionId,
      title: monthlyAnalysisTitle,
      titleRich: monthlyAnalysisTitleRich,
    };

    setIsSendingAnalysis(true);
    setAnalysisSubmissionError("");
    try {
      const submission = await createThematicAccountSubmission({
        documentTitle,
        sectionId:
          data?.submissionSectionId ||
          (user?.role === "regional"
            ? "combat-training-analysis-regional"
            : "combat-training-analysis"),
        periodId: data?.submissionPeriodId || selectedSectionId,
        table: {
          sectionId: selectedSectionId,
          sectionTitle: selectedSection?.title || selectedSectionId,
          document,
        },
      });
      setAnalysisSubmissions((items) => [
        submission,
        ...items.filter((item) => item.id !== submission.id),
      ]);
      data?.onSubmissionCreated?.(submission);
      const registrationNumber = submission.registrationNumber || submission.id;
      window.localStorage.setItem(registryCounterStorageKey, String(registrationNumber));
      setMonthlyAnalysisRegistryNumber(registrationNumber);
      updateActiveMonthlyAnalysisDocument({ registryNumber: registrationNumber });
      persistMonthlyAnalysisDraft({ registryNumber: registrationNumber });
      setIsAnalysisSendDialogOpen(false);
      setAnalysisSubmissionTitle("");
    } catch (error) {
      setAnalysisSubmissionError(
        getApiErrorMessage(error, "Документти жөнөтүү мүмкүн болгон жок.")
      );
    } finally {
      setIsSendingAnalysis(false);
    }
  };

  const openAnalysisSubmission = (submission) => {
    const document = submission?.table?.document || {};
    setSelectedAnalysisSubmission(submission);
    setSelectedSectionId(submission?.table?.sectionId || submission?.periodId || "monthly-analysis");
    applyMonthlyAnalysisDocumentToState({ ...document, registryNumber: document.registryNumber || 1 });
    setIsMonthlyDocumentOpen(true);
    setIsCreateDialogOpen(false);
  };

  const handleDeleteAnalysisSubmission = async (submission) => {
    if (!window.confirm(`"${submission.documentTitle}" өчүрүлсүнбү?`)) return;

    setDeletingAnalysisSubmissionId(submission.id);
    try {
      await deleteThematicAccountSubmission(submission.id);
      setAnalysisSubmissions((items) => items.filter((item) => item.id !== submission.id));
    } catch (error) {
      window.alert(getApiErrorMessage(error, "Документти өчүрүү мүмкүн болгон жок."));
    } finally {
      setDeletingAnalysisSubmissionId(null);
    }
  };

  const handlePrintMonthlyAnalysis = () => {
    printAnalysisDocument(document.querySelector('.monthly-analysis-print-root'));
  };

  const handleAddMonthlyAnalysisPage = () => {
    if (isMonthlyAnalysisSent) return;
    setMonthlyAnalysisExtraPages((currentPages) => {
      const nextPages = [...currentPages, ""];
      updateActiveMonthlyAnalysisDocument({ extraPages: nextPages });
      persistMonthlyAnalysisDraft({ extraPages: nextPages });
      return nextPages;
    });
  };

  const handleMonthlyAnalysisExtraPageChange = (pageIndex, value) => {
    setMonthlyAnalysisExtraPages((currentPages) => {
      const nextPages = currentPages.map((pageText, currentPageIndex) =>
        currentPageIndex === pageIndex ? value : pageText
      );
      updateActiveMonthlyAnalysisDocument({ extraPages: nextPages });
      persistMonthlyAnalysisDraft({ extraPages: nextPages });
      return nextPages;
    });
  };

  const handleDeleteMonthlyAnalysisPage = (pageIndex) => {
    if (isMonthlyAnalysisSent) return;
    setMonthlyAnalysisExtraPages((currentPages) => {
      const nextPages = currentPages.filter((_, currentPageIndex) => currentPageIndex !== pageIndex);
      updateActiveMonthlyAnalysisDocument({ extraPages: nextPages });
      persistMonthlyAnalysisDraft({ extraPages: nextPages });
      return nextPages;
    });
  };

  const handleMonthlyAnalysisAttachmentUpload = async (attachmentType, fileList) => {
    if (isMonthlyAnalysisSent) return;
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) return;
    const activeDocumentId = activeMonthlyAnalysisDocumentIdRef.current;
    if (!activeDocumentId) return;

    const nextAttachments = await Promise.all(files.map(async (file) => {
      const objectUrl = URL.createObjectURL(file);
      monthlyAnalysisAttachmentUrlsRef.current.push(objectUrl);
      return {
        id: createMonthlyAnalysisAttachmentId(),
        dataUrl: attachmentType === "photo" ? await new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
        }) : null,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        objectUrl,
        size: file.size,
        type: attachmentType,
      };
    }));

    if (activeMonthlyAnalysisDocumentIdRef.current !== activeDocumentId) return;

    const mergedAttachments = [...monthlyAnalysisAttachments, ...nextAttachments];
    const attachmentsForStorage = sanitizeMonthlyAnalysisAttachments(mergedAttachments);
    setMonthlyAnalysisAttachments(mergedAttachments);
    updateActiveMonthlyAnalysisDocument({ attachments: attachmentsForStorage });
    persistMonthlyAnalysisDraft({ attachments: attachmentsForStorage });
  };

  const handleMonthlyAnalysisAttachmentButtonClick = (attachmentType) => {
    if (attachmentType === "photo") {
      monthlyAnalysisPhotoInputRef.current?.click();
      return;
    }
    if (attachmentType === "video") {
      monthlyAnalysisVideoInputRef.current?.click();
      return;
    }
    monthlyAnalysisDocumentInputRef.current?.click();
  };

  const handleOpenMonthlyAnalysisPicker = () => {
    setSelectedMonthlyAnalysisSourceDocumentIds([]);
    setIsMonthlyAnalysisPickerOpen(true);
  };

  const handleInsertMonthlyAnalysisSourceDocument = () => {
    const selectedDocuments = monthlyAnalysisSourceDocuments.filter((document) =>
      selectedMonthlyAnalysisSourceDocumentIds.includes(document.id)
    );
    if (selectedDocuments.length === 0) return;

    const nextAttachments = selectedDocuments.flatMap((document) =>
      Array.isArray(document.attachments) ? document.attachments : []
    );
    const nextExtraPages = selectedDocuments.flatMap((document) =>
      Array.isArray(document.extraPages) ? document.extraPages : []
    );
    const nextBody = composeMonthlyAnalysisDocumentsText(selectedDocuments);
    const primaryDocument = selectedDocuments[0];

    setMonthlyAnalysisAddressee("");setMonthlyAnalysisAddresseeRich("");
    setMonthlyAnalysisBody(nextBody);
    setMonthlyAnalysisAttachments(nextAttachments);
    setMonthlyAnalysisExtraPages(nextExtraPages);
    setMonthlyAnalysisCommanderTitle(primaryDocument.commanderTitle || "");
    setMonthlyAnalysisCommanderRank(primaryDocument.commanderRank || "");
    setMonthlyAnalysisCommanderName(primaryDocument.commanderName || "");
    setMonthlyAnalysisCommanderSignature(primaryDocument.commanderSignature || "");
    updateActiveMonthlyAnalysisDocument({
      addressee: "",
      attachments: sanitizeMonthlyAnalysisAttachments(nextAttachments),
      body: nextBody,
      commanderName: primaryDocument.commanderName || "",
      commanderRank: primaryDocument.commanderRank || "",
      commanderSignature: primaryDocument.commanderSignature || "",
      commanderTitle: primaryDocument.commanderTitle || "",
      extraPages: nextExtraPages,
    });
    persistMonthlyAnalysisDraft({
      addressee: "",
      attachments: sanitizeMonthlyAnalysisAttachments(nextAttachments),
      body: nextBody,
      commanderName: primaryDocument.commanderName || "",
      commanderRank: primaryDocument.commanderRank || "",
      commanderSignature: primaryDocument.commanderSignature || "",
      commanderTitle: primaryDocument.commanderTitle || "",
      extraPages: nextExtraPages,
    });
    setIsMonthlyAnalysisPickerOpen(false);
  };

  const handleDeleteMonthlyAnalysisAttachment = (attachmentId) => {
    if (isMonthlyAnalysisSent) return;

    setMonthlyAnalysisAttachments((currentAttachments) => {
      const attachmentToDelete = currentAttachments.find((attachment) => attachment.id === attachmentId);
      if (attachmentToDelete?.objectUrl) {
        try {
          URL.revokeObjectURL(attachmentToDelete.objectUrl);
        } catch {
          // ignore cleanup failures
        }
      }

      const nextAttachments = currentAttachments.filter((attachment) => attachment.id !== attachmentId);
      const attachmentsForStorage = sanitizeMonthlyAnalysisAttachments(nextAttachments);
      updateActiveMonthlyAnalysisDocument({ attachments: attachmentsForStorage });
      persistMonthlyAnalysisDraft({ attachments: attachmentsForStorage });
      return nextAttachments;
    });
  };

  const getCommanderSignaturePoint = (event) => {
    const canvas = commanderSignatureCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleCommanderSignatureStart = (event) => {
    if (isMonthlyAnalysisSent) return;
    const canvas = commanderSignatureCanvasRef.current;
    const point = getCommanderSignaturePoint(event);
    if (!canvas || !point) return;

    event.preventDefault();
    const context = canvas.getContext("2d");
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111";
    context.beginPath();
    context.moveTo(point.x, point.y);
    isDrawingCommanderSignatureRef.current = true;
  };

  const handleCommanderSignatureMove = (event) => {
    if (!isDrawingCommanderSignatureRef.current || isMonthlyAnalysisSent) return;
    const canvas = commanderSignatureCanvasRef.current;
    const point = getCommanderSignaturePoint(event);
    if (!canvas || !point) return;

    event.preventDefault();
    const context = canvas.getContext("2d");
    context.lineTo(point.x, point.y);
    context.stroke();
    const nextSignature = canvas.toDataURL("image/png");
    setMonthlyAnalysisCommanderSignature(nextSignature);
    updateActiveMonthlyAnalysisDocument({ commanderSignature: nextSignature });
    persistMonthlyAnalysisDraft({ commanderSignature: nextSignature });
  };

  const handleCommanderSignatureEnd = () => {
    isDrawingCommanderSignatureRef.current = false;
    const canvas = commanderSignatureCanvasRef.current;
    if (!canvas || isMonthlyAnalysisSent) return;
    const nextSignature = canvas.toDataURL("image/png");
    setMonthlyAnalysisCommanderSignature(nextSignature);
    updateActiveMonthlyAnalysisDocument({ commanderSignature: nextSignature });
    persistMonthlyAnalysisDraft({ commanderSignature: nextSignature });
  };

  const handleCommanderSignatureClear = () => {
    if (isMonthlyAnalysisSent) return;
    const canvas = commanderSignatureCanvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setMonthlyAnalysisCommanderSignature("");
    updateActiveMonthlyAnalysisDocument({ commanderSignature: "" });
    persistMonthlyAnalysisDraft({ commanderSignature: "" });
  };

  const loadCommanderSignatureToCanvas = (dataUrl) => {
    const canvas = commanderSignatureCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!dataUrl) return;

    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = dataUrl;
  };

  const openCommanderSignatureDialog = () => {
    if (isMonthlyAnalysisSent) return;
    setIsCommanderSignatureDialogOpen(true);
    window.requestAnimationFrame(() => loadCommanderSignatureToCanvas(monthlyAnalysisCommanderSignature));
  };

  const saveCommanderSignature = () => {
    const canvas = commanderSignatureCanvasRef.current;
    if (!canvas || isMonthlyAnalysisSent) return;
    const nextSignature = canvas.toDataURL("image/png");
    setMonthlyAnalysisCommanderSignature(nextSignature);
    updateActiveMonthlyAnalysisDocument({ commanderSignature: nextSignature });
    persistMonthlyAnalysisDraft({ commanderSignature: nextSignature });
    setIsCommanderSignatureDialogOpen(false);
  };

  const analysisDocumentHistory = useDocumentHistory({
    resetKey: [
      selectedSectionId,
      activeMonthlyAnalysisDocumentId,
      selectedAnalysisSubmission?.id,
    ].filter(Boolean).join(":") || "analysis-no-document",
    value: {
      addressee: monthlyAnalysisAddressee,
      addresseeRich: monthlyAnalysisAddresseeRich,
      title: monthlyAnalysisTitle,
      titleRich: monthlyAnalysisTitleRich,
      body: monthlyAnalysisBody,
      extraPages: monthlyAnalysisExtraPages,
      commanderTitle: monthlyAnalysisCommanderTitle,
      commanderRank: monthlyAnalysisCommanderRank,
      commanderName: monthlyAnalysisCommanderName,
    },
    onChange: (snapshot) => {
      const nextDocument = {
        addressee: snapshot.addressee || "",
        title: snapshot.title || "",
        body: snapshot.body || "",
        extraPages: snapshot.extraPages || [],
        commanderTitle: snapshot.commanderTitle || "",
        commanderRank: snapshot.commanderRank || "",
        commanderName: snapshot.commanderName || "",
      };
      setMonthlyAnalysisAddressee(nextDocument.addressee);
    setMonthlyAnalysisAddresseeRich(nextDocument.addresseeRich||"");
      setMonthlyAnalysisTitle(nextDocument.title);
    setMonthlyAnalysisTitleRich(nextDocument.titleRich||"");
      setMonthlyAnalysisBody(nextDocument.body);
      setMonthlyAnalysisExtraPages(nextDocument.extraPages);
      setMonthlyAnalysisCommanderTitle(nextDocument.commanderTitle);
      setMonthlyAnalysisCommanderRank(nextDocument.commanderRank);
      setMonthlyAnalysisCommanderName(nextDocument.commanderName);
      updateActiveMonthlyAnalysisDocument(nextDocument);
      persistMonthlyAnalysisDraft(nextDocument);
    },
  });

  const signatureBlock = (
    <div
      className="monthly-analysis-signature-block"
      style={{
        color: "#111",
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: "12pt",
        marginTop: "32px",
      }}
    >
      <input
        onChange={(event) => {
          const nextValue = event.target.value;
          setMonthlyAnalysisCommanderTitle(nextValue);
          updateActiveMonthlyAnalysisDocument({ commanderTitle: nextValue });
          persistMonthlyAnalysisDraft({ commanderTitle: nextValue });
        }}
        placeholder={copyT("2026 аскер бөлүгүнүн командири")}
        readOnly={isMonthlyAnalysisSent}
        style={{
          backgroundColor: "transparent",
          border: "none",
          color: "#111",
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: "12pt",
          fontWeight: "bold",
          marginBottom: "16px",
          outline: "none",
          width: "100%",
        }}
        value={monthlyAnalysisCommanderTitle}
      />
      <div style={{ alignItems: "center", display: "grid", gridTemplateColumns: "145px 1fr", gap: "18px" }}>
        <input
          onChange={(event) => {
            const nextValue = event.target.value;
            setMonthlyAnalysisCommanderRank(nextValue);
            updateActiveMonthlyAnalysisDocument({ commanderRank: nextValue });
            persistMonthlyAnalysisDraft({ commanderRank: nextValue });
          }}
          className="commander-study-number" aria-label="Окуу номери №" placeholder="Окуу номери №"
          readOnly={isMonthlyAnalysisSent}
          style={{
            backgroundColor: "transparent",
            border: "none",
            color: "#111",
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: "12pt",
            fontWeight: "bold",
            outline: "none",
          }}
          value={monthlyAnalysisCommanderRank}
          />
        <input
          onChange={(event) => {
            const nextValue = event.target.value;
            setMonthlyAnalysisCommanderName(nextValue);
            updateActiveMonthlyAnalysisDocument({ commanderName: nextValue });
            persistMonthlyAnalysisDraft({ commanderName: nextValue });
          }}
          className="commander-study-number" aria-label="Окуу номери, мисалы К-115" placeholder="М: К-115"
          readOnly={isMonthlyAnalysisSent}
          style={{
            backgroundColor: "transparent",
            border: "none",
            color: "#111",
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: "12pt",
            fontWeight: "bold",
            outline: "none",
          }}
          value={monthlyAnalysisCommanderName}
        />
      </div>
      <div className="analysis-signature-print" aria-hidden="true">
        {monthlyAnalysisCommanderTitle&&<p>{monthlyAnalysisCommanderTitle}</p>}
        {(monthlyAnalysisCommanderRank||monthlyAnalysisCommanderName)&&<div><span>{monthlyAnalysisCommanderRank}</span><span>{monthlyAnalysisCommanderName}</span></div>}
      </div>
    </div>
  );

  if (user?.role === "regional" && !selectedAnalyticsScope) {
    return (
      <section className="module-panel">
        <header className="module-header">
          <h1><T>{"Күжүрмөн даярдоонун талдоолору"}</T></h1>
        </header>
        <div className="analysis-section-list">
          <article className="analysis-section-card">
            <button
              className="analysis-section-card__open"
              onClick={() => setSelectedAnalyticsScope("subunits")}
              type="button"
            >
              <span aria-hidden="true" className="module-document-icon" />
              <strong><T>{"Бөлүкчөлөрдүн күжүрмөн даярдоонун талдоолору"}</T></strong>
            </button>
          </article>
          <article className="analysis-section-card">
            <button
              className="analysis-section-card__open"
              onClick={() => setSelectedAnalyticsScope("regional-unit")}
              type="button"
            >
              <span aria-hidden="true" className="module-document-icon" />
              <strong><T>{"Аскер бөлүктүн күжүрмөн даярдоонун талдоолору"}</T></strong>
            </button>
          </article>
        </div>
      </section>
    );
  }

  if (selectedSection && isMonthlyDocumentOpen) {
    return (
      <section className="module-panel monthly-analysis-print-root analysis-editor-workspace">
        <div className="analysis-editor-toolbar no-print">
        <button
          className="module-back-button"
          onClick={() => {
            if (data?.directEditor && data?.onBack) {
              data.onBack();
              return;
            }
            setIsMonthlyDocumentOpen(false);
            setIsMonthlyAnalysisPickerOpen(false);
            setSelectedAnalysisSubmission(null);
          }}
          type="button"
        ><T>{"Артка"}</T></button>
        <div className="module-actions">
          {!data?.simpleLetterEditor && !selectedAnalysisSubmission && canEditAnalysis ? (
            <button
              className="module-action-button"
              disabled={isMonthlyAnalysisSent || !analysisDocumentHistory.canUndo}
              onClick={analysisDocumentHistory.undo}
              type="button"
            ><T>{"↶ Артка"}</T></button>
          ) : null}
          {!data?.simpleLetterEditor && !selectedAnalysisSubmission && canEditAnalysis ? (
            <button
              className="module-action-button"
              disabled={isMonthlyAnalysisSent || !analysisDocumentHistory.canRedo}
              onClick={analysisDocumentHistory.redo}
              type="button"
            ><T>{"↷ Алдыга"}</T></button>
          ) : null}
          {!data?.simpleLetterEditor && !selectedAnalysisSubmission && canEditAnalysis ? (
            <button className="module-action-button editor-action-save" onClick={() => {
              
              try {
                if (!activeMonthlyAnalysisDocumentIdRef.current) throw new Error("missing document");
                handleSaveCurrentMonthlyAnalysisDocument();
                notifySave();
              } catch { notifySave(false); }
              
            }} type="button"><T>{"Сактоо"}</T></button>
          ) : null}
          {!data?.simpleLetterEditor && !selectedAnalysisSubmission && canEditAnalysis && (
            selectedAnalyticsScope === "regional-unit" ||
            selectedSectionId === "period-analysis" ||
            selectedSectionId === "year-analysis"
          ) ? (
            <button
              className="module-action-button"
              disabled={isMonthlyAnalysisSent}
              onClick={handleOpenMonthlyAnalysisPicker}
              type="button"
            ><T>{"Тандоо"}</T></button>
          ) : null}
          {!selectedAnalysisSubmission && (
            user?.role === "outpost" ||
            (user?.role === "regional" && selectedAnalyticsScope === "regional-unit")
          ) ? (
            <button
              className="module-action-button"
              disabled={isMonthlyAnalysisSent}
              onClick={handleSendMonthlyAnalysis}
              type="button"
            ><T>{"Жөнөтүү"}</T></button>
          ) : null}
          {data?.simpleLetterEditor && !selectedAnalysisSubmission && canEditAnalysis ? (
            <button
              className="module-action-button"
              disabled={isMonthlyAnalysisSent}
              onClick={() => {
                handleDeleteMonthlyAnalysisDocument(activeMonthlyAnalysisDocumentId);
                data?.onDeleteDirectDocument?.(activeMonthlyAnalysisDocumentId);
              }}
              type="button"
            ><T>{"Өчүрүү"}</T></button>
          ) : !data?.directEditor && !selectedAnalysisSubmission && canEditAnalysis ? (
            <button
              className="module-action-button"
              disabled={isMonthlyAnalysisSent}
              onClick={() => handleDeleteMonthlyAnalysisDocument(activeMonthlyAnalysisDocumentId)}
              data-editor-action="delete"
              type="button"
            ><T>{"Өчүрүү"}</T></button>
          ) : null}
          {!selectedAnalysisSubmission && canEditAnalysis ? (
            <button
              className="module-action-button"
              disabled={isMonthlyAnalysisSent}
              onClick={handleAddMonthlyAnalysisPage}
              data-editor-action="add-page"
              type="button"
            ><T>{"+ барак кошуу"}</T></button>
          ) : null}
          <button className="module-action-button editor-action-print" onClick={handlePrintMonthlyAnalysis} type="button"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z"/><path d="M17 11h1"/></svg><T>{"Басып чыгаруу"}</T></button>
        </div>
        <div className="document-tools-host no-print" />
        </div>
        {isAnalysisSendDialogOpen ? (
          <div className="lesson-period-dialog" role="dialog" aria-modal="true" aria-labelledby="analysis-send-title">
            <form
              className="lesson-period-dialog__panel"
              onSubmit={(event) => {
                event.preventDefault();
                handleConfirmSendMonthlyAnalysis();
              }}
            >
              <h2 id="analysis-send-title"><T>{"Документти жөнөтүү"}</T></h2>
              <input
                autoFocus
                className="lesson-period-dialog__input"
                onChange={(event) => {
                  setAnalysisSubmissionTitle(event.target.value);
                  setAnalysisSubmissionError("");
                }}
                placeholder="Иш кагаздардын аталышы"
                value={analysisSubmissionTitle}
              />
              {analysisSubmissionError ? (
                <p className="lesson-period-dialog__error">{analysisSubmissionError}</p>
              ) : null}
              <div className="lesson-period-dialog__actions">
                <button
                  disabled={isSendingAnalysis}
                  onClick={() => setIsAnalysisSendDialogOpen(false)}
                  type="button"
                ><T>{"Жокко чыгаруу"}</T></button>
                <button disabled={isSendingAnalysis} type="submit">
                  <T>{isSendingAnalysis ? "Жөнөтүлүүдө..." : "Жөнөтүү"}</T>
                </button>
              </div>
            </form>
          </div>
        ) : null}
        <div className="analysis-editor-scroll" role="region" aria-label="Документ" tabIndex={0}>
        <FitDocumentPages>
        <div
          className="monthly-analysis-page monthly-analysis-page--first"
          style={{
            backgroundColor: "#fff",
            border: "1px solid #d0d0d0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            fontFamily: '"Times New Roman", Times, serif',
            margin: "0 auto",
            minHeight: "1123px",
            padding: "28px 42px",
            width: "794px",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "grid",
              gap: "18px",
              gridTemplateColumns: "1fr 86px 1fr",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                fontSize: "10.5pt",
                fontWeight: "bold",
                lineHeight: 1.25,
                textAlign: "center",
                textTransform: "uppercase",
              }}
            ><T>{"КЫРГЫЗ РЕСПУБЛИКАСЫНЫН"}</T><br /><T>{"МАМЛЕКЕТТИК"}</T><br /><T>{"ЧЕК АРА КЫЗМАТЫ"}</T></div>
            <img
              alt="Кыргыз Республикасынын герби"
              src={kyrgyzstanCoatOfArmsUrl}
              style={{
                display: "block",
                height: "86px",
                objectFit: "contain",
                width: "86px",
              }}
            />
            <div
              style={{
                fontSize: "10.5pt",
                fontWeight: "bold",
                lineHeight: 1.25,
                textAlign: "center",
                textTransform: "uppercase",
              }}
            ><T>{"ГОСУДАРСТВЕННАЯ"}</T><br /><T>{"ПОГРАНИЧНАЯ СЛУЖБА"}</T><br /><T>{"КЫРГЫЗСКОЙ РЕСПУБЛИКИ"}</T></div>
          </div>
          <div
            style={{
              fontFamily: '"Times New Roman", Times, serif',
              fontSize: "12pt",
              marginBottom: "18px",
              textAlign: "left",
            }}
          >
            {formattedRegistrationCode}
          </div>
          <DocumentRichEditor field="addressee"
            value={monthlyAnalysisAddresseeRich||monthlyAnalysisAddressee}
            onChange={event=>{
              const addresseeRich=event.target.value,addressee=richTextToPlain(addresseeRich);
              setMonthlyAnalysisAddressee(addressee);setMonthlyAnalysisAddresseeRich(addresseeRich);
              updateActiveMonthlyAnalysisDocument({addressee,addresseeRich});persistMonthlyAnalysisDraft({addressee,addresseeRich});
            }} readOnly={isMonthlyAnalysisSent}
            style={{fontFamily:'"Times New Roman",Times,serif',fontSize:'12pt',fontWeight:'bold',lineHeight:1.3,minHeight:'70px',margin:'42px 0 32px auto',width:'310px',maxWidth:'100%',textAlign:'left'}}
          />
          <DocumentRichEditor field="title"
            value={monthlyAnalysisTitleRich||monthlyAnalysisTitle}
            onChange={event=>{
              const titleRich=event.target.value,title=richTextToPlain(titleRich);
              setMonthlyAnalysisTitle(title);setMonthlyAnalysisTitleRich(titleRich);
              updateActiveMonthlyAnalysisDocument({title,titleRich});persistMonthlyAnalysisDraft({title,titleRich});
            }} placeholder={monthlyAnalysisPlaceholder} readOnly={isMonthlyAnalysisSent}
            style={{fontFamily:'"Times New Roman",Times,serif',fontSize:'14pt',fontWeight:'bold',textAlign:'center',minHeight:'68px',marginTop:0,width:'100%'}}
          />
          <DocumentRichEditor
            onChange={(event) => {
              const nextValue = event.target.value;
              setMonthlyAnalysisBody(nextValue);
              updateActiveMonthlyAnalysisDocument({ body: nextValue });
              persistMonthlyAnalysisDraft({ body: nextValue });
            }}
            placeholder={copyT("Документтин негизги текстин бул жерге жазыңыз...")}
            readOnly={isMonthlyAnalysisSent}
            className="monthly-analysis-page__body"

            rows={24}
            style={{
              border: "none",
              color: "#111",
              fontFamily: '"Times New Roman", Times, serif',
              fontSize: "12pt",
              lineHeight: 1.45,
              marginTop: "22px",
              minHeight: "610px",
              outline: "none",
              resize: isMonthlyAnalysisSent ? "none" : "vertical",
              textAlign: "left",
              width: "100%",
            }}
            value={monthlyAnalysisBody}
          />
          <div className="monthly-analysis-attachments no-print">
            {!data?.archiveReadOnly ? <div className="monthly-analysis-attachments__toolbar">
              <button
                className="monthly-analysis-attachments__button monthly-analysis-attachments__button--green"
                disabled={isMonthlyAnalysisSent}
                onClick={() => handleMonthlyAnalysisAttachmentButtonClick("photo")}
                type="button"
              ><T>{"Фото жүктөө"}</T></button>
              <button
                className="monthly-analysis-attachments__button monthly-analysis-attachments__button--green"
                disabled={isMonthlyAnalysisSent}
                onClick={() => handleMonthlyAnalysisAttachmentButtonClick("video")}
                type="button"
              ><T>{"Видео жүктөө"}</T></button>
              <button
                className="monthly-analysis-attachments__button monthly-analysis-attachments__button--green"
                disabled={isMonthlyAnalysisSent}
                onClick={() => handleMonthlyAnalysisAttachmentButtonClick("document")}
                type="button"
              ><T>{"Иш документтерди жүктөө"}</T></button>
            </div> : null}
            <input
              accept="image/*"
              multiple
              onChange={(event) => {
                handleMonthlyAnalysisAttachmentUpload("photo", event.target.files);
                event.target.value = "";
              }}
              ref={monthlyAnalysisPhotoInputRef}
              style={{ display: "none" }}
              type="file"
            />
            <input
              accept="video/*"
              multiple
              onChange={(event) => {
                handleMonthlyAnalysisAttachmentUpload("video", event.target.files);
                event.target.value = "";
              }}
              ref={monthlyAnalysisVideoInputRef}
              style={{ display: "none" }}
              type="file"
            />
            <input
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              multiple
              onChange={(event) => {
                handleMonthlyAnalysisAttachmentUpload("document", event.target.files);
                event.target.value = "";
              }}
              ref={monthlyAnalysisDocumentInputRef}
              style={{ display: "none" }}
              type="file"
            />
            {monthlyAnalysisAttachments.length > 0 ? (
              <div className="monthly-analysis-attachments__grid">
                {monthlyAnalysisAttachments.map((attachment) => (
                  <div className="monthly-analysis-attachment" key={attachment.id}>
                    {!data?.archiveReadOnly ? <button
                      aria-label="Вложение удалить"
                      className="monthly-analysis-attachment__remove"
                      disabled={isMonthlyAnalysisSent}
                      onClick={() => handleDeleteMonthlyAnalysisAttachment(attachment.id)}
                      type="button"
                    >
                      ×
                    </button> : null}
                    {attachment.type === "photo" ? (
                      <img alt={attachment.fileName} src={attachment.objectUrl || attachment.dataUrl} />
                    ) : attachment.type === "video" ? (
                      <video controls src={attachment.objectUrl || attachment.dataUrl} />
                    ) : (
                      <a
                        href={attachment.objectUrl || attachment.dataUrl}
                        download={attachment.fileName}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {attachment.fileName}
                      </a>
                    )}
                    <div className="monthly-analysis-attachment__meta">
                      <strong>{attachment.fileName}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {monthlyAnalysisExtraPages.length === 0 ? signatureBlock : null}
        </div>
        {monthlyAnalysisExtraPages.map((pageText, pageIndex) => (
          <div
            className="monthly-analysis-page monthly-analysis-page--extra"
            key={pageIndex}
            style={{
              backgroundColor: "#fff",
              border: "1px solid #d0d0d0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              fontFamily: '"Times New Roman", Times, serif',
              margin: "24px auto 0",
              minHeight: "1123px",
              padding: "42px",
              width: "794px",
            }}
          >
            <textarea
            onChange={(event) => handleMonthlyAnalysisExtraPageChange(pageIndex, event.target.value)}
              placeholder={copyT("Кошумча барактын текстин бул жерге жазыңыз...")}
              readOnly={isMonthlyAnalysisSent}
            className="monthly-analysis-page__extra-text"
            ref={(element) => {
              monthlyAnalysisExtraTextareaRefs.current[pageIndex] = element;
            }}
            rows={36}
              style={{
                border: "none",
                color: "#111",
                fontFamily: '"Times New Roman", Times, serif',
                fontSize: "12pt",
                lineHeight: 1.45,
                minHeight: "1010px",
                outline: "none",
                resize: isMonthlyAnalysisSent ? "none" : "vertical",
                textAlign: "left",
                width: "100%",
              }}
              value={pageText}
            />
            <div className="monthly-analysis-page__extra-text-print" aria-hidden="true">
              {pageText}
            </div>
            {pageIndex === monthlyAnalysisExtraPages.length - 1 ? signatureBlock : null}
            {!isMonthlyAnalysisSent ? (
              <button
                onClick={() => handleDeleteMonthlyAnalysisPage(pageIndex)}
                style={{
                  backgroundColor: "#ff4444",
                  border: "1px solid #cc0000",
                  borderRadius: "4px",
                  color: "#fff",
                  cursor: "pointer",
                  display: "block",
                  fontFamily: '"Times New Roman", Times, serif',
                  fontSize: "11pt",
                  margin: "28px 0 0 auto",
                  padding: "6px 14px",
                }}
                type="button"
              ><T>{"барак өчүрүү"}</T></button>
            ) : null}
          </div>
        ))}
        </FitDocumentPages>
        </div>
        {isMonthlyAnalysisPickerOpen ? (
          <div
            className="lesson-period-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="monthly-analysis-picker-title"
          >
            <div className="lesson-period-dialog__panel" style={{ maxWidth: "980px", width: "980px" }}>
              <h2 id="monthly-analysis-picker-title"><T>{monthlyAnalysisPickerTitle}</T></h2>
              {monthlyAnalysisSourceDocuments.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gap: "10px",
                    marginBottom: "16px",
                    maxHeight: "460px",
                    overflow: "auto",
                  }}
                >
                  {monthlyAnalysisSourceDocuments.map((document) => {
                    const isSelected = selectedMonthlyAnalysisSourceDocumentIds.includes(document.id);
                    return (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => handleToggleMonthlyAnalysisSourceDocument(document.id)}
                        style={{
                          backgroundColor: isSelected ? "#dcebe3" : "#f7f8f4",
                          border: isSelected ? "1px solid #0f5b3a" : "1px solid #bdcbc4",
                          color: "#13221b",
                          display: "grid",
                          gap: "4px",
                          padding: "12px 14px",
                          textAlign: "left",
                        }}
                      >
                        <strong>
                          {document.sourceDocumentTitle || document.title || monthlyAnalysisSourcePlaceholder}
                        </strong>
                        {document.sourceOutpostName ? (
                          <span style={{ color: "#53645d", fontSize: "12px" }}>
                            {document.sourceOutpostName}
                          </span>
                        ) : null}
                        <span style={{ color: "#53645d", fontSize: "12px" }}>
                          <T>{document.body ? `${document.body.slice(0, 120)}${document.body.length > 120 ? "..." : ""}` : "Текст жок"}</T>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: "#53645d", marginBottom: "16px" }}>{monthlyAnalysisPickerEmptyText}</div>
              )}
              <div className="lesson-period-dialog__actions">
                <button onClick={() => setIsMonthlyAnalysisPickerOpen(false)} type="button"><T>{"Жокко чыгаруу"}</T></button>
                <button
                  onClick={handleInsertMonthlyAnalysisSourceDocument}
                  type="button"
                  disabled={selectedMonthlyAnalysisSourceDocumentIds.length === 0}
                ><T>{"Талдоо жасоо"}</T></button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  const renderAdminAnalysisSubmission = (submission) => (
    <div className="module-period-row" key={`admin-analysis-${submission.id}`}>
      <button
        className="module-period-card module-period-card--document"
        onClick={() => openAnalysisSubmission(submission)}
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
          </small>
        </span>
      </button>
      <div className="module-period-actions">
        <button
          disabled={deletingAnalysisSubmissionId === submission.id}
          onClick={() => handleDeleteAnalysisSubmission(submission)}
          type="button"
        >
          <T>{deletingAnalysisSubmissionId === submission.id ? "Өчүрүү..." : "Өчүрүү"}</T>
        </button>
      </div>
    </div>
  );

  if (selectedSection) {
    return (
      <section className="module-panel">
        <button
          className="module-back-button"
          onClick={() => {
            if (data?.directEditor && data?.onBack) {
              data.onBack();
              return;
            }
            if (selectedAdminOutpostName) {
              setSelectedAdminOutpostName(null);
              return;
            }
            if (selectedAdminUnitNumber) {
              setSelectedAdminUnitNumber(null);
              return;
            }
            setSelectedSectionId(null);
            setIsCreateDialogOpen(false);
            setIsMonthlyDocumentOpen(false);
            setIsMonthlyAnalysisPickerOpen(false);
            persistMonthlyAnalysisDraft({
              isCreateDialogOpen: false,
              isMonthlyDocumentOpen: false,
              selectedSectionId: null,
            });
          }}
          type="button"
        ><T>{"Артка"}</T></button>
        <header className="module-header">
          <h1><T>{selectedSection.title}</T></h1>
        </header>
        {user?.role === "admin" ? (
          <>
            {!selectedAdminUnitNumber ? (
              <div className="module-document-list">
                <button
                  className="module-document-card"
                  onClick={() => {
                    setSelectedAdminUnitNumber(ADMIN_ANALYSIS_WORKSPACE_ID);
                    setSelectedAdminOutpostName(null);
                  }}
                  type="button"
                >
                  <span aria-hidden="true" className="module-document-icon" />
                  <strong><T>{"Администратордун талдоолору"}</T></strong>
                </button>
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
                    {renderAnalysisReportingStatus(
                      getLatestAnalysisSubmission(
                        currentAdminAnalysisSubmissions.filter(
                          (submission) =>
                            submission.senderRole === "regional" &&
                            String(submission.unitNumber) === String(unitNumber)
                        )
                      )
                    )}
                  </button>
                ))}
              </div>
            ) : selectedAdminUnitNumber === ADMIN_ANALYSIS_WORKSPACE_ID ? (
              <>
                <div className="module-actions">
                  <button
                    className="module-action-button"
                    onClick={handleCreateMonthlyAnalysis}
                    type="button"
                  ><T>{"Түзүү"}</T></button>
                </div>
                {currentAnalysisSectionDocuments.length > 0 ? (
                  <div className="module-document-list">
                    {currentAnalysisSectionDocuments.map((document) => (
                      <button
                        className="module-document-card"
                        key={document.id}
                        onClick={() => openMonthlyAnalysisDocument(document.id)}
                        style={{ width: "100%" }}
                        type="button"
                      >
                        <span aria-hidden="true" className="module-document-icon" />
                        <strong><T>{document.title || currentAnalysisPlaceholder}</T></strong>
                        {!document.registryNumber ? (
                          <span
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteMonthlyAnalysisDocument(document.id);
                            }}
                            role="button"
                            style={{
                              color: "#b42318",
                              cursor: "pointer",
                              fontSize: "12px",
                              marginLeft: "auto",
                              textDecoration: "underline",
                            }}
                            tabIndex={0}
                          ><T>{"Өчүрүү"}</T></span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="dashboard-state"><T>{"Администратор түзгөн талдоолор азырынча жок."}</T></p>
                )}
                {isCreateDialogOpen ? (
                  <div className="lesson-period-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-analysis-create-title">
                    <form
                      className="lesson-period-dialog__panel"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleSaveMonthlyAnalysis();
                      }}
                    >
                      <h2 id="admin-analysis-create-title"><T>{"Жаратуу"}</T></h2>
                      <textarea
                        className="lesson-period-dialog__textarea"
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setDraftMonthlyAnalysisTitle(nextValue);
                          persistMonthlyAnalysisDraft({ draftTitle: nextValue });
                        }}
                        placeholder={currentAnalysisPlaceholder}
                        rows={5}
                        value={draftMonthlyAnalysisTitle}
                      />
                      <div className="lesson-period-dialog__actions">
                        <button onClick={() => setIsCreateDialogOpen(false)} type="button"><T>{"Жокко чыгаруу"}</T></button>
                        <button type="submit"><T>{"Сактоо"}</T></button>
                      </div>
                    </form>
                  </div>
                ) : null}
              </>
            ) : selectedAdminOutpostName ? (
              <div className="module-submission-list">
                <h2>{selectedAdminOutpostName}</h2>
                {renderAnalysisReportingStatus(
                  getAdminOutpostAnalysisSubmission(selectedAdminOutpostName)
                )}
                <h3><T>{"Заставадан жөнөтүлгөн талдоолор"}</T></h3>
                {selectedAdminOutpostSubmissions.length > 0 ? (
                  selectedAdminOutpostSubmissions.map(renderAdminAnalysisSubmission)
                ) : (
                  <p className="dashboard-state"><T>{analysisLoadState === "ready" ? "Бул заставадан жөнөтүлгөн талдоолор азырынча жок." : analysisLoadState === "loading" ? "Загрузка отчётов..." : "Не удалось загрузить отчёты. Статус не определён."}</T></p>
                )}
              </div>
            ) : (
              <div className="module-submission-list">
                <h2>{selectedAdminUnitNumber}<T>{" аскер бөлүгү"}</T></h2>
                {renderAnalysisReportingStatus(
                  getLatestAnalysisSubmission(adminMilitaryUnitSubmissions)
                )}
                <h3><T>{"Аскер бөлүгүнөн жөнөтүлгөн талдоолор"}</T></h3>
                {adminMilitaryUnitSubmissions.length > 0 ? (
                  adminMilitaryUnitSubmissions.map(renderAdminAnalysisSubmission)
                ) : (
                  <p className="dashboard-state"><T>{"Аскер бөлүгүнөн жөнөтүлгөн талдоолор азырынча жок."}</T></p>
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
                        {renderAnalysisReportingStatus(
                          getAdminOutpostAnalysisSubmission(outpostName)
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="dashboard-state"><T>{"Бул аскер бөлүгүнө караштуу заставалар табылган жок."}</T></p>
                )}
              </div>
            )}
          </>
        ) : isRegionalSubunitAnalysis ? (
          <>
            {selectedAdminOutpostName ? (
              <div className="module-submission-list">
                <h2>{selectedAdminOutpostName}</h2>
                {renderAnalysisReportingStatus(
                  getRegionalOutpostAnalysisSubmission(selectedAdminOutpostName)
                )}
                <h3><T>{"Заставадан жөнөтүлгөн талдоолор"}</T></h3>
                {selectedRegionalAnalysisSubmissions.length > 0 ? (
                  <div className="saved-table-list">
                    {selectedRegionalAnalysisSubmissions.map((submission) => (
                      <article
                        className="saved-table-card"
                        key={`regional-analysis-${submission.id}`}
                        onClick={() => openAnalysisSubmission(submission)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openAnalysisSubmission(submission);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <strong><T>{submission.documentTitle}</T></strong>
                        <span>
                          {submission.table?.document?.title || submission.table?.sectionTitle}
                        </span>
                        <div
                          className="saved-table-card__actions"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <SubmissionEditPermissionButton
                            onUpdated={(updated) =>
                              setAnalysisSubmissions((items) =>
                                items.map((item) => item.id === updated.id ? updated : item)
                              )
                            }
                            submission={submission}
                          />
                          <button
                            onClick={() => setForwardingSubmission(submission)}
                            type="button"
                          ><T>{"Жөнөтүү"}</T></button>
                          <button
                            disabled={deletingAnalysisSubmissionId === submission.id}
                            onClick={() => handleDeleteAnalysisSubmission(submission)}
                            type="button"
                          >
                            <T>{deletingAnalysisSubmissionId === submission.id
                              ? "Өчүрүү..."
                              : "Өчүрүү"}</T>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="dashboard-state"><T>{"Бул заставадан жөнөтүлгөн талдоолор азырынча жок."}</T></p>
                )}
              </div>
            ) : (
              <>
                <div className="module-period-list">
                  <h2>{user?.region}<T>{" аскер бөлүгүнүн заставалары"}</T></h2>
                  {regionalOutpostNames.length > 0 ? (
                    <div className="saved-table-list">
                      {regionalOutpostNames.map((outpostName) => {
                        const documentCount = currentAnalysisSubmissions.filter(
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
                            {renderAnalysisReportingStatus(
                              getRegionalOutpostAnalysisSubmission(outpostName)
                            )}
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
                <div className="module-submission-list">
                  <h3><T>{"Чыгыш"}</T></h3>
                  {renderAnalysisReportingStatus(
                    latestRegionalAnalysisSubmission
                  )}
                  {currentRegionalOutgoingSubmissions.length > 0 ? (
                    <div className="saved-table-list">
                      {currentRegionalOutgoingSubmissions.map((submission) => (
                        <article
                          className="saved-table-card"
                          key={`analysis-outgoing-${submission.id}`}
                          onClick={() => openAnalysisSubmission(submission)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openAnalysisSubmission(submission);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <strong><T>{submission.documentTitle}</T></strong>
                          <div
                            className="saved-table-card__actions"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <SubmissionEditPermissionButton
                              onUpdated={(updated) =>
                                setAnalysisSubmissions((items) =>
                                  items.map((item) => item.id === updated.id ? updated : item)
                                )
                              }
                              submission={submission}
                            />
                            <button
                              disabled={deletingAnalysisSubmissionId === submission.id}
                              onClick={() => handleDeleteAnalysisSubmission(submission)}
                              type="button"
                            >
                              <T>{deletingAnalysisSubmissionId === submission.id
                                ? "Өчүрүү..."
                                : "Өчүрүү"}</T>
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="dashboard-state"><T>{"Жөнөтүлгөн документтер азырынча жок."}</T></p>
                  )}
                </div>
              </>
            )}
            <SubmissionForwardDialog
              onClose={() => setForwardingSubmission(null)}
              onForward={async (submission, title) => {
                const forwarded = await forwardThematicAccountSubmission(
                  submission.id,
                  title
                );
                setAnalysisSubmissions((items) => [forwarded, ...items]);
              }}
              submission={forwardingSubmission}
            />
          </>
        ) : analyticsSections.some((section) => section.id === selectedSection.id) ? (
          <>
            {canEditAnalysis ? (
              <div className="module-actions">
                <button
                  className="module-action-button"
                  onClick={handleCreateMonthlyAnalysis}
                  type="button"
                ><T>{"Түзүү"}</T></button>
              </div>
            ) : null}
            {canEditAnalysis ? (
              <div className="module-document-list">
                {currentAnalysisSectionDocuments.map((document) => (
                <button
                  className="module-document-card"
                  key={document.id}
                  onClick={() => openMonthlyAnalysisDocument(document.id)}
                  style={{ width: "100%" }}
                  type="button"
                >
                  <span aria-hidden="true" className="module-document-icon" />
                  <strong><T>{document.title || currentAnalysisPlaceholder}</T></strong>
                  {!document.registryNumber ? (
                    <span
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteMonthlyAnalysisDocument(document.id);
                      }}
                      role="button"
                      style={{
                        color: "#b42318",
                        cursor: "pointer",
                        fontSize: "12px",
                        marginLeft: "auto",
                        textDecoration: "underline",
                      }}
                      tabIndex={0}
                    ><T>{"Өчүрүү"}</T></span>
                  ) : null}
                </button>
                ))}
              </div>
            ) : null}
            {(user?.role === "outpost" || user?.role === "admin" || user?.role === "regional") ? (
              <div className="module-submission-list">
                <h3><T>{user?.role === "outpost" || selectedAnalyticsScope === "regional-unit" ? "Чыгыш" : "Кириш"}</T></h3>
                {user?.role === "outpost" || selectedAnalyticsScope === "regional-unit"
                  ? renderAnalysisReportingStatus(
                      selectedSectionId === PERIOD_ANALYSIS_SECTION_ID
                        ? latestOwnPeriodSubmission
                        : latestOwnMonthlySubmission
                    )
                  : null}
                {displayedAnalysisSubmissions.length > 0 ? (
                  <div className="saved-table-list">
                    {displayedAnalysisSubmissions.map((submission) => (
                      <article
                        className="saved-table-card"
                        key={`analysis-submission-${submission.id}`}
                        onClick={() => openAnalysisSubmission(submission)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openAnalysisSubmission(submission);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <strong><T>{submission.documentTitle}</T></strong>
                        <span>
                          {submission.table?.document?.title || submission.table?.sectionTitle}
                        </span>
                        {isRegionalSubunitAnalysis ? (
                          <span>
                            {submission.outpostName || submission.senderName}
                            {submission.unitNumber ? ` · ${submission.unitNumber}` : ""}
                          </span>
                        ) : null}
                        <div
                          className="saved-table-card__actions"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <SubmissionEditPermissionButton
                            onUpdated={(updated) => setAnalysisSubmissions((items) => items.map((item) => item.id === updated.id ? updated : item))}
                            submission={submission}
                          />
                          <button
                            disabled={deletingAnalysisSubmissionId === submission.id}
                            onClick={() => handleDeleteAnalysisSubmission(submission)}
                            type="button"
                          >
                            <T>{deletingAnalysisSubmissionId === submission.id ? "Өчүрүү..." : "Өчүрүү"}</T>
                          </button>
                          {isRegionalSubunitAnalysis ? (
                            <button onClick={() => setForwardingSubmission(submission)} type="button"><T>{"Жөнөтүү"}</T></button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="dashboard-state">
                    <T>{isRegionalSubunitAnalysis
                      ? "Кирген документтер азырынча жок."
                      : "Жөнөтүлгөн документтер азырынча жок."}</T>
                  </p>
                )}
                {isRegionalSubunitAnalysis ? (
                  <>
                    <h3><T>{"Чыгыш"}</T></h3>
                    {currentRegionalOutgoingSubmissions.length > 0 ? (
                      <div className="saved-table-list">
                        {currentRegionalOutgoingSubmissions.map((submission) => (
                          <article
                            className="saved-table-card"
                            key={`analysis-outgoing-${submission.id}`}
                            onClick={() => openAnalysisSubmission(submission)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openAnalysisSubmission(submission);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <strong><T>{submission.documentTitle}</T></strong>
                            <div
                              className="saved-table-card__actions"
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <SubmissionEditPermissionButton
                                onUpdated={(updated) => setAnalysisSubmissions((items) => items.map((item) => item.id === updated.id ? updated : item))}
                                submission={submission}
                              />
                              <button disabled={deletingAnalysisSubmissionId === submission.id} onClick={() => handleDeleteAnalysisSubmission(submission)} type="button">
                                <T>{deletingAnalysisSubmissionId === submission.id ? "Өчүрүү..." : "Өчүрүү"}</T>
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : <p className="dashboard-state"><T>{"Жөнөтүлгөн документтер азырынча жок."}</T></p>}
                  </>
                ) : null}
              </div>
            ) : null}
            <SubmissionForwardDialog
              onClose={() => setForwardingSubmission(null)}
              onForward={async (submission, title) => {
                const forwarded = await forwardThematicAccountSubmission(submission.id, title);
                setAnalysisSubmissions((items) => [forwarded, ...items]);
              }}
              submission={forwardingSubmission}
            />
            {isCreateDialogOpen ? (
              <div className="lesson-period-dialog" role="dialog" aria-modal="true" aria-labelledby="monthly-analysis-create-title">
                <form
                  className="lesson-period-dialog__panel"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSaveMonthlyAnalysis();
                  }}
                >
                  <h2 id="monthly-analysis-create-title"><T>{"Жаратуу"}</T></h2>
                  <textarea
                    className="lesson-period-dialog__textarea"
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraftMonthlyAnalysisTitle(nextValue);
                      persistMonthlyAnalysisDraft({ draftTitle: nextValue });
                    }}
                    placeholder={currentAnalysisPlaceholder}
                    rows={5}
                    value={draftMonthlyAnalysisTitle}
                  />
                  <div className="lesson-period-dialog__actions">
                    <button onClick={() => setIsCreateDialogOpen(false)} type="button"><T>{"Жокко чыгаруу"}</T></button>
                    <button type="submit"><T>{"Сактоо"}</T></button>
                  </div>
                </form>
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty-state"><T>{"Маалымат жок"}</T></div>
        )}
      </section>
    );
  }

  return (
    <section className="module-panel">
      {user?.role === "regional" && selectedAnalyticsScope ? (
        <button
          className="module-back-button"
          onClick={() => {
            setSelectedAnalyticsScope(null);
            setSelectedSectionId(null);
            setIsMonthlyDocumentOpen(false);
            setSelectedAnalysisSubmission(null);
          }}
          type="button"
        ><T>{"Артка"}</T></button>
      ) : null}
      <header className="module-header">
        <h1><T>{"Күжүрмөн даярдоонун талдоолору"}</T></h1>
      </header>
      <div className="analysis-section-list">
        {analyticsSections.map((section) => (
          <article className="analysis-section-card" key={section.id}>
            <button
              className="analysis-section-card__open"
              onClick={() => handleSelectAnalyticsSection(section.id)}
              type="button"
            >
              <span aria-hidden="true" className="module-document-icon" />
              <strong><T>{section.title}</T></strong>
              {[
                MONTHLY_ANALYSIS_SECTION_ID,
                PERIOD_ANALYSIS_SECTION_ID,
                YEAR_ANALYSIS_SECTION_ID,
              ].includes(section.id) &&
              user?.role !== "admin" &&
              !isRegionalSubunitAnalysis
                ? renderAnalysisReportingStatus(
                    section.id === YEAR_ANALYSIS_SECTION_ID
                      ? latestOwnYearSubmission
                      : section.id === PERIOD_ANALYSIS_SECTION_ID
                        ? latestOwnPeriodSubmission
                        : latestOwnMonthlySubmission,
                    section.id
                  )
                : null}
            </button>
            {canEditAnalysis ? (
              <button
                className="analysis-section-card__edit"
                onClick={() => handleStartSectionEdit(section)}
                type="button"
              ><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Z M14 5l5 5"/></svg><T>{"Өзгөртүү"}</T></button>
            ) : null}
          </article>
        ))}
      </div>
      {editingSectionId && (
        <div className="lesson-period-dialog" role="dialog" aria-modal="true" aria-labelledby="analysis-section-edit-title">
          <form className="lesson-period-dialog__panel" onSubmit={handleSaveSectionTitle}>
            <h2 id="analysis-section-edit-title"><T>{"Аталышын өзгөртүү"}</T></h2>
            <input
              autoFocus
              className="lesson-period-dialog__input"
              onChange={(event) => setEditingSectionTitle(event.target.value)}
              required
              value={editingSectionTitle}
            />
            <div className="lesson-period-dialog__actions">
              <button
                onClick={() => {
                  setEditingSectionId(null);
                  setEditingSectionTitle("");
                }}
                type="button"
              ><T>{"Жокко чыгаруу"}</T></button>
              <button type="submit"><T>{"Сактоо"}</T></button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}



