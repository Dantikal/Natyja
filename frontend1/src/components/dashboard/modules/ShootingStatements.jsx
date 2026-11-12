import {useLanguage as useCopyLanguage} from "../../../i18n.jsx";
import { T } from "../../../i18n.jsx";
import React, { useEffect, useMemo, useState } from "react";

import {
  forwardThematicAccountSubmission,
  getOutpostRatings,
  getRegionalUnitRatings,
  getThematicAccountSubmissions,
  markThematicAccountSubmissionRead,
} from "../../../api/dashboard.js";
import { formatOutpostName } from "../../../data/militaryUnits.js";
import { isShootingSubmission } from "../../../utils/shootingSubmissions.js";
import { getDocumentRegistrationCode } from "../../../utils/documentRegistration.js";
import CombatTrainingResults, { createShootingTrainingTable } from "./CombatTrainingResults.jsx";
import SubmissionForwardDialog from "./SubmissionForwardDialog.jsx";

const SECTION_ID = "shooting-statements";

const makeDocumentId = () =>
  `shooting-statement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function ShootingStatements({ user }) {
 const {t:copyT}=useCopyLanguage();

  const storageKey = `shooting-statements:${user?.id || user?.email || user?.role || "user"}`;
  const hiddenOutgoingStorageKey = `shooting-statements-hidden-outgoing:${user?.id || "user"}`;
  const [documents, setDocuments] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  });
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [forwardingSubmission, setForwardingSubmission] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [selectedUnitNumber, setSelectedUnitNumber] = useState(null);
  const [selectedOutpostName, setSelectedOutpostName] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hiddenOutgoingIds, setHiddenOutgoingIds] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(hiddenOutgoingStorageKey) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError("");
    const directoryRequest = user?.role === "admin"
      ? getRegionalUnitRatings()
      : user?.role === "regional"
        ? getOutpostRatings()
        : Promise.resolve([]);
    Promise.all([getThematicAccountSubmissions(undefined, ["shooting-statements"]), directoryRequest])
      .then(([items, directoryItems]) => {
        if (isCurrent) {
          setSubmissions((Array.isArray(items) ? items : []).filter(
            isShootingSubmission,
          ));
          setDirectory(user?.role === "admin" ? directoryItems.units || [] : directoryItems || []);
        }
      })
      .catch(() => {
        if (isCurrent) setError("Документтерди жүктөө мүмкүн болгон жок.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => { isCurrent = false; };
  }, [user?.id, user?.role]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(documents));
  }, [documents, storageKey]);

  useEffect(() => {
    window.localStorage.setItem(hiddenOutgoingStorageKey, JSON.stringify(hiddenOutgoingIds));
  }, [hiddenOutgoingIds, hiddenOutgoingStorageKey]);

  const activeDocument = documents.find((item) => item.id === activeDocumentId);
  const editorData = useMemo(() => {
    if (!activeDocument) return null;
    return {
      directEditor: true,
      allowResultSubmission: true,
      initialSectionId: "shooting-statements",
      initialSubsectionId: "shooting-statements-table",
      initialPeriodId: activeDocument.id,
      onBack: () => setActiveDocumentId(null),
      onSubmissionCreated: (submission) => {
        setSubmissions((items) => [submission, ...items.filter((item) => item.id !== submission.id)]);
        setDocuments((items) => items.filter((item) => item.id !== activeDocument.id));
        setActiveDocumentId(null);
      },
      submissionPeriodId: activeDocument.id,
      submissionSectionId: SECTION_ID,
      sections: [
        {
          id: "shooting-statements",
          title: "Ок атуунун ведомосттору",
          sections: [
            {
              id: "shooting-statements-table",
              title: "Ок атуу даярдыгы",
              periods: [
                {
                  id: activeDocument.id,
                  title: activeDocument.title,
                  table: createShootingTrainingTable(activeDocument.title),
                },
              ],
            },
          ],
        },
      ],
    };
  }, [activeDocument]);

  const incoming = useMemo(() => {
    if (user?.role === "regional") return submissions.filter((item) => item.senderRole === "outpost");
    if (user?.role === "admin") return submissions.filter((item) => item.senderRole === "regional");
    return [];
  }, [submissions, user?.role]);
  const outgoing = useMemo(() => {
    if (user?.role === "outpost") return submissions.filter((item) => item.senderId === user?.id);
    if (user?.role === "regional") return submissions.filter((item) => item.senderId === user?.id);
    return [];
  }, [submissions, user?.id, user?.role]);

  const handleCreate = (event) => {
    event.preventDefault();
    const title = documentTitle.trim();
    if (!title) {
      setError("Документтин аталышын жазыңыз.");
      return;
    }

    const document = { id: makeDocumentId(), title, createdAt: new Date().toISOString() };
    setDocuments((items) => [document, ...items]);
    setDocumentTitle("");
    setError("");
    setIsCreateOpen(false);
    setActiveDocumentId(document.id);
  };

  const handleDelete = (document) => {
    if (!window.confirm(`«${document.title}» өчүрүлсүнбү?`)) return;
    setDocuments((items) => items.filter((item) => item.id !== document.id));
  };

  const handleForward = async (submission, title) => {
    const forwarded = await forwardThematicAccountSubmission(submission.id, title);
    setSubmissions((items) => [forwarded, ...items.filter((item) => item.id !== forwarded.id)]);
  };

  const handleOpenSubmission = (submission) => {
    setActiveSubmission(submission);
    if (submission.isRead) return;
    setSubmissions((items) => items.map((item) => item.id === submission.id ? { ...item, isRead: true } : item));
    markThematicAccountSubmissionRead(submission.id).catch(() => {
      setSubmissions((items) => items.map((item) => item.id === submission.id ? { ...item, isRead: false } : item));
    });
  };

  const handleHideOutgoing = (submission) => {
    if (!window.confirm(`«${submission.documentTitle}» өзүңүздүн тизмеңизден өчүрүлсүнбү?`)) return;
    setHiddenOutgoingIds((ids) => ids.includes(submission.id) ? ids : [...ids, submission.id]);
  };

  if (activeDocument && editorData) {
    return (
      <CombatTrainingResults
        data={editorData}
        key={activeDocument.id}
        user={user}
      />
    );
  }

  if (activeSubmission) {
    return (
      <CombatTrainingResults
        data={{
          directEditor: true,
          directSingleSubmission: activeSubmission.sectionId === SECTION_ID,
          initialResultSubmission: activeSubmission,
          onBack: () => setActiveSubmission(null),
          sections: activeSubmission.sectionId === SECTION_ID ? [] : undefined,
        }}
        key={`shooting-submission-${activeSubmission.id}`}
        user={user}
      />
    );
  }

  const renderSubmissions = (title, items, canForward = false, canHide = false) => (
    <div className="module-submission-list">
      <h2><T>{title}</T></h2>
      {items.filter((submission) => !canHide || !hiddenOutgoingIds.includes(submission.id)).length ? <div className="module-period-list">{items.filter((submission) => !canHide || !hiddenOutgoingIds.includes(submission.id)).map((submission) => (
        <div className="module-period-row" key={submission.id}>
          <button className="module-period-card module-period-card--document" onClick={() => handleOpenSubmission(submission)} type="button">
            <span aria-hidden="true" className="module-document-icon" />
            <span className="module-submission-card__content">
              <strong><T>{submission.documentTitle}</T></strong>
              <small><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(submission)}</small>
              <small>{submission.senderName || submission.outpostName || submission.unitNumber}</small>
            </span>
          </button>
          {canForward || canHide ? <div className="module-period-actions">
            {canForward ? <button onClick={() => setForwardingSubmission(submission)} type="button"><T>{"Администраторго жөнөтүү"}</T></button> : null}
            {canHide ? <button onClick={() => handleHideOutgoing(submission)} type="button"><T>{"Өчүрүү"}</T></button> : null}
          </div> : null}
        </div>
      ))}</div> : <p className="dashboard-state"><T>{"Документтер азырынча жок."}</T></p>}
    </div>
  );

  const renderDirectoryCards = (items, type) => (
    <div className="module-document-list">
      {items.map((item) => {
        const unitNumber = String(item.unitNumber || "");
        const outpostName = item.outpostName || "";
        const matching = submissions.filter((submission) =>
          type === "units"
            ? String(submission.unitNumber) === unitNumber
            : String(submission.unitNumber) === String(selectedUnitNumber || user?.region) && formatOutpostName(submission.outpostName) === formatOutpostName(outpostName)
        );
        const unread = matching.filter((submission) => !submission.isRead).length;
        return <button
          className="module-document-card shooting-statements-directory-card"
          key={type === "units" ? unitNumber : outpostName}
          onClick={() => type === "units" ? setSelectedUnitNumber(unitNumber) : setSelectedOutpostName(outpostName)}
          type="button"
        >
          <span aria-hidden="true" className="module-document-icon" />
          <strong><T>{type === "units" ? `${unitNumber} аскер бөлүгү` : outpostName}</T></strong>
          {unread > 0 ? <span className="shooting-statements-directory-card__badge">{unread}</span> : null}
        </button>;
      })}
    </div>
  );

  if (isLoading) {
    return <section className="module-panel" aria-busy="true"><p className="dashboard-state" role="status"><T>{"Загрузка документов…"}</T></p></section>;
  }

  if (error && ["admin", "regional"].includes(user?.role)) {
    return <section className="module-panel"><p className="dashboard-state error" role="alert"><T>{error}</T></p></section>;
  }

  if (user?.role === "admin" && !selectedUnitNumber) {
    return <section className="module-panel">
      <header className="module-header"><div><p className="eyebrow"><T>{"Аскер бөлүктөрү"}</T></p><h1><T>{"Ок атуунун ведомосттору"}</T></h1></div></header>
      {renderDirectoryCards(directory, "units")}
    </section>;
  }

  if (["admin", "regional"].includes(user?.role) && selectedOutpostName) {
    const unitNumber = selectedUnitNumber || user?.region;
    const outpostDocuments = submissions.filter((item) =>
      item.senderRole === "outpost" && String(item.unitNumber) === String(unitNumber) && formatOutpostName(item.outpostName) === formatOutpostName(selectedOutpostName)
    );
    return <section className="module-panel">
      <button className="module-back-button" onClick={() => setSelectedOutpostName(null)} type="button"><T>{"Артка"}</T></button>
      <header className="module-header"><div><p className="eyebrow">{unitNumber}<T>{" аскер бөлүгү"}</T></p><h1>{selectedOutpostName}</h1></div></header>
      {renderSubmissions("Заставадан жөнөтүлгөн документтер", outpostDocuments, user?.role === "regional")}
      <SubmissionForwardDialog onClose={() => setForwardingSubmission(null)} onForward={handleForward} submission={forwardingSubmission} />
    </section>;
  }

  if (user?.role === "admin" && selectedUnitNumber) {
    const selectedUnit = directory.find((item) => String(item.unitNumber) === String(selectedUnitNumber));
    const unitDocuments = submissions.filter((item) => item.senderRole === "regional" && String(item.unitNumber) === String(selectedUnitNumber));
    return <section className="module-panel">
      <button className="module-back-button" onClick={() => setSelectedUnitNumber(null)} type="button"><T>{"Артка"}</T></button>
      <header className="module-header"><div><p className="eyebrow"><T>{"Аскер бөлүгү"}</T></p><h1>{selectedUnitNumber}</h1></div></header>
      {renderSubmissions("Аскер бөлүктөн жөнөтүлгөн документтер", unitDocuments)}
      <div className="module-submission-list"><h2><T>{"Заставалар"}</T></h2>{renderDirectoryCards(selectedUnit?.outposts || [], "outposts")}</div>
    </section>;
  }

  return (
    <section className="module-panel">
      <div className="module-header-row">
        <div>
          <p className="eyebrow"><T>{"Иш кагаздар"}</T></p>
          <h1><T>{"Ок атуунун ведомосттору"}</T></h1>
        </div>
        {user?.role !== "admin" ? <button
          className="module-action-button"
          onClick={() => {
            setDocumentTitle("");
            setError("");
            setIsCreateOpen(true);
          }}
          type="button"
        ><T>{"+ Түзүү"}</T></button> : null}
      </div>

      {isLoading ? <p className="dashboard-state"><T>{"Документтер жүктөлүүдө..."}</T></p> : null}
      {user?.role !== "admin" && documents.length > 0 ? (
        <div className="module-period-list">
          {documents.map((document) => (
            <div className="module-period-row" key={document.id}>
              <button
                className="module-period-card module-period-card--document"
                onClick={() => setActiveDocumentId(document.id)}
                type="button"
              >
                <span aria-hidden="true" className="module-document-icon" />
                <span className="module-submission-card__content">
                  <strong>{document.title}</strong>
                  <small>{new Date(document.createdAt).toLocaleString("ky-KG")}</small>
                </span>
              </button>
              <div className="module-period-actions">
                <button onClick={() => handleDelete(document)} type="button"><T>{"Өчүрүү"}</T></button>
              </div>
            </div>
          ))}
        </div>
      ) : user?.role !== "admin" ? (
        <p className="dashboard-state"><T>{"Азырынча ведомость түзүлө элек."}</T></p>
      ) : null}

      {user?.role === "regional" ? (
        <>
          {renderSubmissions("Мен жөнөткөн документтер", outgoing, false, true)}
          <div className="module-submission-list">
            <h2><T>{"Заставалар"}</T></h2>
            {renderDirectoryCards(directory, "outposts")}
          </div>
        </>
      ) : (
        <>
          {user?.role !== "outpost" ? renderSubmissions("Кириш", incoming) : null}
          {renderSubmissions("Чыгыш", outgoing)}
        </>
      )}

      {isCreateOpen ? (
        <div className="lesson-period-dialog" role="dialog" aria-modal="true" aria-labelledby="shooting-statement-create-title">
          <form className="lesson-period-dialog__panel" onSubmit={handleCreate}>
            <h2 id="shooting-statement-create-title"><T>{"Жаңы ведомость түзүү"}</T></h2>
            <label><T>{"Документтин аталышы"}</T><input
                autoFocus
                onChange={(event) => setDocumentTitle(event.target.value)}
                placeholder={copyT("Документтин аталышын жазыңыз")}
                value={documentTitle}
              />
            </label>
            {error ? <p className="form-error"><T>{error}</T></p> : null}
            <div className="lesson-period-dialog__actions">
              <button onClick={() => setIsCreateOpen(false)} type="button"><T>{"Жокко чыгаруу"}</T></button>
              <button type="submit"><T>{"Түзүү"}</T></button>
            </div>
          </form>
        </div>
      ) : null}
      <SubmissionForwardDialog
        onClose={() => setForwardingSubmission(null)}
        onForward={handleForward}
        submission={forwardingSubmission}
      />
    </section>
  );
}
