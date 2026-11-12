import { T } from "../../../i18n.jsx";
import React, { useState } from "react";
import { useSelector } from "react-redux";

import { requestSubmissionEditPermission } from "../../../api/dashboard.js";
import { getApiErrorMessage } from "../../../api/errors.js";

export default function SubmissionEditPermissionButton({ submission, onUpdated }) {
  const user = useSelector((state) => state.auth.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isOwner = ["outpost", "regional"].includes(user?.role) && String(submission?.senderId) === String(user?.id);

  if (!isOwner) return null;

  if (submission.canEdit || submission.editRequestStatus === "approved") {
    return <span className="submission-edit-status submission-edit-status--approved"><T>{"Өзгөртүүгө болот"}</T></span>;
  }
  if (submission.editRequestStatus === "pending") {
    return <span className="submission-edit-status submission-edit-status--pending"><T>{"Сурам жөнөтүлдү"}</T></span>;
  }

  const requestPermission = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await requestSubmissionEditPermission(submission.id);
      onUpdated?.({ ...submission, editRequestStatus: result.status, canEdit: false });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Сурамды жөнөтүү мүмкүн болгон жок."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button disabled={loading} onClick={requestPermission} type="button">
        <T>{loading ? "Жөнөтүлүүдө..." : "Оңдоого уруксат суроо"}</T>
      </button>
      {error ? <small className="dashboard-error"><T>{error}</T></small> : null}
    </>
  );
}
