import { T } from "../../i18n.jsx";
import { unitLabels } from "../../data/unitTypes.js";
import React from "react";
import { useEffect, useRef, useState } from "react";

import { api } from "../../api/client.js";
import { getApiErrorMessage } from "../../api/errors.js";

const namedSubunitLabels = {
  checkpoint: "Көзөмөл өткөрмө пунктунун аталышы",
  detachment: "Отрядтын аталышы",
  group: "Топтун аталышы",
  company: "Ротанын аталышы",
  platoon: "Взводдун аталышы",
};

const hasValue = (value) =>
  value !== null && value !== undefined && String(value).trim() !== "";

const getRegistrationRows = (request) =>
  [
    ["Аты-жөнү", request.full_name],
    ["Email", request.email],
    ["Телефон", request.phone],
    ["Аскердик наамы", request.military_rank],
    ["Кызматы", request.position],
    ["Бөлүкчө", unitLabels[request.unit_type] || request.unit_type],
    ["Аскер бөлүк", request.region],
    [
      namedSubunitLabels[request.unit_type] || "Застава",
      request.outpost_name,
    ],
  ].filter(([, value]) => hasValue(value));

const isAlreadyProcessedError = (error) =>
  error.response?.status === 400 &&
  ["PENDING", "уже обработана"].some((text) =>
    String(error.response?.data?.detail || "").includes(text)
  );

export default function AdminRequestsPage({ user }) {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const moderationInFlight = useRef(false);

  const loadRequests = async () => {
    const { data } = await api.get("/auth/admin/requests/");
    setRequests(data);
    setSelected(data[0] || null);
  };

  useEffect(() => {
    loadRequests().catch((err) =>
      setError(getApiErrorMessage(err, "Өтүнмөлөрдү жүктөө мүмкүн болгон жок."))
    );
  }, []);

  const moderate = async (decision) => {
    if (!selected || moderationInFlight.current) return;

    if (decision === "reject" && !reason.trim()) {
      setMessage("");
      setError("Четке кагуунун себебин көрсөтүңүз.");
      return;
    }

    moderationInFlight.current = true;
    setActionLoading(true);
    setMessage("");
    setError("");

    try {
      await api.post(`/auth/admin/requests/${selected.id}/moderate/`, {
        decision,
        rejection_reason: reason.trim(),
      });
      setMessage(
        decision === "approve"
          ? "Өтүнмө жактырылды."
          : "Өтүнмө четке кагылды, электрондук почта билдирүүсү жөнөтүлдү."
      );
      setReason("");
      await loadRequests();
    } catch (err) {
      if (isAlreadyProcessedError(err)) {
        setMessage("Бул өтүнмө иштетилген. Өтүнмөлөрдүн тизмеси жаңыртылды.");
        setReason("");
        await loadRequests();
      } else {
        setError(getApiErrorMessage(err, "Өтүнмөнү иштетүү мүмкүн болгон жок."));
      }
    } finally {
      moderationInFlight.current = false;
      setActionLoading(false);
    }
  };

  return (
    <section className="admin-layout">
      <aside className="panel">
        <h1><T>{"Жаңы өтүнмөлөр"}</T></h1>
        {requests.length === 0 && <p><T>{"Каралуучу өтүнмөлөр жок."}</T></p>}
        <div className="request-list">
          {requests.map((item) => (
            <button
              className={selected?.id === item.id ? "active-row" : ""}
              key={item.id}
              onClick={() => setSelected(item)}
            >
              <strong>{item.full_name}</strong>
              <span>{item.region}</span>
            </button>
          ))}
        </div>
      </aside>

      <article className="panel">
        {!selected && <p><T>{"Өтүнмөнү тандаңыз."}</T></p>}
        {selected && (
          <>
            <h2>{selected.full_name}</h2>
            <dl className="details">
              {getRegistrationRows(selected).map(([label, value]) => (
                <React.Fragment key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </React.Fragment>
              ))}
            </dl>
            <div className="photo-grid">
              <figure>
                <button
                  className="photo-preview-button"
                  onClick={() =>
                    setPreview({ src: selected.photo_face, alt: "Колдонуучунун сүрөтү" })
                  }
                  type="button"
                >
                  <img src={selected.photo_face} alt="Колдонуучунун сүрөтү" />
                </button>
                <figcaption><T>{"Колдонуучунун сүрөтү"}</T></figcaption>
              </figure>
            </div>
            <label><T>{"Четке кагуунун себеби"}</T><textarea disabled={!user?.is_superuser} value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            <div className="actions">
              <button disabled={actionLoading || !user?.is_superuser} onClick={() => moderate("approve")}>
                <T>{actionLoading ? "Иштетилүүдө..." : "Ырастоо"}</T>
              </button>
              <button
                className="danger"
                disabled={actionLoading || !user?.is_superuser}
                onClick={() => moderate("reject")}
              ><T>{"Четке кагуу"}</T></button>
            </div>
          </>
        )}
        {message && <p className="success"><T>{message}</T></p>}
        {error && <p className="error"><T>{error}</T></p>}
        {preview && (
          <div className="photo-lightbox" onClick={() => setPreview(null)}>
            <button
              aria-label="Жабуу"
              className="photo-lightbox__close"
              onClick={() => setPreview(null)}
              type="button"
            ><T>{"Жабуу"}</T></button>
            <img
              alt={preview.alt}
              onClick={(event) => event.stopPropagation()}
              src={preview.src}
            />
          </div>
        )}
      </article>
    </section>
  );
}
