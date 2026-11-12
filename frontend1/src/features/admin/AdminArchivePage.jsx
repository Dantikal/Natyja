import DeletedJournalSubjects from "./DeletedJournalSubjects.jsx";
import {useLanguage} from "../../i18n.jsx";
import { T } from "../../i18n.jsx";
import React, { useEffect, useRef, useState } from "react";

import { getSubmissionArchivePage, getArchivedCopy } from "../../api/dashboard.js";
import { getApiErrorMessage } from "../../api/errors.js";
import { ARCHIVE_MODULES, ArchivedDocumentView } from "../../components/dashboard/modules/DocumentYearArchive.jsx";
import { MILITARY_UNIT_OPTIONS, OUTPOSTS_BY_MILITARY_UNIT, formatOutpostName } from "../../data/militaryUnits.js";

const outpostKey = (name) => String(name || "").trim().replace(/\s+чек ара заставасы$/, "").toLocaleLowerCase();
const isOutpostCopy = (copy) => copy.senderRole === "outpost" || (!copy.senderRole && Boolean(copy.outpostName));
const matchesFolder = (copy, folder) => folder.sectionIds.includes(copy.sectionId) &&
  (!folder.analysisType || (copy.table?.sectionId || copy.periodId || "monthly-analysis") === folder.analysisType);

