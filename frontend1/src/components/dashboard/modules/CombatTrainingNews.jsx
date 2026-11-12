import { T } from "../../../i18n.jsx";
import React, { useEffect, useRef, useState } from "react";

import {
  createCombatTrainingNews,
  deleteCombatTrainingNews,
  getCombatTrainingNews,
  markAllCombatTrainingNewsRead,
  toggleCombatTrainingNewsReaction,
  updateCombatTrainingNews,
} from "../../../api/dashboard.js";
import { getApiErrorMessage } from "../../../api/errors.js";

const ACCEPTED_FILES =
  ".doc,.docx,.pdf,.txt,.rtf,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp4,.webm,.mov,.avi,.mkv,.mp3,.wav,.ogg,.m4a,.zip,.rar,.7z";
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_FILES = 10;

const REACTIONS = [
  { type: "like", icon: "👍", label: "Жакты" },
  { type: "love", icon: "❤️", label: "Сүйүү" },
  { type: "laugh", icon: "😂", label: "Күлкү" },
  { type: "wow", icon: "😮", label: "Таң калуу" },
  { type: "clap", icon: "👏", label: "Кол чабуу" },
];

const emptyDraft = () => ({
  body: "",
  files: [],
  id: null,
  removeAttachmentIds: [],
  title: "",
});

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ky-KG", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatFileSize = (size) => {
  if (!size) return "";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(size / 1024))} КБ`;
};

function NewsVideo({ attachment }) {
  const videoRef = useRef(null);
  const playbackStarted = useRef(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  const enableSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    video.play().catch(() => {});
  };

  return (
    <figure
      className="combat-news-attachment combat-news-attachment--video"
      style={{ "--video-aspect": aspectRatio }}
    >
      <video
        controls
        onLoadedMetadata={(event) => {
          const { videoWidth, videoHeight } = event.currentTarget;
          if (videoWidth && videoHeight) setAspectRatio(videoWidth / videoHeight);
        }}
        onPlay={(event) => {
          if (playbackStarted.current) return;
          playbackStarted.current = true;
          event.currentTarget.muted = false;
          event.currentTarget.volume = 1;
        }}
        preload="metadata"
        ref={videoRef}
        src={attachment.fileUrl}
      />
      <button className="combat-news-attachment__sound" onClick={enableSound} type="button"><T>{"🔊 Үндү күйгүзүү"}</T></button>
      <figcaption>
        <a href={attachment.fileUrl} rel="noreferrer" target="_blank">
          {attachment.originalName}
        </a>
        <span>{formatFileSize(attachment.size)}</span>
      </figcaption>
    </figure>
  );
}

export default function CombatTrainingNews({ user }) {
  const [newsItems, setNewsItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingReactionNewsIds, setPendingReactionNewsIds] = useState(() => new Set());
  const isAdmin = user?.role === "admin";
  const canPublish = isAdmin || user?.role === "regional";
  const canManage = (news) => isAdmin || (
    user?.role === "regional" && String(news.authorId) === String(user?.id)
  );

  const loadNews = async () => {
    setLoading(true);
    setError("");
    try {
      const items = await getCombatTrainingNews();
      setNewsItems(items);
      await markAllCombatTrainingNewsRead();
      window.dispatchEvent(new CustomEvent("combat-training-news-read"));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Жарыяларды жүктөө мүмкүн болгон жок."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

  const closeEditor = () => {
    setDraft(emptyDraft());
    setIsEditorOpen(false);
  };

  const openCreate = () => {
    setError("");
    setNotice("");
    setDraft(emptyDraft());
    setIsEditorOpen(true);
  };

  const openEdit = (news) => {
    setError("");
    setNotice("");
    setDraft({
      body: news.body || "",
      files: [],
      id: news.id,
      removeAttachmentIds: [],
      title: news.title || "",
    });
    setIsEditorOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (draft.files.length > MAX_FILES) {
      setError(`Можно прикрепить не более ${MAX_FILES} файлов.`);
      return;
    }
    const oversizedFile = draft.files.find((file) => file.size > MAX_FILE_SIZE);
    if (oversizedFile) {
      setError(`Файл «${oversizedFile.name}» превышает 100 МБ.`);
      return;
    }

    setSubmitting(true);

    const payload = new FormData();
    payload.append("title", draft.title.trim());
    payload.append("body", draft.body.trim());
    draft.files.forEach((file) => payload.append("files", file));
    if (draft.id) {
      payload.append("removeAttachmentIds", JSON.stringify(draft.removeAttachmentIds));
    }

    try {
      const savedNews = draft.id
        ? await updateCombatTrainingNews(draft.id, payload)
        : await createCombatTrainingNews(payload);
      setNewsItems((currentItems) =>
        draft.id
          ? currentItems.map((item) => (item.id === savedNews.id ? savedNews : item))
          : [savedNews, ...currentItems]
      );
      closeEditor();
      setNotice(draft.id ? "Публикация изменена." : "Публикация добавлена.");
    } catch (requestError) {
      setError(requestError.response?.status === 413
        ? "Общий размер файлов слишком большой для загрузки. Попробуйте загрузить меньше файлов за раз."
        : getApiErrorMessage(requestError, "Жарыяны сактоо мүмкүн болгон жок."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (news) => {
    if (!window.confirm(`«${news.title}» жарыясы өчүрүлсүнбү?`)) return;
    setError("");
    setNotice("");
    try {
      await deleteCombatTrainingNews(news.id);
      setNewsItems((currentItems) => currentItems.filter((item) => item.id !== news.id));
      setNotice("Публикация удалена.");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Жарыяны өчүрүү мүмкүн болгон жок."));
    }
  };

  const handleReaction = async (newsId, reaction) => {
    setPendingReactionNewsIds((current) => new Set(current).add(newsId));
    try {
      const reactionState = await toggleCombatTrainingNewsReaction(newsId, reaction);
      setNewsItems((currentItems) =>
        currentItems.map((item) =>
          item.id === newsId ? { ...item, ...reactionState } : item
        )
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Реакцияны өзгөртүү мүмкүн болгон жок."));
    } finally {
      setPendingReactionNewsIds((current) => {
        const next = new Set(current);
        next.delete(newsId);
        return next;
      });
    }
  };

  const toggleAttachmentRemoval = (attachmentId) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      removeAttachmentIds: currentDraft.removeAttachmentIds.includes(attachmentId)
        ? currentDraft.removeAttachmentIds.filter((id) => id !== attachmentId)
        : [...currentDraft.removeAttachmentIds, attachmentId],
    }));
  };

  const editedNews = draft.id
    ? newsItems.find((news) => news.id === draft.id)
    : null;

  return (
    <section className="module-panel combat-news">
      <header className="module-header combat-news__header">
        <h1><T>{"Күжүрмөн даярдоонун маалыматтары"}</T></h1>
        {canPublish && (
          <button onClick={openCreate} type="button"><T>{"+ Маалымат кошуу"}</T></button>
        )}
      </header>

      {notice && <p className="dashboard-notice">{notice}</p>}
      {error && <p className="dashboard-error"><T>{error}</T></p>}

      {loading ? (
        <p className="dashboard-state"><T>{"Жарыялар жүктөлүүдө..."}</T></p>
      ) : newsItems.length === 0 ? (
        <p className="dashboard-state"><T>{"Жарыялар азырынча жок."}</T></p>
      ) : (
        <div className="combat-news__feed">
          {newsItems.map((news) => (
            <article className="combat-news-card" key={news.id}>
              <header>
                <div>
                  <h2>{news.title}</h2>
                  <span>{news.authorName} · {formatDate(news.createdAt)}</span>
                </div>
                {canManage(news) && (
                  <div className="combat-news-card__admin-actions">
                    <button onClick={() => openEdit(news)} type="button"><T>{"Өзгөртүү"}</T></button>
                    <button onClick={() => handleDelete(news)} type="button"><T>{"Өчүрүү"}</T></button>
                  </div>
                )}
              </header>

              {news.body && <p className="combat-news-card__body">{news.body}</p>}

              {news.attachments?.length > 0 && (
                <div className="combat-news-card__attachments">
                  {news.attachments.map((attachment) => (
                    attachment.kind === "video" ? (
                      <NewsVideo attachment={attachment} key={attachment.id} />
                    ) : <figure className={`combat-news-attachment combat-news-attachment--${attachment.kind}`} key={attachment.id}>
                      {attachment.kind === "image" ? (
                        <img alt={attachment.originalName} src={attachment.fileUrl} />
                      ) : attachment.kind === "audio" ? (
                        <audio controls preload="metadata" src={attachment.fileUrl} />
                      ) : attachment.kind === "pdf" ? (
                        <iframe src={attachment.fileUrl} title={attachment.originalName} />
                      ) : null}
                      <figcaption>
                        <a href={attachment.fileUrl} rel="noreferrer" target="_blank">
                          {attachment.originalName}
                        </a>
                        <span>{formatFileSize(attachment.size)}</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}

              <footer className="combat-news-card__reactions" aria-label="Реакциялар">
                {REACTIONS.map(({ type, icon, label }) => {
                  const isSelected = (news.userReactions || []).includes(type);
                  return (
                    <button
                      aria-label={`${label}: ${news.reactionCounts?.[type] || 0}`}
                      aria-pressed={isSelected}
                      className={isSelected ? "is-liked" : ""}
                      disabled={pendingReactionNewsIds.has(news.id)}
                      key={type}
                      onClick={() => handleReaction(news.id, type)}
                      title={label}
                      type="button"
                    >
                      {icon} {news.reactionCounts?.[type] || 0}
                    </button>
                  );
                })}
              </footer>
            </article>
          ))}
        </div>
      )}

      {isEditorOpen && (
        <div className="combat-journal-dialog" role="dialog" aria-modal="true">
          <form className="combat-journal-dialog__panel combat-news-editor" onSubmit={handleSubmit}>
            <h2><T>{draft.id ? "Жарыялоону өзгөртүү" : "Маалымат кошуу"}</T></h2>
            <label><T>{"Аталышы"}</T><input
                autoFocus
                disabled={submitting}
                maxLength={255}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                required
                value={draft.title}
              />
            </label>
            <label><T>{"Текст"}</T><textarea
                disabled={submitting}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                rows={7}
                value={draft.body}
              />
            </label>
            {editedNews?.attachments?.length > 0 && (
              <div className="combat-news-editor__existing-files">
                <strong><T>{"Жүктөлгөн файлдар"}</T></strong>
                {editedNews.attachments.map((attachment) => (
                  <label key={attachment.id}>
                    <input
                      checked={draft.removeAttachmentIds.includes(attachment.id)}
                      onChange={() => toggleAttachmentRemoval(attachment.id)}
                      type="checkbox"
                    /><T>{"Өчүрүү "}</T>{attachment.originalName}
                  </label>
                ))}
              </div>
            )}
            <label><T>{"Файлдар (10 файлга чейин, ар бири 100 МБ чейин)"}</T><span className="combat-news-editor__file-picker"><T>{"Файлды тандоо"}</T>{draft.files.length > 0 ? ` (${draft.files.length})` : ""}
              </span>
              <input
                accept={ACCEPTED_FILES}
                disabled={submitting}
                multiple
                onChange={(event) => setDraft((current) => ({ ...current, files: Array.from(event.target.files || []) }))}
                style={{ display: "none" }}
                type="file"
              />
            </label>
            <div className="combat-journal-dialog__actions">
              <button disabled={submitting} onClick={closeEditor} type="button"><T>{"Жокко чыгаруу"}</T></button>
              <button disabled={submitting || !draft.title.trim()} type="submit">
                <T>{submitting ? "Сакталууда..." : "Жүктөө"}</T>
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
