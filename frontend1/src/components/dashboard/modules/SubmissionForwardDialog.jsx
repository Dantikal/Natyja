import { T } from "../../../i18n.jsx";
import React, { useEffect, useState } from "react";

import { getApiErrorMessage } from "../../../api/errors.js";
import { confirmDocumentSend } from "../../../utils/confirmDocumentSend.js";

export default function SubmissionForwardDialog({ onClose, onForward, submission, titleLabel = "Документти администраторго жөнөтүү" }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setTitle(submission?.documentTitle || "");
    setError("");
  }, [submission]);

  if (!submission) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const documentTitle = title.trim();
    if (!documentTitle) {
      setError("Иш кагаздардын аталышын жазыңыз.");
      return;
    }

    if (!(await confirmDocumentSend())) return;

    setIsSending(true);
    setError("");
    try {
      await onForward(submission, documentTitle);
      onClose();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Документти жөнөтүү мүмкүн болгон жок."));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="lesson-period-dialog" role="dialog" aria-modal="true">
      <form className="lesson-period-dialog__panel" onSubmit={handleSubmit}>
        <h2>{titleLabel}</h2>
        <label><T>{"Иш кагаздардын аталышы"}</T><input
            autoFocus
            disabled={isSending}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>
        {error ? <p className="lesson-period-dialog__error"><T>{error}</T></p> : null}
        <div className="lesson-period-dialog__actions">
          <button disabled={isSending} onClick={onClose} type="button"><T>{"Жокко чыгаруу"}</T></button>
          <button disabled={isSending} type="submit">
            <T>{isSending ? "Жөнөтүлүүдө..." : "Жөнөтүү"}</T>
          </button>
        </div>
      </form>
    </div>
  );
}
