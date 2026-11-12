import { T, useLanguage } from "../../../i18n.jsx";
import React, { useState } from "react";

import { getThematicAccountSubmissions } from "../../../api/dashboard.js";
import { getApiErrorMessage } from "../../../api/errors.js";
import { getDocumentRegistrationCode } from "../../../utils/documentRegistration.js";
import Analytics from "./Analytics.jsx";
import Library from "./Library.jsx";
import DocumentTemplateFrame from "./DocumentTemplateFrame.jsx";

const SECTION_LABELS = {
  "combat-training-analysis": "Күжүрмөн даярдоонун талдоосу",
  "combat-training-analysis-regional": "Күжүрмөн даярдоонун талдоосу",
  "command-lesson-schedule": "Командирдик даярдоонун сабактар жүгүртмөсү",
  "command-thematic-account": "Командирдик даярдоонун тематикалык эсеби",
  "lesson-schedule": "Сабактардын жүгүртмөсү",
  "memo-letter": "Билдирме кат",
  "thematic-account": "Сабактардын тематикалык эсеби",
  "typical-week": "Типтүү жумасы",
};

const findRenderableTable = (value, depth = 0) => {
  if (!value || typeof value !== "object" || depth > 4) return null;
  if (Array.isArray(value.columns) && Array.isArray(value.rows)) return value;
  for (const nestedValue of Object.values(value)) {
    const found = findRenderableTable(nestedValue, depth + 1);
    if (found) return found;
  }
  return null;
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleString("ky-KG") : "—";

export function RegisteredDocumentView({ document, onBack, user }) {
  return <DocumentTemplateFrame sectionId={document.sectionId} user={user}>
    <RegisteredDocumentContent document={document} onBack={onBack} user={user} />
  </DocumentTemplateFrame>;
}

function RegisteredDocumentContent({ document, onBack, user }) {
  if (document.table?.document) {
    return (
      <Analytics
        data={{
          directEditor: true,
          directSubmission: document,
          initialSectionId: document.table?.sectionId || "monthly-analysis",
          onBack,
          simpleLetterEditor: true,
          storageNamespace: `document-registry:${document.id}`,
        }}
        key={document.id}
        user={user}
      />
    );
  }

  const table = findRenderableTable(document.table);
  if (table) {
    return (
      <Library
        data={{
          id: `registered-document-${document.id}`,
          readOnly: true,
          registrationCode: document.registrationCode,
          registrationNumber: document.registrationNumber,
          table,
          title: document.documentTitle,
        }}
        onBack={onBack}
      />
    );
  }

  return (
    <section className="module-panel">
      <button className="module-back-button" onClick={onBack} type="button"><T>{"Артка"}</T></button>
      <div className="document-registry__paper">
        <strong><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(document)}</strong>
        <h1>{document.documentTitle}</h1>
        <p><T>{"Бөлүм: "}</T>{SECTION_LABELS[document.sectionId] || document.sectionId}</p>
        <p><T>{"Жөнөтүүчү: "}</T>{document.senderName || document.unitNumber}</p>
        <p><T>{"Жөнөтүлгөн убактысы: "}</T>{formatDate(document.createdAt)}</p>
      </div>
    </section>
  );
}

export default function DocumentRegistry({ user }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [openedDocument, setOpenedDocument] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (event) => {
    event.preventDefault();
    const registrationValue = query.replace(/^№\s*/u, "").trim();
    const registrationMatch = registrationValue.match(/(?:^|\/)(\d+)$/u);
    if (!registrationMatch) {
      setResult(null);
      setError("Каттоо номерин туура жазыңыз.");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);
    try {
      const items = await getThematicAccountSubmissions(registrationMatch[1]);
      if (!items?.length) {
        setError("Бул каттоо номери боюнча документ табылган жок.");
        return;
      }
      setResult(items[0]);
    } catch (searchError) {
      setError(getApiErrorMessage(searchError, "Документти издөө мүмкүн болгон жок."));
    } finally {
      setIsLoading(false);
    }
  };

  if (openedDocument) {
    return (
      <RegisteredDocumentView
        document={openedDocument}
        onBack={() => setOpenedDocument(null)}
        user={user}
      />
    );
  }

  return (
    <section className="module-panel document-registry">
      <header>
        <p className="eyebrow"><T>{"Администратор"}</T></p>
        <h1><T>{"Документтер"}</T></h1>
        <p><T>{"Документти уникалдуу каттоо номери боюнча издөө."}</T></p>
      </header>

      <form className="document-registry__search" onSubmit={handleSearch}>
        <label htmlFor="document-registration-search"><T>{"Каттоо номери"}</T></label>
        <div>
          <input
            autoComplete="off"
            id="document-registration-search"
            inputMode="numeric"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Мисалы: 125")}
            value={query}
          />
          <button className="module-action-button" disabled={isLoading} type="submit">
            <T>{isLoading ? "Изделүүдө..." : "Издөө"}</T>
          </button>
        </div>
      </form>

      {error ? <p className="form-error"><T>{error}</T></p> : null}
      {result ? (
        <div className="document-registry__result">
          <div>
            <strong><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(result)}</strong>
            <h2>{result.documentTitle}</h2>
            <p>{SECTION_LABELS[result.sectionId] || result.sectionId}</p>
            <small>
              {result.senderName || result.unitNumber} · {formatDate(result.createdAt)}
            </small>
          </div>
          <button className="module-action-button" onClick={() => setOpenedDocument(result)} type="button"><T>{"Документти ачуу"}</T></button>
        </div>
      ) : null}
    </section>
  );
}
