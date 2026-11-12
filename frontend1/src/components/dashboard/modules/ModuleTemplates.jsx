import {useLanguage as useCopyLanguage} from "../../../i18n.jsx";
import { T } from "../../../i18n.jsx";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  createModuleTemplate,
  deleteModuleTemplate,
  getModuleTemplates,
} from "../../../api/dashboard.js";
import { getApiErrorMessage } from "../../../api/errors.js";

const PRIMARY_ONLY_MODULES = new Set(["combatTrainingJournal", "smr"]);

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ky-KG");
};

export default function ModuleTemplates({ moduleKey, user }) {
 const {t:copyT}=useCopyLanguage();

  const anchor = useRef(null);
  const [documentTarget, setDocumentTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const scope = anchor.current?.parentElement;
    if (!scope) return;
    const update = () => {
      const root = [...scope.querySelectorAll(
        ".module-table-view:has(.table-wrap table), .monthly-analysis-print-root, .combat-training-plan--draft-print, .methodical-document-page, .registered-document-page, .memo-letter-page, .document-paper, .document-registry__paper, .docx-preview, [class*='word-page']"
      )].find((element) => element.getClientRects().length > 0);
      const target = root ? scope.closest(".dashboard-content")?.querySelector(".dashboard-print-toolbar") || null : null;
      setDocumentTarget(target);
      if (!target) setOpen(false);
    };
    const observer = new MutationObserver(update);
    observer.observe(scope.closest(".dashboard-content") || scope, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    window.addEventListener("resize", update);
    update();
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, [moduleKey]);
  const canManage = user?.role === "admin" && (
    !PRIMARY_ONLY_MODULES.has(moduleKey) || Boolean(user?.is_superuser)
  );

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await getModuleTemplates(moduleKey));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Үлгүлөрдү жүктөө мүмкүн болгон жок."));
    } finally {
      setLoading(false);
    }
  };

  const openDialog = () => {
    setOpen(true);
    loadItems();
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!title.trim() || files.length === 0) return;

    setSaving(true);
    setError("");
    try {
      const createdItems = await Promise.all(files.map((selectedFile) => {
        const payload = new FormData();
        const fileTitle = files.length > 1
          ? `${title.trim()} — ${selectedFile.name.replace(/\.[^.]+$/, "")}`
          : title.trim();
        payload.append("moduleKey", moduleKey);
        payload.append("title", fileTitle);
        payload.append("file", selectedFile);
        return createModuleTemplate(payload);
      }));
      setItems((current) => [...createdItems.reverse(), ...current]);
      setTitle("");
      setFiles([]);
      setFileInputKey((current) => current + 1);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Файлдарды жүктөө мүмкүн болгон жок."));
      loadItems();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`«${item.title}» файлын өчүрөсүзбү?`)) return;
    setDeletingId(item.id);
    setError("");
    try {
      await deleteModuleTemplate(item.id);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Файлды өчүрүү мүмкүн болгон жок."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <span hidden ref={anchor} />
      {documentTarget ? createPortal(<div className="module-template-toolbar no-print">
        <button className="module-template-open" onClick={openDialog} type="button"><T>{"Үлгү"}</T></button>
      </div>, documentTarget) : null}

      {open ? (
        <div className="module-template-modal" role="dialog" aria-modal="true" aria-label={copyT("Үлгү документтери жана сүрөттөрү")}>
          <section className="module-template-modal__panel">
            <header>
              <div>
                <h2><T>{"Үлгү"}</T></h2>
                <p><T>{"Бул бөлүмдүн PDF документтери жана сүрөттөрү"}</T></p>
              </div>
              <button aria-label="Жабуу" className="module-template-close" onClick={() => setOpen(false)} type="button">×</button>
            </header>

            {canManage ? (
              <form className="module-template-upload" onSubmit={upload}>
                <input
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Аталышы"
                  required
                  value={title}
                />
                <input
                  accept="application/pdf,.pdf,image/jpeg,image/png,image/gif,image/webp,image/bmp,.jpg,.jpeg,.png,.gif,.webp,.bmp"
                  key={fileInputKey}
                  multiple
                  onChange={(event) => setFiles(Array.from(event.target.files || []))}
                  required
                  type="file"
                />
                <button disabled={saving || !title.trim() || files.length === 0} type="submit">
                  <T>{saving ? "Жүктөлүүдө..." : `Жүктөө${files.length > 1 ? ` (${files.length})` : ""}`}</T>
                </button>
              </form>
            ) : null}

            {error ? <p className="dashboard-error"><T>{error}</T></p> : null}
            {loading ? <p className="dashboard-state"><T>{"Жүктөлүүдө..."}</T></p> : null}
            {!loading && items.length === 0 ? (
              <p className="dashboard-state"><T>{"Документтер жана сүрөттөр азырынча жүктөлгөн жок."}</T></p>
            ) : null}
            {!loading && items.length > 0 ? (
              <div className="module-template-list">
                {items.map((item) => (
                  <article className="module-template-card" key={item.id}>
                    {item.kind === "image" ? (
                      <img alt="" className="module-template-card__preview" src={item.fileUrl} />
                    ) : (
                      <span className="module-template-card__icon" aria-hidden="true">PDF</span>
                    )}
                    <div>
                      <strong><T>{item.title}</T></strong>
                      <small>{[item.uploadedBy, formatDate(item.createdAt)].filter(Boolean).join(" · ")}</small>
                    </div>
                    <a href={item.fileUrl} rel="noreferrer" target="_blank"><T>{"Ачуу"}</T></a>
                    {canManage ? (
                      <button className="danger" disabled={deletingId === item.id} onClick={() => remove(item)} type="button">
                        <T>{deletingId === item.id ? "Өчүрүлүүдө..." : "Өчүрүү"}</T>
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
