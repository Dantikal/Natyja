import { moduleNavigationKey } from "../../../utils/moduleNavigation.js";
import { T } from "../../../i18n.jsx";
import { useHistoryState } from "../../../hooks/useHistoryState.js";
import React, { useEffect, useMemo, useState } from "react";

import {
  deleteCombatTrainingJournalRevision,
  deleteThematicAccountSubmission,
  getCombatTrainingJournalSubjects,
  getThematicAccountSubmissions,
} from "../../../api/dashboard.js";
import { getDocumentRegistrationCode } from "../../../utils/documentRegistration.js";
import Analytics from "./Analytics.jsx";
import {
  buildSubjectJournalTable,
  buildSubjectRegistrationTitle,
} from "./CombatTrainingJournal.jsx";
import CombatTrainingResults, {
  createCustomTable,
  createKojTable,
  createLineTrainingTable,
  createPhysicalTrainingTable,
  createShootingTrainingTable,
} from "./CombatTrainingResults.jsx";
import MilitaryUnitIcon from "./MilitaryUnitIcon.jsx";
import Library, {
  buildLessonScheduleLikePhoto,
  buildThematicAccountLikePhoto,
} from "./Library.jsx";

const MEETING_SECTIONS = [
  { id: "thematic-account", title: "Сабактын тематикалык эсеби" },
  { id: "lesson-schedule", title: "Сабактардын жүгүртмөсү" },
  { id: "combat-training-journal", title: "Күжүрмөн даярдоону каттоо журналы" },
  { id: "observation", title: "Көзөмөл сабактары" },
  { id: "meeting-analysis", title: "Жыйындын талдоосу" },
];
const PERSONNEL_JOURNAL_TITLE =
  "Өздүк курамдын күжүрмөн даярдоосунун каттоо журналы";

const OBSERVATION_TEMPLATE_OPTIONS = [
  {
    id: "tpv",
    title: "Чек ара аскерлеринин тактикасы",
    createTable: createCustomTable,
  },
  {
    id: "ogp",
    title: "Коомдук мамлекеттик даярдоо",
    createTable: createCustomTable,
  },
  {
    id: "fp",
    title: "Дене тарбиялык даярдоо",
    createTable: createPhysicalTrainingTable,
  },
  {
    id: "spec",
    title: "Атайын даярдоо",
    createTable: createCustomTable,
  },
  {
    id: "tp",
    title: "Тактикалык даярдоо",
    createTable: createCustomTable,
  },
  {
    id: "op",
    title: "Ок атуу даярдыгы",
    createTable: createShootingTrainingTable,
  },
  {
    id: "stp",
    title: "Саптык даярдоо",
    createTable: createLineTrainingTable,
  },
  {
    id: "ovu",
    title: "Жалпы аскердик устав",
    createTable: createCustomTable,
  },
  {
    id: "koj",
    title: "Күжүрмөн ок атуулардын жыйынтыгы",
    createTable: createKojTable,
  },
];

const LEGACY_OBSERVATION_TEMPLATE_IDS = {
  line: "stp",
  physical: "fp",
  shooting: "op",
};

const getObservationTemplate = (templateId) => {
  const normalizedTemplateId =
    LEGACY_OBSERVATION_TEMPLATE_IDS[templateId] || templateId;
  return OBSERVATION_TEMPLATE_OPTIONS.find(
    (option) => option.id === normalizedTemplateId
  ) || OBSERVATION_TEMPLATE_OPTIONS[0];
};

const getNestedSections = (section) =>
  section?.sections || section?.subsections || [];

const findSection = (sections, sectionId) => {
  for (const section of sections || []) {
    if (section?.id === sectionId) return section;
    const nestedSection = findSection(getNestedSections(section), sectionId);
    if (nestedSection) return nestedSection;
  }
  return null;
};

const getFirstTablePeriod = (section) =>
  (section?.periods || []).find((period) => period?.table) || null;

