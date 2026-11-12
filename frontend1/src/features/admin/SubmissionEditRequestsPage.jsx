import { T, useLanguage } from "../../i18n.jsx";
import React, { useEffect, useState } from "react";

import {
  decideSubmissionEditRequest,
  deleteSubmissionEditRequest,
  getSubmissionEditRequests,
} from "../../api/dashboard.js";
import { RegisteredDocumentView } from "../../components/dashboard/modules/DocumentRegistry.jsx";
import { getDocumentRegistrationCode } from "../../utils/documentRegistration.js";

const statusLabels = {
  pending: "Каралууда",
  approved: "Уруксат берилди",
  rejected: "Четке кагылды",
  corrected: "Өзгөрүлдү (Изменено)",
};

export default function SubmissionEditRequestsPage({ user }) {
  const {language}=useLanguage();
  const label=(ru,ky)=>language==='ru'?ru:ky;
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const load = async () => {
    try {
      setItems(await getSubmissionEditRequests());
      setError("");
    } catch {
      setError("Оңдоо сурамдарын жүктөө мүмкүн болгон жок.");
    }
  };

  useEffect(() => {
    load();
    const intervalId = window.setInterval(load, 5000);
    window.addEventListener("focus", load);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", load);
    };
  }, []);

  useEffect(() => {
    setSelectedDocument((current) => {
      if (!current) return current;
      return items.find((item) => item.submission.id === current.id)?.submission || current;
    });
  }, [items]);

  useEffect(()=>{
    const highlight=()=>{const id=sessionStorage.getItem('munara:open-edit-request');if(!id)return;const card=document.getElementById(`edit-request-${id}`);if(card){card.scrollIntoView({block:'center',behavior:'smooth'});card.tabIndex=-1;card.focus({preventScroll:true});sessionStorage.removeItem('munara:open-edit-request');}};
    highlight();window.addEventListener('munara:open-edit-requests',highlight);return()=>window.removeEventListener('munara:open-edit-requests',highlight);
  },[items]);
  const decide = async (item, status) => {
    setLoadingId(item.id);
    try {
      const updated = await decideSubmissionEditRequest(item.id, status);
      setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
      window.dispatchEvent(new Event("edit-requests:changed"));
    } catch {
      setError("Сурамды иштетүү мүмкүн болгон жок.");
    } finally {
      setLoadingId(null);
    }
  };

  const remove = async (item) => {
    const warning = item.status === "approved"
      ? "Бул сурамды өчүрсөңүз, документти оңдоого берилген уруксат да жокко чыгарылат. Өчүрүлсүнбү?"
      : "Бул сурам өчүрүлсүнбү?";
    if (!window.confirm(warning)) return;

    setLoadingId(item.id);
    try {
      await deleteSubmissionEditRequest(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setError("");
    } catch {
      setError("Сурамды өчүрүү мүмкүн болгон жок.");
    } finally {
      setLoadingId(null);
    }
  };

  if (selectedDocument) {
    return (
      <RegisteredDocumentView
        document={selectedDocument}
        onBack={() => setSelectedDocument(null)}
        user={user}
      />
    );
  }

  return (
    <section className="module-panel">
      <header><h1><T>{"Уруксат сурамдары"}</T></h1></header>
      {error ? <p className="dashboard-error"><T>{error}</T></p> : null}
      <div className="saved-table-list">
        {items.length ? items.map((item) => (
          <article className="saved-table-card" key={item.id} id={`edit-request-${item.id}`}>
            <strong>{item.submission.documentTitle}</strong>
            <span><T>{"Каттоо № "}</T>{getDocumentRegistrationCode(item.submission)}</span>
            <dl className="request-sender-details">
              <div><dt>{label("Отправитель","Жөнөтүүчү")}</dt><dd>{item.requesterName || '—'}{item.requesterEmail&&<small>{item.requesterEmail}</small>}</dd></div>
              <div><dt>{label("Воинская часть","Аскер бөлүгү")}</dt><dd>{item.requesterUnitNumber || item.submission.unitNumber || '—'}</dd></div>
              {item.requesterRole==='outpost'&&<div><dt>{label("Застава","Застава")}</dt><dd><T>{item.requesterOutpostName || item.submission.outpostName || label("Не указана","Көрсөтүлгөн эмес")}</T></dd></div>}
              <div><dt>{label("Дата запроса","Сурамдын күнү")}</dt><dd>{new Date(item.createdAt).toLocaleString(language==='ru'?'ru-RU':'ky-KG')}</dd></div>
            </dl>
            <span className={`submission-edit-status submission-edit-status--${item.status}`}><T>{statusLabels[item.status]}</T></span>
            <div className="saved-table-card__actions">
              <button
                className="module-action-button"
                onClick={() => setSelectedDocument(item.submission)}
                type="button"
              ><T>{"Документти көрүү"}</T></button>
              {item.status === "pending" ? (
                <>
                  <button disabled={loadingId === item.id} onClick={() => decide(item, "approved")} type="button"><T>{"Уруксат берүү"}</T></button>
                  <button disabled={loadingId === item.id} onClick={() => decide(item, "rejected")} type="button"><T>{"Четке кагуу"}</T></button>
                </>
              ) : (
                <button disabled={loadingId === item.id} onClick={() => remove(item)} type="button"><T>{"Өчүрүү"}</T></button>
              )}
            </div>
          </article>
        )) : <p><T>{"Сурамдар азырынча жок."}</T></p>}
      </div>
    </section>
  );
}
