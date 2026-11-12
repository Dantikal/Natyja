import { OUTPOSTS_BY_MILITARY_UNIT, MILITARY_UNIT_OPTIONS, formatOutpostName } from "../../../data/militaryUnits.js";
import { useLanguage } from "../../../i18n.jsx";
import { getMemoLetterIndex, getMemoLetterDocument } from "../../../api/dashboard.js";
import { T } from "../../../i18n.jsx";
import React, { useEffect, useMemo, useState } from "react";

import {
  getThematicAccountSubmissions,
  hideThematicAccountSubmission,
  markThematicAccountSubmissionRead,
} from "../../../api/dashboard.js";
import { getDocumentRegistrationCode } from "../../../utils/documentRegistration.js";
import Analytics from "./Analytics.jsx";

function MemoEnvelope({ count, label }) {
  return <span className={`memo-envelope ${count ? 'is-new' : 'is-read'}`} role="img" aria-label={count ? `${label('Новых писем','Жаңы каттар')}: ${count}` : label('Все письма прочитаны','Бардык каттар окулду')}>
    <svg viewBox="0 0 32 32" width="38" height="38" aria-hidden="true">{count ? <><rect x="3" y="7" width="26" height="20" rx="3"/><path d="m4 9 12 10L28 9"/></> : <><path d="M3 14 16 3l13 11v14H3Z"/><path d="M8 17V9h16v8M3 28l13-11 13 11M3 14l9 7m17-7-9 7"/></>}</svg>
    {count > 0 && <em>{count}</em>}
  </span>;
}

const SECTION_ID = "memo-letter";

const readDrafts = (storageKey) => {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const formatDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString("ky-KG");
};

