import {api as markedApi} from "../../../api/client.js";
import TextFilePreview from "./TextFilePreview.jsx";
import LegacyWordPreview from "./LegacyWordPreview.jsx";
import WordFilePreview from "./WordFilePreview.jsx";
import { notifySave } from "../../../utils/saveFeedback.js";
import { T } from "../../../i18n.jsx";
import React, { useEffect, useState } from "react";

import {
  createMethodicalDocument,
  createMethodicalSubject,
  deleteMethodicalDocument,
  deleteMethodicalSubject,
  getMethodicalDocuments,
  getMethodicalSubjects,
  updateMethodicalSubject,
} from "../../../api/dashboard.js";

const SECTION_TITLE = "Күжүрмөн даярдоо боюнча усулдук колдонмолор";
const LESSON_PLANS_TITLE = "Электрондук план-конспектилер";
const DIRECTIVES_TITLE = "Насааттамалар, нускамалар жана жоболор";
const DEFAULT_COLLECTION = "methodical_manuals";

export default function SMR({
  allowTextMaterials = true,
  collection = DEFAULT_COLLECTION,
  data,
  onBack,
  user,
}) {
  const [subjects, setSubjects] = useState(data?.subjects || []);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [downloading,setDownloading]=useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentFile, setDocumentFile] = useState(null);
  const [documentText, setDocumentText] = useState("");
  const [materialMode, setMaterialMode] = useState(
    allowTextMaterials ? "text" : "file"
  );
  const [activeDocument, setActiveDocument] = useState(null);
  const isAdmin = user?.role === "admin";
  const canManage = isAdmin && (
    collection !== DEFAULT_COLLECTION || Boolean(user?.is_superuser)
  );

  useEffect(() => {
    setSubjects(data?.subjects || []);
  }, [data?.subjects]);

  useEffect(() => {
    let isCurrent = true;

    getMethodicalSubjects(collection)
      .then((items) => {
        if (isCurrent) setSubjects(items);
      })
      .catch(() => {
        if (isCurrent) {
          setError("Материалдардын тизмесин жүктөө мүмкүн болгон жок.");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [collection]);

  useEffect(() => {
    if (
      selectedSubjectId !== null &&
      !subjects.some((subject) => subject.id === selectedSubjectId)
    ) {
      setSelectedSubjectId(null);
    }
  }, [selectedSubjectId, subjects]);

  const selectedSubject = subjects.find(
    (subject) => subject.id === selectedSubjectId
  );

  const isManagementSection = collection === DEFAULT_COLLECTION && selectedSubject &&
    !selectedSubject.parent && selectedSubject.title === DIRECTIVES_TITLE;
  const isFolderSection = collection === DEFAULT_COLLECTION && selectedSubject &&
    !selectedSubject.parent && [LESSON_PLANS_TITLE, DIRECTIVES_TITLE].includes(selectedSubject.title);
  const visibleSubjects = subjects.filter((subject) =>
    isFolderSection ? subject.parent === selectedSubject.id : !subject.parent
  );

  useEffect(() => {
    if (!selectedSubject) {
      setDocuments([]);
      setActiveDocument(null);
      return;
    }

    let isCurrent = true;
    setDocumentsLoading(true);
    setError("");
    getMethodicalDocuments(selectedSubject.id)
      .then((items) => {
        if (isCurrent) setDocuments(items);
      })
      .catch(() => {
        if (isCurrent) setError("Документтердин тизмесин жүктөө мүмкүн болгон жок.");
      })
      .finally(() => {
        if (isCurrent) setDocumentsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedSubject?.id]);

  const resetMessages = () => {
    setNotice("");
    setError("");
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const title = newTitle.trim();

    if (!title) {
      setError(isManagementSection ? "Башкармалыктын аталышын көрсөтүңүз." : "Предметтин аталышын көрсөтүңүз.");
      return;
    }

    resetMessages();
    setIsSubmitting(true);

    try {
      const createdSubject = await createMethodicalSubject({
        collection,
        parent: isFolderSection ? selectedSubject.id : null,
        order: visibleSubjects.length + 1,
        title,
      });
      setSubjects((currentSubjects) => [...currentSubjects, createdSubject]);
      setNewTitle("");
      setNotice(isManagementSection ? "Башкармалык түзүлдү." : "Предмет түзүлдү.");
    } catch {
      setError(isManagementSection ? "Башкармалыкты түзүү мүмкүн болгон жок." : "Предметти түзүү мүмкүн болгон жок.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStart = (subject) => {
    resetMessages();
    setEditingId(subject.id);
    setEditingTitle(subject.title);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const handleUpdate = async (subject) => {
    const title = editingTitle.trim();

    if (!title) {
      setError(isManagementSection ? "Башкармалыктын аталышын көрсөтүңүз." : "Предметтин аталышын көрсөтүңүз.");
      return;
    }

    resetMessages();
    setIsSubmitting(true);

    try {
      const updatedSubject = await updateMethodicalSubject(subject.id, { title });
      setSubjects((currentSubjects) =>
        currentSubjects.map((currentSubject) =>
          currentSubject.id === subject.id ? updatedSubject : currentSubject
        )
      );
      setEditingId(null);
      setEditingTitle("");
      setNotice(isManagementSection ? "Башкармалык өзгөртүлдү." : "Предмет өзгөртүлдү.");
    
      notifySave();
} catch {
      notifySave(false);

      setError(isManagementSection ? "Башкармалыкты өзгөртүү мүмкүн болгон жок." : "Предметти өзгөртүү мүмкүн болгон жок.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (subject) => {
    resetMessages();
    setIsSubmitting(true);

    try {
      await deleteMethodicalSubject(subject.id);
      setSubjects((currentSubjects) =>
        currentSubjects.filter((currentSubject) => currentSubject.id !== subject.id)
      );
      setNotice(isManagementSection ? "Башкармалык өчүрүлдү." : "Предмет өчүрүлдү.");
    } catch {
      setError(isManagementSection ? "Башкармалыкты өчүрүү мүмкүн болгон жок." : "Предметти өчүрүү мүмкүн болгон жок.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setDocumentTitle("");
    setDocumentFile(null);
    setDocumentText("");
    setMaterialMode(allowTextMaterials ? "text" : "file");
  };

  const handleDocumentCreate = async (event) => {
    event.preventDefault();
    if (isFolderSection) return;
    const title = documentTitle.trim();
    if (!title || (materialMode === "text" ? !documentText.trim() : !documentFile)) {
      setError(
        materialMode === "text"
          ? "Аталышын көрсөтүп, материалдын текстин жазыңыз."
          : "Аталышын көрсөтүп, файлды тандаңыз."
      );
      return;
    }

    resetMessages();
    setIsSubmitting(true);
    const payload = new FormData();
    payload.append("title", title);
    if (materialMode === "text") {
      payload.append("content", documentText.trim());
    } else {
      payload.append("file", documentFile);
    }

    try {
      const createdDocument = await createMethodicalDocument(selectedSubject.id, payload);
      setDocuments((currentDocuments) => [createdDocument, ...currentDocuments]);
      closeCreateDialog();
      setNotice("Документ түзүлдү.");
    } catch (requestError) {
      const fileError = requestError.response?.data?.file;
      setError(
        (Array.isArray(fileError) ? fileError[0] : fileError) ||
          "Документти жүктөө мүмкүн болгон жок. Файлды текшерип, кайра аракет кылыңыз."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDocumentDelete = async (document) => {
    resetMessages();
    setIsSubmitting(true);
    try {
      await deleteMethodicalDocument(selectedSubject.id, document.id);
      setDocuments((currentDocuments) =>
        currentDocuments.filter((currentDocument) => currentDocument.id !== document.id)
      );
      if (activeDocument?.id === document.id) setActiveDocument(null);
      setNotice("Документ өчүрүлдү.");
    } catch {
      setError("Документти өчүрүү мүмкүн болгон жок.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaterialDownload = async (material) => {
    if (!material || downloading) return;
    setError("");

    if (material.fileUrl) {
      setDownloading(true);
      try {
        if (/\.(pdf|doc|docx|xls|xlsx|ods|csv|ppt|pptx|odp|odt|rtf)$/i.test(material.originalName||'')){
          const {data}=await markedApi.get(`/dashboard/methodical-subjects/${material.subject||selectedSubject.id}/documents/${material.id}/marked/`,{responseType:'blob',timeout:120000});
          const url=URL.createObjectURL(data),link=document.createElement('a');link.href=url;link.download=(material.originalName||material.title).replace(/\.[^.]+$/,'')+'-marked.pdf';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);return;
        }
        const response = await fetch(material.fileUrl);
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = material.originalName || material.title;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      } catch (failure) {
        let message="Материалды жүктөп алуу мүмкүн болгон жок.";
        try {const payload=JSON.parse(await failure.response.data.text());message=payload.detail||message;}catch{}
        setError(message);
      } finally {setDownloading(false);}

      return;
    }

    const blob = new Blob([material.content || ""], {
      type: "text/plain;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${material.title || "material"}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const renderActiveMaterial = () => {
    if (/\.txt$/i.test(activeDocument.originalName || "")) return <TextFilePreview url={activeDocument.fileUrl}/>;
    if (activeDocument.kind === "text") {
      return <div className="methodical-text-content">{activeDocument.content}</div>;
    }
    if (activeDocument.kind === "doc" || /\.(xls|xlsx|ods|csv|ppt|pptx|odp|odt|rtf)$/i.test(activeDocument.originalName || "")) {
      return <LegacyWordPreview key={activeDocument.id} document={activeDocument} />;
    }
    if (activeDocument.kind === "docx") {
      return <WordFilePreview key={activeDocument.id} url={activeDocument.fileUrl} title={activeDocument.title} />;
    }
    if (activeDocument.kind === "pdf") return <LegacyWordPreview key={activeDocument.id} document={activeDocument}/>;
    if (activeDocument.kind === "image") {
      return (
        <img
          alt={activeDocument.title}
          className="methodical-media methodical-media--image"
          src={activeDocument.fileUrl}
        />
      );
    }
    if (activeDocument.kind === "video") {
      return (
        <video className="methodical-media methodical-media--video" controls preload="metadata">
          <source src={activeDocument.fileUrl} /><T>{"Браузериңиз видеону ойнотууну колдобойт."}</T></video>
      );
    }
    if (activeDocument.kind === "audio") {
      return (
        <audio className="methodical-media methodical-media--audio" controls preload="metadata">
          <source src={activeDocument.fileUrl} /><T>{"Браузериңиз аудиону ойнотууну колдобойт."}</T></audio>
      );
    }
    return (
      <div className="methodical-file-download">
        <p><T>{"Бул файлды ачууга же жүктөп алууга болот."}</T></p>
        <a href={activeDocument.fileUrl} rel="noreferrer" target="_blank"><T>{"Файлды ачуу"}</T></a>
      </div>
    );
  };

  const renderSubjects = () => (
    <>
      {canManage && (collection !== DEFAULT_COLLECTION || isFolderSection) && (
        <form className="methodical-subject-form" onSubmit={handleCreate}>
          <label>
            <T>{isManagementSection ? "Башкармалыктын аталышы" : "Предметтин аталышы"}</T>
            <input
              disabled={isSubmitting}
              onChange={(event) => setNewTitle(event.target.value)}
              value={newTitle}
            />
          </label>
          <button disabled={isSubmitting} type="submit"><T>{"Кошуу"}</T></button>
        </form>
      )}

      {notice && <p className="dashboard-notice">{notice}</p>}
      {error && <p className="dashboard-error"><T>{error}</T></p>}

      {visibleSubjects.length > 0 ? (
        <div className="methodical-subject-list">
          {visibleSubjects.map((subject) => {
            const isEditing = editingId === subject.id;

            return (
              <article className="methodical-subject-card" key={subject.id}>
                {isEditing ? (
                  <input
                    disabled={isSubmitting}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    value={editingTitle}
                  />
                ) : (
                  <button
                    className="methodical-subject-link"
                    onClick={() => {
                      resetMessages();
                      handleEditCancel();
                      setNewTitle("");
                      setActiveDocument(null);
                      setSelectedSubjectId(subject.id);
                    }}
                    type="button"
                  >
                    <T>{subject.title}</T>
                  </button>
                )}

                {canManage && (
                  <div className="methodical-subject-actions">
                    {isEditing ? (
                      <>
                        <button
                          disabled={isSubmitting}
                          onClick={() => handleUpdate(subject)}
                          type="button"
                        ><T>{"Сактоо"}</T></button>
                        <button
                          disabled={isSubmitting}
                          onClick={handleEditCancel}
                          type="button"
                        ><T>{"Жокко чыгаруу"}</T></button>
                      </>
                    ) : (
                      <>
                        <button
                          disabled={isSubmitting}
                          className="methodical-edit-action"
                          onClick={() => handleEditStart(subject)}
                          type="button"
                        ><T>{"Өзгөртүү"}</T></button>
                        <button
                          disabled={isSubmitting}
                          className="methodical-delete-action"
                          onClick={() => handleDelete(subject)}
                          type="button"
                        ><T>{"Өчүрүү"}</T></button>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="dashboard-state"><T>{isManagementSection ? "Башкармалыктар азырынча жок." : "Предметтер азырынча жок."}</T></p>
      )}
    </>
  );

  if (selectedSubject && activeDocument) {
    return (
      <section className="module-panel methodical-document-page">
        {downloading&&<p role="status"><T>{"Жүктөлүүдө..."}</T></p>}
        {error&&<p className="dashboard-error" role="alert">{error}</p>}
        <button
          className="module-back-button"
          onClick={() => setActiveDocument(null)}
          type="button"
        ><T>{"Артка"}</T></button>
        <header className="methodical-document-page__header">
          <div>
            <h1><T>{activeDocument.title}</T></h1>
            <span>{activeDocument.originalName || "Текстовый материал"}</span>
          </div>
          <button
            className="methodical-document-download"
            disabled={downloading}
            onClick={() => handleMaterialDownload(activeDocument)}
            type="button"
          ><T>{"Жүктөп алуу"}</T></button>
        </header>
        {renderActiveMaterial()}
      </section>
    );
  }

  if (selectedSubject) {
    return (
      <section className="module-panel">
        <button
          className="module-back-button"
          onClick={() => {
            setSelectedSubjectId(selectedSubject.parent || null);
            setNewTitle("");
            handleEditCancel();
            closeCreateDialog();
            resetMessages();
          }}
          type="button"
        ><T>{"Артка"}</T></button>
        <header>
          <h1><T>{selectedSubject.title}</T></h1>
        </header>

        <>
            {isFolderSection && renderSubjects()}
            {canManage && !isFolderSection && (
              <div className="methodical-document-toolbar">
                <button onClick={() => setIsCreateDialogOpen(true)} type="button"><T>{"Кошуу"}</T></button>
              </div>
            )}

            {!isFolderSection && notice && <p className="dashboard-notice">{notice}</p>}
            {!isFolderSection && error && <p className="dashboard-error"><T>{error}</T></p>}

            {documentsLoading ? (
              <p className="dashboard-state"><T>{"Документтер жүктөлүүдө..."}</T></p>
            ) : documents.length > 0 ? (
              <div className="methodical-document-list">
                {documents.map((document) => (
                  <article className="methodical-document-card" key={document.id}>
                    <button
                      className="methodical-document-open"
                      onClick={() => setActiveDocument(document)}
                      type="button"
                    >
                      <span aria-hidden="true" className="module-document-icon" />
                      <span>
                        <strong>{document.title}</strong>
                        <small>{document.originalName || "Текстовый материал"}</small>
                      </span>
                    </button>
                    <div className="methodical-document-actions">
                      <button
                        className="methodical-document-download methodical-document-download--compact"
                        onClick={() => handleMaterialDownload(document)}
                        type="button"
                      ><T>{"Жүктөп алуу"}</T></button>
                      {canManage && (
                        <button
                          className="methodical-document-delete"
                          disabled={isSubmitting}
                          onClick={() => handleDocumentDelete(document)}
                          type="button"
                        ><T>{"Өчүрүү"}</T></button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : !isFolderSection && (
              <p className="dashboard-state"><T>{"Документтер азырынча жок."}</T></p>
            )}

            {isCreateDialogOpen && !isFolderSection && (
              <div className="combat-journal-dialog" role="dialog" aria-modal="true">
                <form className="combat-journal-dialog__panel" onSubmit={handleDocumentCreate}>
                  <h2><T>{"Материал кошуу"}</T></h2>
                  <label><T>{"Аталышы"}</T><input
                      autoFocus
                      disabled={isSubmitting}
                      onChange={(event) => setDocumentTitle(event.target.value)}
                      required
                      value={documentTitle}
                    />
                  </label>
                  <label><T>{"Материалдын түрү"}</T><select
                      disabled={isSubmitting}
                      onChange={(event) => {
                        setMaterialMode(event.target.value);
                        setDocumentFile(null);
                        setDocumentText("");
                      }}
                      value={materialMode}
                    >
                      {allowTextMaterials ? <option value="text"><T>{"Текст"}</T></option> : null}
                      <option value="file"><T>{"Файл, PDF, сүрөт, видео жана башкалар"}</T></option>
                    </select>
                  </label>
                  {materialMode === "text" ? (
                    <label><T>{"Материалдын тексти"}</T><textarea
                        disabled={isSubmitting}
                        onChange={(event) => setDocumentText(event.target.value)}
                        required
                        rows="10"
                        value={documentText}
                      />
                    </label>
                  ) : (
                    <label><T>{"Файл"}</T><input
                        accept=".doc,.docx,.pdf,.txt,.rtf,.odt,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp,.jpg,.jpeg,.png,.gif,.webp,.bmp,.mp4,.webm,.mov,.m4v,.avi,.mkv,.mp3,.wav,.ogg,.m4a,.aac,.flac,.zip,.rar,.7z"
                        disabled={isSubmitting}
                        onChange={(event) => setDocumentFile(event.target.files?.[0] || null)}
                        required
                        type="file"
                      />
                    </label>
                  )}
                  <div className="combat-journal-dialog__actions">
                    <button disabled={isSubmitting} onClick={closeCreateDialog} type="button"><T>{"Жокко чыгаруу"}</T></button>
                    <button disabled={isSubmitting} type="submit">
                      <T>{isSubmitting ? "Жүктөлүүдө..." : "Кошуу"}</T>
                    </button>
                  </div>
                </form>
              </div>
            )}
        </>
      </section>
    );
  }

  return (
    <section className="module-panel">
      {onBack ? (
        <button className="module-back-button" onClick={onBack} type="button"><T>{"Артка"}</T></button>
      ) : null}
      <header>
        <h1><T>{data?.title || SECTION_TITLE}</T></h1>
      </header>

      {renderSubjects()}
    </section>
  );
}