export default function AdminArchivePage({ user }) {
  const {language}=useLanguage();
  const [deletedSubjectsOpen,setDeletedSubjectsOpen]=useState(false);
  const [copies, setCopies] = useState([]);
  const [path, setPath] = useState([]);
  const [openedCopy, setOpenedCopy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [openingId, setOpeningId] = useState(null);
  const detailRequest = useRef(null);
  useEffect(() => () => detailRequest.current?.abort(), []);

  const openDocument = async (copy) => {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setOpeningId(copy.id);
    setError("");
    try {
      const document = await getArchivedCopy(copy.id, controller.signal);
      if (!controller.signal.aborted) setOpenedCopy(document);
    } catch (requestError) {
      if (!controller.signal.aborted) setError(getApiErrorMessage(requestError, "Не удалось загрузить документ. Попробуйте ещё раз."));
    } finally {
      if (!controller.signal.aborted) setOpeningId(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setCopies([]);
    const load = async () => {
      let cursor;
      try {
        do {
          const page = await getSubmissionArchivePage(cursor, controller.signal);
          if (controller.signal.aborted) return;
          setCopies((previous) => [...previous, ...page.results]);
          cursor = page.nextCursor;
        } while (cursor);
      } catch (requestError) {
        if (!controller.signal.aborted) setError(getApiErrorMessage(requestError, "Архивди жүктөө мүмкүн болгон жок."));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [refreshKey]);

  const [year, unit, branch, ...rest] = path;
  const outpost = branch === "outposts" ? rest[0] : null;
  const moduleId = branch === "outposts" ? rest[1] : rest[0];
  const folderIndex = branch === "outposts" ? rest[2] : rest[1];
  const archiveModule = ARCHIVE_MODULES[moduleId];
  const unitCopies = copies.filter((copy) => copy.year === year && copy.unitNumber === unit);
  const selectedCopies = unitCopies.filter((copy) => branch === "outposts"
    ? isOutpostCopy(copy) && outpostKey(copy.outpostName) === outpost
    : !isOutpostCopy(copy));
  const years = [...new Set([2026, new Date().getFullYear(), ...copies.map((copy) => copy.year)])].sort((a, b) => b - a);
  const units = [...new Set([...MILITARY_UNIT_OPTIONS, ...copies.filter((copy) => copy.year === year).map((copy) => copy.unitNumber).filter(Boolean)])];
  const outposts = new Map((OUTPOSTS_BY_MILITARY_UNIT[unit] || []).map(([number, name]) => [outpostKey(name), `${number}. ${formatOutpostName(name)}`]));
  unitCopies.filter(isOutpostCopy).forEach((copy) => {
    const key = outpostKey(copy.outpostName);
    if (key && !outposts.has(key)) outposts.set(key, copy.outpostName);
  });
  const enter = (value) => setPath([...path, value]);
  const folderButton = (key, title, count) => <button key={key} onClick={() => enter(key)} type="button">
    📁 <T>{title}</T>{count != null ? <span>{count}</span> : null}
  </button>;
  const title = !year ? "Архив" : !unit ? `${year} ж Архиви` : !branch ? `${unit} Аскер бөлүгү`
    : branch === "outposts" && !outpost ? "Заставалар"
      : !moduleId ? (outpost ? outposts.get(outpost) : "Аскер бөлүгү")
        : folderIndex == null ? archiveModule.title : archiveModule.folders[folderIndex].title;

  if(deletedSubjectsOpen)return <DeletedJournalSubjects user={user} onBack={()=>setDeletedSubjectsOpen(false)}/>;

  if (openedCopy) return <ArchivedDocumentView copy={openedCopy} onBack={() => setOpenedCopy(null)} user={user} />;

  return <section className="module-panel document-year-archive">
    <header className="module-header"><h1><T>{title}</T></h1></header>
    {year ? <p>{year}<T>{" ж Архиви"}</T><T>{unit ? ` / ${unit} Аскер бөлүгү` : ""}</T>{outpost ? ` / ${outposts.get(outpost)}` : ""}</p> : null}
    {path.length ? <button className="module-back-button" onClick={() => setPath(path.slice(0, -1))} type="button"><T>{"Артка"}</T></button> : null}
    <button className="archive-refresh-button" onClick={() => setRefreshKey((value) => value + 1)} type="button" disabled={loading}><span aria-hidden="true">↻</span><T>{"Жаңыртуу"}</T></button>
    {loading ? <p className="dashboard-state" role="status"><T>{"Архив жүктөлүүдө..."}</T> {copies.length > 0 ? `(${copies.length})` : ""}</p> : null}
    {error ? <p className="dashboard-error" role="alert"><T>{error}</T></p> : null}
    {
      <div className="document-year-archive__folder">
        {!year ? <><button type="button" onClick={()=>setDeletedSubjectsOpen(true)}>📁 {language==='ru'?'Удалённые предметы':'Өчүрүлгөн предметтер'}</button>{years.map((value) => folderButton(value, `${value} ж Архиви`))}</>
          : !unit ? units.map((value) => folderButton(value, `${value} Аскер бөлүгү`))
            : !branch ? [folderButton("unit", "Аскер бөлүгү"), folderButton("outposts", "Заставалар")]
              : branch === "outposts" && !outpost ? <>
                {[...outposts].map(([key, label]) => folderButton(key, label))}
                {!outposts.size ? <p><T>{"Бул аскер бөлүгүндө застава жок."}</T></p> : null}
              </>
                : !moduleId ? Object.entries(ARCHIVE_MODULES).map(([key, module]) => folderButton(key, module.title,
                  selectedCopies.filter((copy) => module.folders.some((folder) => matchesFolder(copy, folder))).length))
                  : folderIndex == null ? archiveModule.folders.map((folder, index) => folderButton(index, folder.title,
                    selectedCopies.filter((copy) => matchesFolder(copy, folder)).length))
                    : <div className="document-year-archive__files">
                      {selectedCopies.filter((copy) => matchesFolder(copy, archiveModule.folders[folderIndex])).map((copy) =>
                        <button key={copy.id} onClick={() => openDocument(copy)} disabled={openingId === copy.id} type="button">
                          📄 {copy.documentTitle}{openingId === copy.id ? <T>Жүктөлүүдө...</T> : null}<small>{copy.senderName} · {new Date(copy.archivedAt).toLocaleString("ky-KG")}</small>
                        </button>)}
                      {!loading && !error && !selectedCopies.some((copy) => matchesFolder(copy, archiveModule.folders[folderIndex])) ? <p><T>{"Бул папкада документ жок."}</T></p> : null}
                    </div>}
      </div>}
  </section>;
}