export default function MemoLetter({ user }) {
  const {language}=useLanguage();const label=(ru,ky)=>language==='ru'?ru:ky;
  const [selectedUnit,setSelectedUnit]=useState(null),[selectedOutpost,setSelectedOutpost]=useState(null),[memoSearch,setMemoSearch]=useState(''),[onlyUnread,setOnlyUnread]=useState(false),[opening,setOpening]=useState(false);
  const storageKey = `munara-memo-letters:${user?.id || "anonymous"}`;
  const [drafts, setDrafts] = useState(() => readDrafts(storageKey));
  const [submissions, setSubmissions] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active=true,running=false;const controller=new AbortController();
    const load=async()=>{if(running)return;running=true;try{const items=await getMemoLetterIndex(controller.signal);if(active){setSubmissions(items);setError('');}}catch{if(active&&!controller.signal.aborted)setError('Документтерди жүктөө мүмкүн болгон жок.');}finally{running=false;if(active)setIsLoading(false);}};
    load();const poll=setInterval(load,10000);window.addEventListener('memo-letter-read',load);window.addEventListener('memo-letter-arrived',load);
    return()=>{active=false;clearInterval(poll);controller.abort();window.removeEventListener('memo-letter-read',load);window.removeEventListener('memo-letter-arrived',load);};
  },[user?.id]);

  const saveDrafts = (nextDrafts) => {
    setDrafts(nextDrafts);
    window.localStorage.setItem(storageKey, JSON.stringify(nextDrafts));
  };

  const activeDraft = drafts.find((draft) => draft.id === activeDraftId) || null;
  const incoming = useMemo(() => {
    if (user?.role === "regional") {
      return submissions.filter((submission) => submission.senderRole === "outpost" && submission.senderUnitType !== "training_center_head");
    }
    if (user?.role === "admin") {
      return submissions.filter((submission) =>
        ["outpost", "regional"].includes(submission.senderRole)
      );
    }
    return [];
  }, [submissions, user?.role]);
  const outgoing = useMemo(() => {
    if (user?.role === "outpost") return submissions.filter((item) => item.senderId === user?.id);
    if (user?.role === "regional") {
      return submissions.filter((submission) => submission.senderId === user?.id);
    }
    return [];
  }, [submissions, user?.id, user?.role]);

  const handleCreate = (event) => {
    event.preventDefault();
    const title = draftTitle.trim();
    if (!title) {
      setError("Билдирме каттын аталышын жазыңыз.");
      return;
    }
    const id = `memo-letter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    saveDrafts([{ id, title, createdAt: new Date().toISOString() }, ...drafts]);
    setDraftTitle("");
    setError("");
    setIsCreateOpen(false);
    setActiveDraftId(id);
  };

  const handleDeleteDraft = (documentId) => {
    saveDrafts(drafts.filter((draft) => draft.id !== documentId));
    setActiveDraftId(null);
  };

  const handleSubmissionCreated = (submission, sentDraftId = null) => {
    setSubmissions((items) => [
      submission,
      ...items.filter((item) => item.id !== submission.id),
    ]);
    if (sentDraftId) {
      saveDrafts(drafts.filter((draft) => draft.id !== sentDraftId));
      setActiveDraftId(null);
    }
  };

  const handleOpenSubmission = async (submission) => {
    setOpening(true);
    try { const document = await getMemoLetterDocument(submission.id); setActiveSubmission(document); }
    catch {setError(label("Не удалось открыть документ. Повторите попытку.","Документ ачылган жок. Кайра аракет кылыңыз."));setOpening(false);return;}
    setOpening(false);
    const isIncoming =
      (user?.role === "regional" && submission.senderRole === "outpost") ||
      (user?.role === "admin" && ["outpost", "regional"].includes(submission.senderRole));
    if (!isIncoming || submission.isRead) return;

    setSubmissions((items) =>
      items.map((item) =>
        item.id === submission.id ? { ...item, isRead: true } : item
      )
    );
    markThematicAccountSubmissionRead(submission.id)
      .then(() => window.dispatchEvent(new Event("memo-letter-read")))
      .catch(() => {
        setSubmissions((items) =>
          items.map((item) =>
            item.id === submission.id ? { ...item, isRead: false } : item
          )
        );
      });
  };

  useEffect(()=>{const open=()=>{const id=sessionStorage.getItem(`munara:open-memo:${user?.id}`);if(id){sessionStorage.removeItem(`munara:open-memo:${user?.id}`);handleOpenSubmission({id:Number(id),senderRole:user?.role==='admin'?'regional':'outpost'});}};open();window.addEventListener('munara:open-memo',open);return()=>window.removeEventListener('munara:open-memo',open);},[user?.id]);

  const handleHideSubmission = async (submission) => {
    if (submission.senderId !== user?.id) return;
    if (!window.confirm("Бул документти өз тизмеңизден өчүрөсүзбү?")) return;

    setError("");
    try {
      await hideThematicAccountSubmission(submission.id);
      setSubmissions((items) => items.filter((item) => item.id !== submission.id));
    } catch {
      setError("Документти тизмеден өчүрүү мүмкүн болгон жок.");
    }
  };

  if (activeDraft) {
    return (
      <Analytics
        data={{
          directDocumentId: activeDraft.id,
          directDocumentTitle: activeDraft.title,
          directEditor: true,
          defaultAddressee:
            user?.unit_type === "training_platoon_commander" ? "Окуу борбордун башчысына" : user?.role === "outpost" ? "Аскер бөлүгүнүн командирине" : "Администраторго",
          initialSectionId: "monthly-analysis",
          onBack: () => setActiveDraftId(null),
          onDeleteDirectDocument: handleDeleteDraft,
          onSubmissionCreated: (submission) =>
            handleSubmissionCreated(submission, activeDraft.id),
          registryCounterStorageKey: `munara-memo-letter-registry:${user?.id}`,
          simpleLetterEditor: true,
          storageNamespace: `memo-letter:${user?.id}:${activeDraft.id}`,
          submissionPeriodId: activeDraft.id,
          submissionSectionId: SECTION_ID,
        }}
        key={activeDraft.id}
        user={user}
      />
    );
  }

  if (activeSubmission) {
    return (
      <Analytics
        data={{
          directEditor: true,
          directSubmission: activeSubmission,
          initialSectionId: "monthly-analysis",
          onBack: () => setActiveSubmission(null),
          simpleLetterEditor: true,
          storageNamespace: `memo-letter-submission:${activeSubmission.id}`,
        }}
        key={`memo-letter-submission-${activeSubmission.id}`}
        user={user}
      />
    );
  }

  const renderSubmissions = (title, items, emptyText, canHide = false) => <div className="module-submission-list"><h2>{title}</h2>{items.length ? <div className="module-period-list">{[...items].sort((a,b)=>Number(!b.isRead)-Number(!a.isRead)||Date.parse(b.createdAt)-Date.parse(a.createdAt)).map(submission=><div className="memo-letter-submission-row" key={submission.id}><button type="button" disabled={opening} className={`module-period-card module-period-card--document${!submission.isRead&&submission.senderId!==user?.id?' memo-unread':''}`} onClick={()=>handleOpenSubmission(submission)}><span className="module-document-icon" aria-hidden="true"/><span className="module-submission-card__content"><strong><T>{submission.documentTitle}</T></strong><small>№ {getDocumentRegistrationCode(submission)}</small><small>{submission.outpostName||submission.senderName||submission.unitNumber} · {formatDate(submission.createdAt)}</small>{submission.senderId!==user?.id&&<small>{submission.isRead?label('Просмотрено вами','Сиз көрдүңүз'):label('Не просмотрено вами','Сиз көрө элексиз')}</small>}</span>{submission.senderId!==user?.id&&<MemoEnvelope count={submission.isRead?0:1} label={label}/>}</button>{canHide&&submission.senderId===user?.id&&<button className="memo-letter-submission-row__delete" type="button" onClick={()=>handleHideSubmission(submission)}><T>{'Өчүрүү'}</T></button>}</div>)}</div>:<p className="dashboard-state">{emptyText}</p>}</div>;
  return (<section className="module-panel">
    <div className="module-header-row"><div><p className="eyebrow"><T>{'Иш кагаздар'}</T></p><h1><T>{'Билдирме кат'}</T></h1></div>{user?.role!=='admin'&&<button type="button" className="module-action-button" onClick={()=>{setDraftTitle('');setError('');setIsCreateOpen(true);}}><T>{'+ Кошуу'}</T></button>}</div>
    {error&&<p className="form-error" role="alert"><T>{error}</T></p>}
    {(isLoading||opening)&&<p role="status">{label('Загрузка…','Жүктөлүүдө…')}</p>}
    {user?.role!=='admin'&&<div className="module-submission-list"><h2><T>{'Даярдалган документтер'}</T></h2>{drafts.length?drafts.map(draft=><button key={draft.id} type="button" className="module-period-card module-period-card--document" onClick={()=>setActiveDraftId(draft.id)}><span className="module-document-icon" aria-hidden="true"/><strong>{draft.title}</strong><small>{formatDate(draft.createdAt)}</small></button>):<p className="dashboard-state"><T>{'Даярдалган документтер азырынча жок.'}</T></p>}</div>}
    {user?.role === "admin" ? (
        <div className="memo-directory">
          <div className="memo-directory-tools"><input aria-label={label("Поиск документов","Документ издөө")} placeholder={label("Найти документ, часть, заставу…","Документ, бөлүк, застава издөө…")} value={memoSearch} onChange={e=>setMemoSearch(e.target.value)}/><label><input type="checkbox" checked={onlyUnread} onChange={e=>setOnlyUnread(e.target.checked)}/>{label("Только новые","Жаңылар гана")}</label></div>
          {selectedUnit && <button className="module-back-button" type="button" onClick={()=>{if(selectedOutpost)setSelectedOutpost(null);else setSelectedUnit(null);}}>{label("Назад","Артка")}</button>}
          {!selectedUnit ? <><h2>{label("Воинские части","Аскер бөлүктөрү")}</h2><div className="memo-unit-grid">{[...new Set([...MILITARY_UNIT_OPTIONS,...incoming.map(s=>s.unitNumber).filter(Boolean)])].map(unit=>({unit,items:incoming.filter(s=>String(s.unitNumber)===String(unit))})).filter(({unit,items})=>(!onlyUnread||items.some(s=>!s.isRead))&&(!memoSearch||String(unit).includes(memoSearch)||items.some(s=>[s.documentTitle,s.outpostName,s.senderName].join(' ').toLowerCase().includes(memoSearch.toLowerCase())))).sort((a,b)=>Number(b.items.some(s=>!s.isRead))-Number(a.items.some(s=>!s.isRead))||String(a.unit).localeCompare(String(b.unit),undefined,{numeric:true})).map(({unit,items})=><button key={unit} type="button" className={items.some(s=>!s.isRead)?'memo-folder memo-unread':'memo-folder'} onClick={()=>setSelectedUnit(unit)}><strong>{unit} {label("воинская часть","аскер бөлүгү")}</strong><small>{label("Документов","Документтер")}: {items.length}</small><MemoEnvelope count={items.filter(s=>!s.isRead).length} label={label}/></button>)}</div></> : <>
           <h2>{selectedUnit} {label("воинская часть","аскер бөлүгү")}{selectedOutpost?' / '+selectedOutpost:''}</h2>
           {!selectedOutpost && renderSubmissions(label("Письма воинской части администратору","Аскер бөлүгүнөн администраторго каттар"),incoming.filter(s=>s.senderRole==='regional'&&String(s.unitNumber)===String(selectedUnit)&&(!onlyUnread||!s.isRead)&&s.documentTitle.toLowerCase().includes(memoSearch.toLowerCase())),label("Документов пока нет","Документтер азырынча жок"))}
           {selectedOutpost ? renderSubmissions(label("Письма заставы воинской части","Заставадан аскер бөлүгүнө каттар"),incoming.filter(s=>s.senderRole==='outpost'&&String(s.unitNumber)===String(selectedUnit)&&formatOutpostName(s.outpostName||s.senderName)===selectedOutpost&&(!onlyUnread||!s.isRead)&&s.documentTitle.toLowerCase().includes(memoSearch.toLowerCase())),label("Документов пока нет","Документтер азырынча жок")) : <><h3>{label("Подчинённые заставы","Карамагындагы заставалар")}</h3><div className="memo-unit-grid">{[...new Set([...(OUTPOSTS_BY_MILITARY_UNIT[selectedUnit]||[]).map(([,name])=>formatOutpostName(name)),...incoming.filter(s=>s.senderRole==='outpost'&&String(s.unitNumber)===String(selectedUnit)).map(s=>formatOutpostName(s.outpostName||s.senderName))])].filter(Boolean).map(name=>({name,items:incoming.filter(s=>s.senderRole==='outpost'&&String(s.unitNumber)===String(selectedUnit)&&formatOutpostName(s.outpostName||s.senderName)===name)})).filter(({name,items})=>(!onlyUnread||items.some(s=>!s.isRead))&&(!memoSearch||name.toLowerCase().includes(memoSearch.toLowerCase())||items.some(s=>s.documentTitle.toLowerCase().includes(memoSearch.toLowerCase())))).sort((a,b)=>Number(b.items.some(s=>!s.isRead))-Number(a.items.some(s=>!s.isRead))||a.name.localeCompare(b.name)).map(({name,items})=><button key={name} type="button" className={items.some(s=>!s.isRead)?'memo-folder memo-unread':'memo-folder'} onClick={()=>setSelectedOutpost(name)}><strong>{name}</strong><small>{items.length} {label("док.","док.")}</small><MemoEnvelope count={items.filter(s=>!s.isRead).length} label={label}/></button>)}</div></>}
          </>}
        </div>
      ) : user?.role === "regional" ? <div className="memo-directory">
        <div className="memo-directory-tools"><input aria-label={label("Поиск документов","Документ издөө")} placeholder={label("Найти заставу или документ…","Застава же документ издөө…")} value={memoSearch} onChange={e=>setMemoSearch(e.target.value)}/><label><input type="checkbox" checked={onlyUnread} onChange={e=>setOnlyUnread(e.target.checked)}/>{label("Только новые","Жаңылар гана")}</label></div>
        <h2>{label("Входящие от застав","Заставалардан келген каттар")}</h2>
        {selectedOutpost ? <><button type="button" className="module-back-button" onClick={()=>setSelectedOutpost(null)}>{label("Назад к заставам","Заставаларга кайтуу")}</button>{renderSubmissions(selectedOutpost,incoming.filter(s=>formatOutpostName(s.outpostName||s.senderName)===selectedOutpost&&(!onlyUnread||!s.isRead)&&s.documentTitle.toLowerCase().includes(memoSearch.toLowerCase())),label("Документов пока нет","Документтер азырынча жок"))}</> : <div className="memo-unit-grid">{[...new Set(incoming.map(s=>formatOutpostName(s.outpostName||s.senderName)))].map(name=>({name,items:incoming.filter(s=>formatOutpostName(s.outpostName||s.senderName)===name)})).filter(({name,items})=>(!onlyUnread||items.some(s=>!s.isRead))&&(!memoSearch||name.toLowerCase().includes(memoSearch.toLowerCase())||items.some(s=>s.documentTitle.toLowerCase().includes(memoSearch.toLowerCase())))).sort((a,b)=>Number(b.items.some(s=>!s.isRead))-Number(a.items.some(s=>!s.isRead))||Math.max(...b.items.map(s=>Date.parse(s.createdAt)))-Math.max(...a.items.map(s=>Date.parse(s.createdAt)))).map(({name,items})=><button key={name} type="button" className={items.some(s=>!s.isRead)?'memo-folder memo-unread':'memo-folder'} onClick={()=>{setSelectedOutpost(name);setMemoSearch('');}}><strong>{name}</strong><small>{items.length} {label("док.","док.")}</small><MemoEnvelope count={items.filter(s=>!s.isRead).length} label={label}/></button>)}{!incoming.length&&<p className="dashboard-state">{label("Входящих документов пока нет","Келген документтер азырынча жок")}</p>}</div>}
      </div> : incoming.length > 0 || user?.role !== "outpost"
        ? renderSubmissions("Кириш", incoming, "Келген документтер азырынча жок.")
        : null}
      {user?.role !== "admin"
        ? renderSubmissions("Чыгыш", outgoing, "Жөнөтүлгөн документтер азырынча жок.", true)
        : null}

      {isCreateOpen ? (
        <div className="lesson-period-dialog" role="dialog" aria-modal="true" aria-labelledby="memo-letter-create-title">
          <form className="lesson-period-dialog__panel" onSubmit={handleCreate}>
            <h2 id="memo-letter-create-title"><T>{"Билдирме кат кошуу"}</T></h2>
            <label><T>{"Аталышы"}</T><input
                autoFocus
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="Документтин аталышы"
                value={draftTitle}
              />
            </label>
            {error ? <p className="form-error"><T>{error}</T></p> : null}
            <div className="lesson-period-dialog__actions">
              <button onClick={() => setIsCreateOpen(false)} type="button"><T>{"Жокко чыгаруу"}</T></button>
              <button type="submit"><T>{"Кошуу"}</T></button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