const createDocumentId = (sectionId) =>
  `meetings-${sectionId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const SUBMISSION_SECTION_SUFFIXES = {
  "thematic-account": "thematic-account",
  "lesson-schedule": "lesson-schedule",
  "combat-training-journal": "combat-training-journal",
  observation: "observation",
  "meeting-analysis": "analysis",
};

const getSubmissionPrefix = (storageNamespace) =>
  storageNamespace === "young-soldier-training-course"
    ? "young-soldier"
    : "meetings";

const getSubmissionSectionId = (storageNamespace, sectionId) =>
  `${getSubmissionPrefix(storageNamespace)}-${
    SUBMISSION_SECTION_SUFFIXES[sectionId] || sectionId
  }`;

export default function Meetings({
  adminExtraCard,
  adminExtraCards,
  allowedUnitNumbers,
  analysisSourceSectionId,
  disableAdminBrowser = false,
  directSectionId,
  moduleTitle = "Жыйындар",
  modules,
  onBack,
  sectionIds,
  sectionTitleOverrides,
  storageNamespace = "meetings",
  user,
}) {
  const [selectedSectionId, setSelectedSectionId] = useHistoryState(moduleNavigationKey("Meetings", user, { storageNamespace, directEditor: Boolean(directSectionId), initialSectionId: directSectionId }), 
    directSectionId || null
  );
  const [documents, setDocuments] = useState([]);
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [createSectionId, setCreateSectionId] = useState(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [observationTemplateId, setObservationTemplateId] = useState(
    OBSERVATION_TEMPLATE_OPTIONS[0].id
  );
  const [createError, setCreateError] = useState("");
  const [adminSubmissions, setAdminSubmissions] = useState([]);
  const [adminSubmissionsLoading, setAdminSubmissionsLoading] = useState(false);
  const [selectedAdminUnitNumber, setSelectedAdminUnitNumber] = useState(null);
  const [selectedAdminSectionId, setSelectedAdminSectionId] = useState(null);
  const [selectedAdminSubmission, setSelectedAdminSubmission] = useState(null);
  const [journalSubjects, setJournalSubjects] = useState([]);
  const [journalSubjectsLoading, setJournalSubjectsLoading] = useState(false);
  const [journalSubjectsError, setJournalSubjectsError] = useState("");
  const [deletingJournalRevisionId, setDeletingJournalRevisionId] = useState(null);

  const visibleSections = (sectionIds
    ? MEETING_SECTIONS.filter((section) => sectionIds.includes(section.id))
    : MEETING_SECTIONS
  ).map((section) => ({
    ...section,
    title: sectionTitleOverrides?.[section.id] || section.title,
  }));
  const meetingsScope =
    `${modules?.library?.scope || user?.role || "default"}:${storageNamespace}`;
  const documentsStorageKey = `munara-meetings-documents:${meetingsScope}`;
  const legacyObservationStorageKey =
    `munara-meetings-observation-documents:${meetingsScope}`;
  const selectedSection = visibleSections.find(
    (section) => section.id === selectedSectionId
  );
  const sectionDocuments = documents.filter(
    (document) => document.sectionId === selectedSectionId
  );
  const activeDocument = documents.find(
    (document) => document.id === activeDocumentId
  );
  const submissionSectionId = selectedSectionId
    ? getSubmissionSectionId(storageNamespace, selectedSectionId)
    : "";
  const adminUnitNumbers = Array.from(
    new Set(
      [
        ...(modules?.combatTrainingResults?.unitNumbers || []),
        ...adminSubmissions.map((submission) => submission.unitNumber),
      ]
        .map((unitNumber) => String(unitNumber || "").trim())
        .filter(
          (unitNumber) =>
            unitNumber &&
            (!allowedUnitNumbers || allowedUnitNumbers.includes(unitNumber))
        )
    )
  );
  const selectedAdminSection = visibleSections.find(
    (section) => section.id === selectedAdminSectionId
  );
  const selectedAdminSectionSubmissions = adminSubmissions.filter(
    (submission) =>
      String(submission.unitNumber) === String(selectedAdminUnitNumber) &&
      submission.senderRole === "regional" &&
      submission.sectionId ===
        getSubmissionSectionId(storageNamespace, selectedAdminSectionId)
  );
  const ownSectionSubmissions = selectedSectionId
    ? adminSubmissions.filter(
        (submission) =>
          String(submission.senderId) === String(user?.id) &&
          submission.sectionId ===
            getSubmissionSectionId(storageNamespace, selectedSectionId)
      )
    : [];

  useEffect(() => {
    if (directSectionId) {
      setSelectedSectionId(directSectionId);
      setActiveDocumentId(null);
      setCreateSectionId(null);
    }
  }, [directSectionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedDocuments = JSON.parse(
        window.localStorage.getItem(documentsStorageKey) || "[]"
      );
      const legacyObservationDocuments = JSON.parse(
        window.localStorage.getItem(legacyObservationStorageKey) || "[]"
      );
      const normalizedDocuments = Array.isArray(storedDocuments)
        ? storedDocuments
        : [];
      const migratedObservationDocuments = Array.isArray(legacyObservationDocuments)
        ? legacyObservationDocuments.map((document) => ({
            ...document,
            sectionId: "observation",
          }))
        : [];
      const knownIds = new Set(normalizedDocuments.map((document) => document.id));
      const mergedDocuments = [
        ...normalizedDocuments,
        ...migratedObservationDocuments.filter(
          (document) => !knownIds.has(document.id)
        ),
      ];

      setDocuments(mergedDocuments);
      if (migratedObservationDocuments.length > 0) {
        window.localStorage.setItem(
          documentsStorageKey,
          JSON.stringify(mergedDocuments)
        );
        window.localStorage.removeItem(legacyObservationStorageKey);
      }
    } catch {
      setDocuments([]);
    }
  }, [documentsStorageKey, legacyObservationStorageKey]);

  useEffect(() => {
    if (
      !["admin", "regional", "outpost"].includes(user?.role) ||
      (user?.role === "admin" && disableAdminBrowser)
    ) {
      return undefined;
    }

    let isCurrent = true;
    setAdminSubmissionsLoading(true);
    getThematicAccountSubmissions(undefined, visibleSections.map((section) =>
      getSubmissionSectionId(storageNamespace, section.id)
    ))
      .then((items) => {
        if (!isCurrent) return;
        const allowedSectionIds = new Set(
          visibleSections.map((section) =>
            getSubmissionSectionId(storageNamespace, section.id)
          )
        );
        setAdminSubmissions(
          (Array.isArray(items) ? items : []).filter((submission) =>
            allowedSectionIds.has(submission.sectionId)
          )
        );
      })
      .catch(() => {
        if (isCurrent) setAdminSubmissions([]);
      })
      .finally(() => {
        if (isCurrent) setAdminSubmissionsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [disableAdminBrowser, storageNamespace, user?.id, user?.role]);

  useEffect(() => {
    const isUserJournalOpen =
      user?.role !== "admin" &&
      selectedSectionId === "combat-training-journal";
    const isAdminJournalOpen =
      user?.role === "admin" &&
      selectedAdminSectionId === "combat-training-journal" &&
      Boolean(selectedAdminUnitNumber);

    if (!isUserJournalOpen && !isAdminJournalOpen) {
      return undefined;
    }

    let isCurrent = true;
    setJournalSubjects([]);
    setJournalSubjectsLoading(true);
    setJournalSubjectsError("");
    getCombatTrainingJournalSubjects(
      isAdminJournalOpen ? selectedAdminUnitNumber : undefined
    )
      .then((items) => {
        if (isCurrent) {
          setJournalSubjects(Array.isArray(items) ? items : []);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setJournalSubjects([]);
          setJournalSubjectsError(
            "Предметтердин тизмесин жүктөө мүмкүн болгон жок."
          );
        }
      })
      .finally(() => {
        if (isCurrent) setJournalSubjectsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [
    selectedAdminSectionId,
    selectedAdminUnitNumber,
    selectedSectionId,
    user?.id,
    user?.role,
  ]);

  const saveDocuments = (nextDocuments) => {
    setDocuments(nextDocuments);
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        documentsStorageKey,
        JSON.stringify(nextDocuments)
      );
    } catch {
      // The current session remains usable if browser storage is unavailable.
    }
  };

  const tableBySection = useMemo(() => {
    const librarySections = modules?.library?.sections || [];
    const thematicPeriod = getFirstTablePeriod(
      findSection(librarySections, "thematic-account")
    );
    const lessonSchedulePeriod = getFirstTablePeriod(
      findSection(librarySections, "lesson-schedule")
    );
    const thematicSource = thematicPeriod?.table || {
      title: "Сабактын тематикалык эсеби",
    };
    const lessonScheduleSource = lessonSchedulePeriod?.table || {
      title: "Сабактардын жүгүртмөсү",
      variant: "lesson-schedule",
    };

    return {
      "thematic-account": buildThematicAccountLikePhoto(
        thematicSource,
        false,
        thematicPeriod?.id || "period-1"
      ),
      "lesson-schedule": buildLessonScheduleLikePhoto(lessonScheduleSource),
      "combat-training-journal": buildSubjectJournalTable(
        "Өздүк курамдын күжүрмөн даярдоосунун каттоо журналы",
        {
          enableCellColoring: true,
          hideDate: true,
        }
      ),
    };
  }, [modules?.library?.sections]);

  const openCreateDialog = (sectionId) => {
    setCreateSectionId(sectionId);
    setDocumentTitle("");
    setObservationTemplateId(OBSERVATION_TEMPLATE_OPTIONS[0].id);
    setCreateError("");
  };

  const handleCreateDocument = (event) => {
    event.preventDefault();
    const title = documentTitle.trim();
    if (!title) {
      setCreateError("Документтин аталышын жазыңыз.");
      return;
    }

    const document = {
      createdAt: new Date().toISOString(),
      id: createDocumentId(createSectionId),
      sectionId: createSectionId,
      templateId:
        createSectionId === "observation" ? observationTemplateId : null,
      title,
    };
    saveDocuments([document, ...documents]);
    setCreateSectionId(null);
    setDocumentTitle("");
    setCreateError("");
    setActiveDocumentId(document.id);
  };

  const handleRenameDocument = (document) => {
    const title = window.prompt("Документтин аталышы", document.title)?.trim();
    if (!title) return;

    saveDocuments(
      documents.map((item) =>
        item.id === document.id ? { ...item, title } : item
      )
    );

    if (typeof window !== "undefined") {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key?.includes(document.id) && key.endsWith(":title")) {
          window.localStorage.setItem(key, title);
        }
      }
      window.localStorage.setItem(
        `combat-training-results-custom-periods-${document.id}-title`,
        title
      );
    }
  };

  const removeLocalDocument = (document) => {
    saveDocuments(documents.filter((item) => item.id !== document.id));
    if (activeDocumentId === document.id) setActiveDocumentId(null);

    if (typeof window !== "undefined") {
      const keysToDelete = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key?.includes(document.id)) keysToDelete.push(key);
      }
      keysToDelete.forEach((key) => window.localStorage.removeItem(key));
    }
  };

  const handleDeleteDocument = (document) => {
    if (!window.confirm(`"${document.title}" өчүрүлсүнбү?`)) return;
    removeLocalDocument(document);
  };

  const handleSubmissionCreated = (submission) => {
    setAdminSubmissions((items) => [
      submission,
      ...items.filter((item) => item.id !== submission.id),
    ]);
  };

  const handleDeleteOutgoingSubmission = async (submission) => {
    if (!window.confirm(`"${submission.documentTitle}" өчүрүлсүнбү?`)) return;

    try {
      await deleteThematicAccountSubmission(submission.id);
      setAdminSubmissions((items) =>
        items.filter((item) => item.id !== submission.id)
      );
      const localDocument = documents.find(
        (document) => String(document.id) === String(submission.periodId)
      );
      if (localDocument) removeLocalDocument(localDocument);
    } catch {
      window.alert("Жөнөтүлгөн документти өчүрүү мүмкүн болгон жок.");
    }
  };

  const handleDeleteJournalRevision = async (submissionId, revision) => {
    if (!window.confirm("Бул жаңыртуу тарыхтан өчүрүлсүнбү?")) return;

    setDeletingJournalRevisionId(revision.id);
    try {
      await deleteCombatTrainingJournalRevision(revision.id);
      setAdminSubmissions((items) =>
        items.map((submission) =>
          submission.id === submissionId
            ? {
                ...submission,
                revisions: (submission.revisions || []).filter(
                  (item) => item.id !== revision.id
                ),
              }
            : submission
        )
      );
    } catch {
      window.alert("Журналдын жаңыртуусун өчүрүү мүмкүн болгон жок.");
    } finally {
      setDeletingJournalRevisionId(null);
    }
  };

  const openJournalSubject = (subject) => {
    const existingDocument = documents.find(
      (document) =>
        document.sectionId === "combat-training-journal" &&
        String(document.subjectId || "") === String(subject.id)
    );
    if (existingDocument) {
      setActiveDocumentId(existingDocument.id);
      return;
    }

    const document = {
      createdAt: new Date().toISOString(),
      id: createDocumentId("combat-training-journal"),
      sectionId: "combat-training-journal",
      subjectId: subject.id,
      subjectTitle: subject.title,
      title: buildSubjectRegistrationTitle(subject.title),
    };
    saveDocuments([document, ...documents]);
    setActiveDocumentId(document.id);
  };

  const renderOutgoingSubmissions = () => (
    <div className="module-submission-list">
      {selectedSectionId !== "combat-training-journal" ? (
        <>
          <h2><T>{"Чыгыш"}</T></h2>
          {ownSectionSubmissions.length > 0 ? (
            <div className="module-period-list">
              {ownSectionSubmissions.map((submission) => (
                <div className="module-period-row" key={`outgoing-${submission.id}`}>
                  <div className="module-period-card module-period-card--document">
                    <span aria-hidden="true" className="module-document-icon" />
                    <span className="module-submission-card__content">
                      <strong><T>{submission.documentTitle}</T></strong>
                      <small><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(submission)}</small>
                      <small><T>{"Жөнөтүлдү:"}</T>{" "}
                        {new Date(
                          submission.updatedAt || submission.createdAt
                        ).toLocaleString("ky-KG")}
                      </small>
                    </span>
                  </div>
                  <div className="module-period-actions">
                    <button
                      onClick={() => handleDeleteOutgoingSubmission(submission)}
                      type="button"
                    ><T>{"Өчүрүү"}</T></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-state"><T>{"Жөнөтүлгөн документтер азырынча жок."}</T></p>
          )}
        </>
      ) : (
        <>
          <h3><T>{"Жаңыртуулардын тарыхы"}</T></h3>
          {ownSectionSubmissions.some(
            (submission) => (submission.revisions || []).length > 0
          ) ? (
            <div className="module-period-list">
              {ownSectionSubmissions.flatMap((submission) =>
                (submission.revisions || []).map((revision) => (
                  <div
                    className="module-period-row"
                    key={`meeting-journal-revision-${revision.id}`}
                  >
                    <div className="module-period-card module-period-card--document">
                      <span aria-hidden="true" className="module-document-icon" />
                      <span className="module-submission-card__content">
                        <strong>{revision.documentTitle}</strong>
                        <small>
                          {new Date(revision.createdAt).toLocaleString("ky-KG")}
                        </small>
                      </span>
                    </div>
                    <div className="module-period-actions">
                      <button
                        disabled={deletingJournalRevisionId === revision.id}
                        onClick={() =>
                          handleDeleteJournalRevision(submission.id, revision)
                        }
                        type="button"
                      >
                        <T>{deletingJournalRevisionId === revision.id
                          ? "Өчүрүлүүдө..."
                          : "Өчүрүү"}</T>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p className="dashboard-state"><T>{"Азырынча жаңылоолор жок."}</T></p>
          )}
        </>
      )}
    </div>
  );

  if (
    user?.role === "admin" &&
    !disableAdminBrowser &&
    selectedAdminSubmission
  ) {
    const submittedDocument = selectedAdminSubmission.table?.document;
    const submittedTable =
      selectedAdminSubmission.table?.table || selectedAdminSubmission.table;

    if (submittedDocument) {
      const attachments = Array.isArray(submittedDocument.attachments)
        ? submittedDocument.attachments
        : [];
      const submittedAt = new Date(
        selectedAdminSubmission.createdAt || Date.now()
      );
      const registryMonth = String(submittedAt.getMonth() + 1).padStart(
        2,
        "0"
      );
      return (
        <section className="module-panel monthly-analysis-print-root">
          <button
            className="module-back-button"
            onClick={() => setSelectedAdminSubmission(null)}
            type="button"
          ><T>{"Артка"}</T></button>
          <header className="module-header">
            <h1>
              {submittedDocument.title ||
                selectedAdminSubmission.documentTitle}
            </h1>
          </header>
          {submittedDocument.registryNumber ? (
            <p className="monthly-analysis-registry-number">
              № {registryMonth}/{submittedDocument.registryNumber}
            </p>
          ) : null}
          {submittedDocument.addressee ? (
            <p>{submittedDocument.addressee}</p>
          ) : null}
          {submittedDocument.body ? (
            <div className="methodical-text-content">
              {submittedDocument.body}
            </div>
          ) : null}
          {(submittedDocument.extraPages || [])
            .filter((page) => String(page || "").trim())
            .map((page, index) => (
              <div
                className="methodical-text-content"
                key={`page-${index + 1}`}
              >
                {page}
              </div>
            ))}
          {submittedDocument.commanderTitle ||
          submittedDocument.commanderRank ||
          submittedDocument.commanderName ? (
            <div className="monthly-analysis-signature-block">
              <span>{submittedDocument.commanderTitle}</span>
              <span>{submittedDocument.commanderRank}</span>
              <strong>{submittedDocument.commanderName}</strong>
              {submittedDocument.commanderSignature ? (
                <img
                  alt="Кол тамга"
                  src={submittedDocument.commanderSignature}
                />
              ) : null}
            </div>
          ) : null}
          {attachments.length > 0 ? (
            <div className="monthly-analysis-attachments__grid">
              {attachments.map((attachment) => {
                const attachmentUrl =
                  attachment.dataUrl ||
                  attachment.url ||
                  attachment.objectUrl ||
                  attachment.fileUrl;
                return (
                  <div key={attachment.id || attachment.fileName}>
                    {attachment.type === "photo" && attachmentUrl ? (
                      <img
                        alt={attachment.fileName || "Материал"}
                        className="methodical-media methodical-media--image"
                        src={attachmentUrl}
                      />
                    ) : (
                      <a
                        href={attachmentUrl || undefined}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {attachment.fileName ||
                          attachment.name ||
                          attachment.originalName ||
                          "Материал"}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      );
    }

    return (
      <Library
        data={{
          description: "",
          hideSubmit: true,
          id: `admin-submission-${selectedAdminSubmission.id}`,
          scope: `admin-submission-${selectedAdminSubmission.id}`,
          table: {
            ...(submittedTable || {}),
            title:
              submittedTable?.title ||
              selectedAdminSubmission.documentTitle,
          },
          title: selectedAdminSubmission.documentTitle,
        }}
        key={selectedAdminSubmission.id}
        onBack={() => setSelectedAdminSubmission(null)}
      />
    );
  }

  if (
    user?.role === "admin" &&
    !disableAdminBrowser &&
    selectedAdminSection
  ) {
    if (selectedAdminSectionId === "combat-training-journal") {
      const getSubjectSubmission = (subject) =>
        selectedAdminSectionSubmissions.find(
          (submission) =>
            String(submission.table?.subjectId || "") === String(subject.id) ||
            String(submission.table?.subjectTitle || "").trim() ===
              String(subject.title || "").trim() ||
            String(submission.table?.title || "").includes(subject.title)
        );
      const journalUpdates = selectedAdminSectionSubmissions
        .flatMap((submission) =>
          (submission.revisions || []).map((revision) => ({
            ...revision,
            submissionId: submission.id,
            unitNumber: submission.unitNumber,
          }))
        )
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime()
        );

      return (
        <section className="module-panel">
          <button
            className="module-back-button"
            onClick={() => setSelectedAdminSectionId(null)}
            type="button"
          ><T>{"Артка"}</T></button>
          <header className="module-header">
            <h1><T>{selectedAdminSection.title}</T></h1>
          </header>
          <div className="combat-journal-subject-header">
            <div>
              <h2><T>{"Предметтер"}</T></h2>
              <p><T>{"Предметтердин саны: "}</T>{journalSubjects.length}</p>
            </div>
          </div>
          {journalSubjectsLoading ? (
            <p className="dashboard-state"><T>{"Предметтер жүктөлүүдө..."}</T></p>
          ) : journalSubjects.length > 0 ? (
            <div className="saved-table-list">
              {journalSubjects.map((subject, subjectIndex) => {
                const submission = getSubjectSubmission(subject);
                return (
                  <button
                    className="saved-table-card"
                    disabled={!submission}
                    key={subject.id}
                    onClick={() => {
                      if (submission) setSelectedAdminSubmission(submission);
                    }}
                    type="button"
                  >
                    <strong>{subjectIndex + 1}. {subject.title}</strong>
                    <span>
                      <T>{submission
                        ? `Акыркы жаңыртуу: ${new Date(
                            submission.updatedAt || submission.createdAt
                          ).toLocaleString("ky-KG")}`
                        : "Азырынча жаңылоолор жок"}</T>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="dashboard-state"><T>{"Бул аскер бөлүгү үчүн предметтер азырынча кошулган жок."}</T></p>
          )}
          {journalSubjectsError ? (
            <p className="dashboard-error">{journalSubjectsError}</p>
          ) : null}

          <div className="combat-journal-subject-header">
            <h2><T>{"Жаңыртуулардын тарыхы"}</T></h2>
          </div>
          {journalUpdates.length > 0 ? (
            <div className="module-period-list">
              {journalUpdates.map((revision) => (
                <div
                  className="module-period-row"
                  key={`admin-meeting-journal-revision-${revision.id}`}
                >
                  <button
                    className="module-period-card module-period-card--document"
                    onClick={() =>
                      setSelectedAdminSubmission({
                        id: `revision-${revision.id}`,
                        documentTitle: revision.documentTitle,
                        table: revision.table,
                      })
                    }
                    type="button"
                  >
                    <span aria-hidden="true" className="module-document-icon" />
                    <span className="module-submission-card__content">
                      <strong>{revision.documentTitle}</strong>
                      <small>
                        {new Date(revision.createdAt).toLocaleString("ky-KG")}
                      </small>
                    </span>
                  </button>
                  <div className="module-period-actions">
                    <button
                      disabled={deletingJournalRevisionId === revision.id}
                      onClick={() =>
                        handleDeleteJournalRevision(
                          revision.submissionId,
                          revision
                        )
                      }
                      type="button"
                    >
                      <T>{deletingJournalRevisionId === revision.id
                        ? "Өчүрүлүүдө..."
                        : "Өчүрүү"}</T>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-state"><T>{"Азырынча жаңылоолор жок."}</T></p>
          )}
        </section>
      );
    }

    return (
      <section className="module-panel">
        <button
          className="module-back-button"
          onClick={() => setSelectedAdminSectionId(null)}
          type="button"
        ><T>{"Артка"}</T></button>
        <header className="module-header">
          <h1><T>{selectedAdminSection.title}</T></h1>
        </header>
        {selectedAdminSectionSubmissions.length > 0 ? (
          <div className="module-period-list">
            {selectedAdminSectionSubmissions.map((submission) => (
              <div className="module-period-row" key={submission.id}>
                <button
                  className="module-period-card module-period-card--document"
                  onClick={() => setSelectedAdminSubmission(submission)}
                  type="button"
                >
                  <span aria-hidden="true" className="module-document-icon" />
                  <span className="module-submission-card__content">
                    <strong><T>{submission.documentTitle}</T></strong>
                    <small><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(submission)}</small>
                    <small>
                      {new Date(
                        submission.updatedAt || submission.createdAt
                      ).toLocaleString("ky-KG")}
                    </small>
                  </span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="dashboard-state"><T>{"Бул аскер бөлүгүнөн жөнөтүлгөн документтер азырынча жок."}</T></p>
        )}
      </section>
    );
  }

  if (
    user?.role === "admin" &&
    !disableAdminBrowser &&
    selectedAdminUnitNumber
  ) {
    return (
      <section className="module-panel">
        <button
          className="module-back-button"
          onClick={() => setSelectedAdminUnitNumber(null)}
          type="button"
        ><T>{"Артка"}</T></button>
        <header className="module-header">
          <h1>{selectedAdminUnitNumber}<T>{" аскер бөлүгү"}</T></h1>
        </header>
        <div className="module-document-list module-document-list--sequential">
          {visibleSections.map((section) => {
            const sectionSubmissionId = getSubmissionSectionId(
              storageNamespace,
              section.id
            );
            const sentCount = adminSubmissions.filter(
              (submission) =>
                String(submission.unitNumber) ===
                  String(selectedAdminUnitNumber) &&
                submission.senderRole === "regional" &&
                submission.sectionId === sectionSubmissionId
            ).length;
            return (
              <button
                className="module-document-card"
                key={section.id}
                onClick={() => setSelectedAdminSectionId(section.id)}
                type="button"
              >
                <span aria-hidden="true" className="module-document-icon" />
                <span className="module-submission-card__content">
                  <strong><T>{section.title}</T></strong>
                  <small><T>{"Жөнөтүлгөн документтер: "}</T>{sentCount}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (user?.role === "admin" && !disableAdminBrowser) {
    const extraCards = [
      ...(adminExtraCard ? [adminExtraCard] : []),
      ...(adminExtraCards || []),
    ];
    return (
      <section className="module-panel">
        {onBack ? (
          <button className="module-back-button" onClick={onBack} type="button"><T>{"Артка"}</T></button>
        ) : null}
        <header className="module-header">
          <h1><T>{moduleTitle}</T></h1>
        </header>
        <div className="module-document-list module-document-list--sequential">
          {extraCards.map((extraCard, index) => (
            <button
              className="module-document-card"
              key={extraCard.title}
              onClick={extraCard.onOpen}
              style={{ "--list-item-index": index }}
              type="button"
            >
              <span aria-hidden="true" className="module-document-icon" />
              <strong><T>{extraCard.title}</T></strong>
            </button>
          ))}
          {adminSubmissionsLoading ? (
            <p className="dashboard-state"><T>{"Маалымат жүктөлүүдө..."}</T></p>
          ) : (
            adminUnitNumbers.map((unitNumber, index) => (
              <button
                className="module-document-card"
                key={unitNumber}
                onClick={() => setSelectedAdminUnitNumber(unitNumber)}
                style={{ "--list-item-index": extraCards.length + index }}
                type="button"
              >
                <MilitaryUnitIcon unitNumber={unitNumber} />
                <strong>{unitNumber}<T>{" аскер бөлүгү"}</T></strong>
              </button>
            ))
          )}
        </div>
      </section>
    );
  }

  if (activeDocument?.sectionId === "observation") {
    const template = getObservationTemplate(activeDocument.templateId);
    const subsectionId = `meetings-observation-${template.id}`;

    return (
      <CombatTrainingResults
        data={{
          directEditor: true,
          hideModuleHeader: true,
          hideResultSubmissionActions: false,
          initialObservationGroupId: "regional-unit",
          initialPeriodId: activeDocument.id,
          initialSectionId: "observation",
          initialSubsectionId: subsectionId,
          onBack: () => setActiveDocumentId(null),
          onSubmissionCreated: handleSubmissionCreated,
          submissionPeriodId: activeDocument.id,
          submissionSectionId: getSubmissionSectionId(
            storageNamespace,
            activeDocument.sectionId
          ),
          sections: [
            {
              id: "observation",
              title: "Көзөмөл сабактары",
              sections: [
                {
                  id: subsectionId,
                  title: template.title,
                  periods: [
                    {
                      id: activeDocument.id,
                      table: template.createTable(activeDocument.title),
                      title: activeDocument.title,
                    },
                  ],
                },
              ],
            },
          ],
          unitNumbers: (modules?.combatTrainingResults?.unitNumbers || []).filter(
            (unitNumber) =>
              !allowedUnitNumbers ||
              allowedUnitNumbers.includes(String(unitNumber || "").trim())
          ),
        }}
        key={activeDocument.id}
        user={user}
      />
    );
  }

  if (activeDocument?.sectionId === "meeting-analysis") {
    return (
      <Analytics
        data={{
          directDocumentId: activeDocument.id,
          directDocumentTitle: activeDocument.title,
          directEditor: true,
          initialSectionId: "monthly-analysis",
          onBack: () => setActiveDocumentId(null),
          onSubmissionCreated: handleSubmissionCreated,
          registryCounterStorageKey: `munara-analysis-registry:${meetingsScope}`,
          storageNamespace: `${meetingsScope}:${activeDocument.id}`,
          submissionSourceSectionId: analysisSourceSectionId,
          submissionPeriodId: activeDocument.id,
          submissionSectionId: getSubmissionSectionId(
            storageNamespace,
            activeDocument.sectionId
          ),
        }}
        key={activeDocument.id}
        user={user}
      />
    );
  }

  if (activeDocument) {
    const template = tableBySection[activeDocument.sectionId];
    const table = template
      ? {
          ...template,
          subjectId: activeDocument.subjectId || null,
          subjectTitle: activeDocument.subjectTitle || "",
          title: activeDocument.title,
        }
      : null;

    return table ? (
      <Library
        data={{
          allowThematicMonthDeletion:
            activeDocument.sectionId === "thematic-account",
          description: "",
          directSubmissionUpdate:
            activeDocument.sectionId === "combat-training-journal",
          hideSubmit: false,
          id: activeDocument.id,
          scope: meetingsScope,
          requestSubmissionTitleOnUpdate:
            activeDocument.sectionId === "combat-training-journal",
          submissionDocumentTitle: activeDocument.title,
          submissionPeriodId: activeDocument.id,
          submissionSectionId: getSubmissionSectionId(
            storageNamespace,
            activeDocument.sectionId
          ),
          submissionActionLabel:
            activeDocument.sectionId === "combat-training-journal"
              ? "Жаңылоо"
              : undefined,
          table,
          title: activeDocument.title,
        }}
        key={activeDocument.id}
        onBack={() => setActiveDocumentId(null)}
        onSubmissionCreated={handleSubmissionCreated}
      />
    ) : (
      <section className="module-panel">
        <button
          className="module-back-button"
          onClick={() => setActiveDocumentId(null)}
          type="button"
        ><T>{"Артка"}</T></button>
        <p className="dashboard-state error"><T>{"Таблицанын шаблону табылган жок."}</T></p>
      </section>
    );
  }

  if (selectedSection?.id === "combat-training-journal") {
    return (
      <section className="module-panel">
        <button
          className="module-back-button"
          onClick={() => {
            if (directSectionId && onBack) {
              onBack();
              return;
            }
            setSelectedSectionId(null);
          }}
          type="button"
        ><T>{"Артка"}</T></button>
        <header className="module-header">
          <h1>{PERSONNEL_JOURNAL_TITLE}</h1>
        </header>
        <div className="combat-journal-subject-header">
          <h2><T>{"Окутуу түрлөрү боюнча сабактардын аталыштары"}</T></h2>
        </div>
        {journalSubjectsLoading ? (
          <p className="dashboard-state"><T>{"Предметтер жүктөлүүдө..."}</T></p>
        ) : journalSubjects.length > 0 ? (
          <div className="saved-table-list">
            {journalSubjects.map((subject) => (
              <button
                className="saved-table-card"
                key={subject.id}
                onClick={() => openJournalSubject(subject)}
                type="button"
              >
                <strong><T>{subject.title}</T></strong>
              </button>
            ))}
          </div>
        ) : (
          <p className="dashboard-state"><T>{"Предметтер азырынча жок."}</T></p>
        )}
        {journalSubjectsError ? (
          <p className="dashboard-error">{journalSubjectsError}</p>
        ) : null}
        {renderOutgoingSubmissions()}
      </section>
    );
  }

  if (selectedSection) {
    return (
      <section className="module-panel">
        <button
          className="module-back-button"
          onClick={() => {
            if (directSectionId && onBack) {
              onBack();
              return;
            }
            setSelectedSectionId(null);
          }}
          type="button"
        ><T>{"Артка"}</T></button>
        <header className="module-header">
          <h1><T>{selectedSection.title}</T></h1>
        </header>
        <div className="module-actions">
          <button
            className="module-action-button"
            onClick={() => openCreateDialog(selectedSection.id)}
            type="button"
          ><T>{"+ Кошуу"}</T></button>
        </div>
        {sectionDocuments.length > 0 ? (
          <div className="module-period-list">
            {sectionDocuments.map((document) => (
              <div className="module-period-row" key={document.id}>
                {(() => {
                  const sentSubmission = ownSectionSubmissions.find(
                    (submission) =>
                      String(submission.periodId) === String(document.id)
                  );
                  return (
                    <>
                <button
                  className="module-period-card module-period-card--document"
                  disabled={Boolean(sentSubmission)}
                  onClick={() => {
                    if (!sentSubmission) setActiveDocumentId(document.id);
                  }}
                  type="button"
                >
                  <span aria-hidden="true" className="module-document-icon" />
                  <span className="module-submission-card__content">
                    <strong>{document.title}</strong>
                    {document.sectionId === "observation" ? (
                      <small><T>{"Таблица катары"}</T>{" "}
                        <T>{getObservationTemplate(document.templateId).title}</T>
                      </small>
                    ) : null}
                    {sentSubmission ? <small><T>{"Жөнөтүлдү. Өзгөртүүгө болбойт."}</T></small> : null}
                  </span>
                </button>
                <div className="module-period-actions">
                  {!sentSubmission ? (
                      <button
                        onClick={() => handleRenameDocument(document)}
                        type="button"
                      ><T>{"Өзгөртүү"}</T></button>
                  ) : null}
                  <button
                    onClick={() =>
                      sentSubmission
                        ? handleDeleteOutgoingSubmission(sentSubmission)
                        : handleDeleteDocument(document)
                    }
                    type="button"
                  ><T>{"Өчүрүү"}</T></button>
                </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        ) : (
          <p className="dashboard-state"><T>{"Түзүлгөн документтер азырынча жок."}</T></p>
        )}
        {renderOutgoingSubmissions()}
        {createSectionId === selectedSection.id ? (
          <div
            className="lesson-period-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="meetings-create-title"
          >
            <form
              className="lesson-period-dialog__panel"
              onSubmit={handleCreateDocument}
            >
              <h2 id="meetings-create-title"><T>{selectedSection.title}</T></h2>
              <label><T>{"Аталышы"}</T><input
                  autoFocus
                  className="lesson-period-dialog__input"
                  onChange={(event) => setDocumentTitle(event.target.value)}
                  value={documentTitle}
                />
              </label>
              {selectedSection.id === "observation" ? (
                <label><T>{"Таблица"}</T><select
                    className="lesson-period-dialog__input"
                    onChange={(event) =>
                      setObservationTemplateId(event.target.value)
                    }
                    value={observationTemplateId}
                  >
                    {OBSERVATION_TEMPLATE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}><T>{"Таблица катары "}</T><T>{option.title}</T>
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {createError ? (
                <p className="lesson-period-dialog__error">{createError}</p>
              ) : null}
              <div className="lesson-period-dialog__actions">
                <button onClick={() => setCreateSectionId(null)} type="button"><T>{"Жокко чыгаруу"}</T></button>
                <button type="submit"><T>{"Кошуу"}</T></button>
              </div>
            </form>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="module-panel">
      {onBack ? (
        <button className="module-back-button" onClick={onBack} type="button"><T>{"Артка"}</T></button>
      ) : null}
      <header className="module-header">
        <h1><T>{moduleTitle}</T></h1>
      </header>
      <div className="module-document-list module-document-list--sequential">
        {visibleSections.map((section) => (
          <button
            className="module-document-card"
            key={section.id}
            onClick={() => {
              setSelectedSectionId(section.id);
              setActiveDocumentId(null);
              setCreateSectionId(null);
            }}
            type="button"
          >
            <span aria-hidden="true" className="module-document-icon" />
            <strong><T>{section.title}</T></strong>
          </button>
        ))}
      </div>
    </section>
  );
}
