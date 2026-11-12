import {useLanguage as useCopyLanguage} from "../../../i18n.jsx";
import { notifySave } from "../../../utils/saveFeedback.js";
import { T } from "../../../i18n.jsx";
import React, { useEffect, useState } from "react";

import {
  createModuleBanner,
  deleteModuleBanner,
  getModuleBanners,
  updateModuleBanner,
} from "../../../api/dashboard.js";
import { getApiErrorMessage } from "../../../api/errors.js";

const IMAGE_VIDEO_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,image/bmp,video/mp4,video/webm,video/quicktime,video/ogg,.jpg,.jpeg,.png,.gif,.webp,.bmp,.mp4,.webm,.mov,.m4v,.ogv";
const MAX_BANNERS = 3;

export default function ModuleBanners({ moduleKey, user }) {
 const {t:copyT}=useCopyLanguage();

  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [cardSlideIndex, setCardSlideIndex] = useState(0);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const canManage = user?.role === "admin";

  const closeEditor = () => {
    setIsUploadOpen(false);
    setEditingItem(null);
    setTitle("");
    setDescription("");
    setFiles([]);
    setFileInputKey((current) => current + 1);
  };

  const openCreate = () => {
    closeEditor();
    setIsUploadOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setTitle(item.title || "");
    setDescription(item.description || "");
    setFiles([]);
    setSelectedItem(null);
    setPreviewIndex(0);
    setIsUploadOpen(true);
  };

  useEffect(() => {
    let isCurrent = true;
    setError("");
    getModuleBanners(moduleKey)
      .then((data) => {
        if (!isCurrent) return;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(getApiErrorMessage(requestError, "Баннерлерди жүктөө мүмкүн болгон жок."));
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [moduleKey]);

  useEffect(() => {
    const mediaCount = selectedItem?.media?.length || 1;
    if (!selectedItem || mediaCount < 2 || isUploadOpen) return undefined;
    const intervalId = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % mediaCount);
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [isUploadOpen, selectedItem]);

  useEffect(() => {
    const hasMultipleMedia = items.some((item) => (item.media?.length || 1) > 1);
    if (!hasMultipleMedia) return undefined;
    const intervalId = window.setInterval(() => {
      setCardSlideIndex((current) => current + 1);
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [items]);

  const publish = async (event) => {
    event.preventDefault();
    if (!title.trim() || (!editingItem && files.length === 0)) return;
    setSaving(true);
    setError("");
    try {
      const payload = new FormData();
      payload.append("moduleKey", moduleKey);
      payload.append("title", title.trim());
      payload.append("description", description.trim());
      files.forEach((selectedFile) => payload.append("files", selectedFile));
      if (editingItem) {
        const updated = await updateModuleBanner(editingItem.id, payload);
        setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await createModuleBanner(payload);
        setItems((current) => [created, ...current]);
      }
      closeEditor();
    
      notifySave();
} catch (requestError) {
      notifySave(false);

      setError(getApiErrorMessage(requestError, "Баннерди жарыялоо мүмкүн болгон жок."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`«${item.title}» баннерин өчүрөсүзбү?`)) return;
    setDeletingId(item.id);
    setError("");
    try {
      await deleteModuleBanner(item.id);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      if (selectedItem?.id === item.id) setSelectedItem(null);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Баннерди өчүрүү мүмкүн болгон жок."));
    } finally {
      setDeletingId(null);
    }
  };

  const displayedItems = [...items].reverse();
  const previewMedia = selectedItem
    ? (selectedItem.media?.length ? selectedItem.media : [selectedItem])
    : [];
  const activePreviewMedia = previewMedia[previewIndex] || previewMedia[0] || null;

  return (
    <section className="module-banners" aria-label={copyT("Бөлүмдүн баннерлери")}>
      <div className="module-banners__toolbar">
        {canManage ? (
          <>
            <span className="module-banners__counter">{items.length}/{MAX_BANNERS}</span>
            <button
              className="module-banner-add"
              disabled={items.length >= MAX_BANNERS}
              onClick={openCreate}
              title={items.length >= MAX_BANNERS ? "Эң көп дегенде 3 баннер кошууга болот" : ""}
              type="button"
            ><T>{"+ Баннер кошуу"}</T></button>
          </>
        ) : null}
      </div>

      {error ? <p className="dashboard-error"><T>{error}</T></p> : null}

      {displayedItems.length ? (
        <div className="module-banner-grid">
          {displayedItems.map((item) => {
            const cardMedia = item.media?.length ? item.media : [item];
            const activeCardMedia = cardMedia[cardSlideIndex % cardMedia.length];
            return (
              <article className="module-banner-card" key={item.id}>
                <button
                  aria-label={`${item.title} баннерин чоң ачуу`}
                  className="module-banner-card__open"
                  onClick={() => {
                    setPreviewIndex(0);
                    setSelectedItem(item);
                  }}
                  type="button"
                >
                  {activeCardMedia.kind === "video" ? (
                    <video autoPlay key={activeCardMedia.fileUrl} loop muted playsInline src={activeCardMedia.fileUrl} />
                  ) : (
                    <img alt={item.title} key={activeCardMedia.fileUrl} src={activeCardMedia.fileUrl} />
                  )}
                  <span className="module-banner-card__shade" />
                  <span className="module-banner-card__caption">
                    <strong><T>{item.title}</T></strong>
                    {item.description ? <small>{item.description}</small> : null}
                  </span>
                  {cardMedia.length > 1 ? (
                    <span className="module-banner-card__dots" aria-hidden="true">
                      {cardMedia.map((media, index) => (
                        <span className={index === cardSlideIndex % cardMedia.length ? "is-active" : ""} key={media.id || index} />
                      ))}
                    </span>
                  ) : null}
                </button>
                {canManage ? (
                  <button
                    className="module-banner-card__delete"
                    disabled={deletingId === item.id}
                    onClick={() => remove(item)}
                    type="button"
                  >
                    <T>{deletingId === item.id ? "..." : "Өчүрүү"}</T>
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {isUploadOpen ? (
        <div className="module-banner-modal" role="dialog" aria-modal="true" aria-labelledby="module-banner-upload-title">
          <form className="module-banner-modal__panel module-banner-upload" onSubmit={publish}>
            <header>
              <h2 id="module-banner-upload-title"><T>{editingItem ? "Баннерди өзгөртүү" : "Баннер жарыялоо"}</T></h2>
              <button aria-label="Жабуу" onClick={closeEditor} type="button">×</button>
            </header>
            <label><T>{"Аталышы"}</T><input maxLength={255} onChange={(event) => setTitle(event.target.value)} required value={title} />
            </label>
            <label><T>{"Кошумча маалымат"}</T><textarea onChange={(event) => setDescription(event.target.value)} rows={5} value={description} />
            </label>
            <label>
              <T>{editingItem ? "Жаңы сүрөттөрдү же видеолорду кошуу" : "Сүрөттөр же видеолор"}</T>
              <input
                accept={IMAGE_VIDEO_ACCEPT}
                key={fileInputKey}
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
                required={!editingItem}
                type="file"
              />
              <small><T>{"Бир убакта бир нече файл тандасаңыз болот (эң көбү 10)."}</T></small>
            </label>
            <div className="module-banner-modal__actions">
              <button disabled={saving} onClick={closeEditor} type="button"><T>{"Жокко чыгаруу"}</T></button>
              <button disabled={saving || !title.trim() || (!editingItem && files.length === 0)} type="submit">
                <T>{saving ? "Сакталууда..." : editingItem ? "Сактоо" : "Жарыялоо"}</T>
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {selectedItem ? (
        <div className="module-banner-modal" role="dialog" aria-modal="true" aria-labelledby="module-banner-preview-title">
          <article className="module-banner-modal__panel module-banner-preview">
            <header>
              <h2 id="module-banner-preview-title"><T>{selectedItem.title}</T></h2>
              <button aria-label="Жабуу" onClick={() => setSelectedItem(null)} type="button">×</button>
            </header>
            <div className="module-banner-preview__carousel">
              {activePreviewMedia?.kind === "video" ? (
                <video autoPlay controls key={activePreviewMedia.fileUrl} muted src={activePreviewMedia.fileUrl} />
              ) : (
                <img alt={selectedItem.title} key={activePreviewMedia?.fileUrl} src={activePreviewMedia?.fileUrl} />
              )}
              {previewMedia.length > 1 ? (
                <>
                  <button
                    aria-label={copyT("Мурунку сүрөт")}
                    className="module-banner-preview__arrow module-banner-preview__arrow--left"
                    onClick={() => setPreviewIndex((current) => (current - 1 + previewMedia.length) % previewMedia.length)}
                    type="button"
                  >‹</button>
                  <button
                    aria-label={copyT("Кийинки сүрөт")}
                    className="module-banner-preview__arrow module-banner-preview__arrow--right"
                    onClick={() => setPreviewIndex((current) => (current + 1) % previewMedia.length)}
                    type="button"
                  >›</button>
                  <div className="module-banner-preview__dots">
                    {previewMedia.map((media, index) => (
                      <button
                        aria-label={`${index + 1}-сүрөт`}
                        className={index === previewIndex ? "is-active" : ""}
                        key={media.id || index}
                        onClick={() => setPreviewIndex(index)}
                        type="button"
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            {selectedItem.description ? <p>{selectedItem.description}</p> : null}
            {canManage ? (
              <div className="module-banner-preview__actions">
                <button onClick={() => openEdit(selectedItem)} type="button"><T>{"Сүрөт кошуу же өзгөртүү"}</T></button>
                <button className="danger" disabled={deletingId === selectedItem.id} onClick={() => remove(selectedItem)} type="button">
                  <T>{deletingId === selectedItem.id ? "Өчүрүлүүдө..." : "Өчүрүү"}</T>
                </button>
              </div>
            ) : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
