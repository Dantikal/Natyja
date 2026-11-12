import { T } from "../../i18n.jsx";
import { isTrainingUnit } from "../../data/unitTypes.js";
import React, { useEffect, useState } from "react";

import { getOutpostRatings, getRegionalUnitRatings } from "../../api/dashboard.js";
import { getApiErrorMessage } from "../../api/errors.js";
import { getMedal, RatingChart, RatingLeaderBadge, SECTION_LABELS } from "../admin/RegionalUnitRatingPage.jsx";

const MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const LAST_COMPLETED_MONTH = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

export default function OutpostRatingPage({ user }) {
  const training = isTrainingUnit(user?.unit_type);
  const [ownOutposts, setOwnOutposts] = useState(false);
  const showScore = user?.role === "outpost" || ownOutposts;
  const ratingTitle = ownOutposts ? "Болукчолордун рейтинги" : training ? (user.unit_type === "training_center_head" ? "Окуу борборлорунун рейтинги" : "Окуу взводдорунун рейтинги") : "Заставалардын рейтинги";
  const currentLabel = training ? (user.unit_type === "training_center_head" ? "Сиздин окуу борборуңуз" : "Сиздин окуу взводуңуз") : "Сиздин заставаңыз";
  const [ratings, setRatings] = useState([]);
  const [unitRatings, setUnitRatings] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsError, setUnitsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("rating");
  const [ratingPeriod, setRatingPeriod] = useState("month");
  const [ratingYear, setRatingYear] = useState(LAST_COMPLETED_MONTH.getFullYear());
  const [ratingMonth, setRatingMonth] = useState(LAST_COMPLETED_MONTH.getMonth() + 1);
  const [ratingHalf, setRatingHalf] = useState(new Date().getMonth() < 6 ? 1 : 2);
  const totalDocuments = ratings.reduce((sum, item) => sum + item.totalDocuments, 0);
  const chartData = ratings.map((item) => ({
    ...item,
    percentage: showScore
      ? Number(item.score) || 0
      : totalDocuments ? (item.totalDocuments / totalDocuments) * 100 : 0,
  }));
  const hasRatingData = chartData.some((item) => item.totalDocuments > 0 || item.percentage > 0);
  const chartMaximum = 100;
  const chartTicks = Array.from(
    { length: chartMaximum / 10 + 1 },
    (_, index) => chartMaximum - index * 10
  );
  const normalizeOutpostName = (value) => String(value || "")
    .replace(/\s+чек ара заставасы$/u, "")
    .trim()
    .toLocaleLowerCase("ky-KG");
  const isCurrentOutpost = (item) => training ? String(item.userId) === String(user?.id) : user?.role === "outpost" &&
    String(item.unitNumber) === String(user?.region) &&
    normalizeOutpostName(item.outpostName) === normalizeOutpostName(user?.outpost_name);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    const ratingsRequest = showScore
      ? getRegionalUnitRatings({ period: ratingPeriod, year: ratingYear, month: ratingMonth, half: ratingHalf, scope: ownOutposts ? "own-outposts" : undefined }).then((items) => items.outposts || [])
      : getOutpostRatings({ period: ratingPeriod, year: ratingYear, month: ratingMonth, half: ratingHalf });
    ratingsRequest
      .then((items) => {
        if (mounted) setRatings(items);
      })
      .catch((requestError) => {
        if (mounted) {
          setError(getApiErrorMessage(requestError, "Заставалардын рейтингин жүктөө мүмкүн болгон жок."));
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [ratingHalf, ratingMonth, ratingPeriod, ratingYear, user?.role, user?.unit_type, user?.region, ownOutposts]);

  useEffect(() => {
    if (user?.role !== "regional" || training) return undefined;
    let mounted = true;
    setUnitsLoading(true);
    setUnitsError("");
    getRegionalUnitRatings({ period: ratingPeriod, year: ratingYear, month: ratingMonth, half: ratingHalf })
      .then((items) => { if (mounted) setUnitRatings(items.units || []); })
      .catch((requestError) => {
        if (mounted) setUnitsError(getApiErrorMessage(requestError, "Аскер бөлүктөрүнүн рейтингин жүктөө мүмкүн болгон жок."));
      })
      .finally(() => { if (mounted) setUnitsLoading(false); });
    return () => { mounted = false; };
  }, [ratingHalf, ratingMonth, ratingPeriod, ratingYear, training, user?.role, user?.unit_type]);

  if (activeView === "units") {
    return (
      <section className="module-panel regional-rating">
        <button className="module-back-button" onClick={() => setActiveView("rating")} type="button"><T>{"Артка"}</T></button>
        <header className="module-header"><div><p className="eyebrow"><T>{"Жалпы система"}</T></p><h1><T>{"Аскер бөлүктөрдүн рейтинги"}</T></h1><p><T>{"Бардык аскер бөлүктөрүнүн рейтинги. Сиздин аскер бөлүгүңүз графикте жана тизмеде өзгөчө түс менен белгиленген."}</T></p></div></header>
        <div className="regional-rating-period-picker">
          <label><T>{"Мезгил"}</T><select onChange={(event) => setRatingPeriod(event.target.value)} value={ratingPeriod}><option value="month"><T>{"Айлык рейтинг"}</T></option><option value="half-year"><T>{"Жарым жылдык рейтинг"}</T></option><option value="year"><T>{"Жылдык рейтинг"}</T></option></select></label>
          <label><T>{"Жыл"}</T><select onChange={(event) => setRatingYear(Number(event.target.value))} value={ratingYear}>{Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          {ratingPeriod === "month" ? <label><T>{"Ай"}</T><select onChange={(event) => setRatingMonth(Number(event.target.value))} value={ratingMonth}>{MONTH_NAMES.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label> : null}
          {ratingPeriod === "half-year" ? <label><T>{"Жарым жылдык"}</T><select onChange={(event) => setRatingHalf(Number(event.target.value))} value={ratingHalf}><option value={1}><T>{"I жарым жылдык"}</T></option><option value={2}><T>{"II жарым жылдык"}</T></option></select></label> : null}
        </div>
        {unitsError ? <p className="dashboard-error">{unitsError}</p> : null}
        {unitsLoading ? <p className="dashboard-state"><T>{"Рейтинг жүктөлүүдө..."}</T></p> : null}
        {!unitsLoading && !unitsError && !unitRatings.length ? <p className="dashboard-state"><T>{"Рейтинг үчүн маалымат азырынча жок."}</T></p> : null}
        {!unitsLoading && !unitsError && unitRatings.length > 0 ? <RatingChart items={unitRatings} type="units" currentUnitNumber={user?.region} /> : null}
        <div className="regional-rating__list">
          {!unitsLoading && !unitsError && unitRatings.map((item) => {
            const isCurrent = String(item.unitNumber) === String(user?.region);
            return <article className={`regional-rating-card regional-rating-card--rank-${Math.min(item.rank, 4)}${isCurrent ? " regional-rating-card--current" : ""}`} key={item.unitNumber}>
              <div className="regional-rating-card__rank">{getMedal(item.rank)}</div>
              <div className="regional-rating-card__main"><RatingLeaderBadge rank={item.rank} /><h2>{item.unitNumber}<T>{" аскер бөлүгү"}</T></h2>{isCurrent ? <strong className="regional-rating-card__current-label"><T>{"Сиздин аскер бөлүгүңүз"}</T></strong> : null}</div>
              <div className="regional-rating-card__score"><strong>{item.score}%</strong><span><T>{"рейтинг"}</T></span></div>
            </article>;
          })}
        </div>
      </section>
    );
  }

  if (activeView === "chart") {
    return (
      <section className="module-panel regional-rating regional-rating-chart-page">
        <button className="module-back-button" onClick={() => setActiveView("rating")} type="button"><T>{"Артка"}</T></button>
        <header className="module-header">
          <div>
            <p className="eyebrow"><T>{`Аскер бөлүгү ${user?.region}`}</T></p>
            <h1><T>{ratingPeriod === "month" ? "Айлык рейтинг" : ratingPeriod === "half-year" ? "Жарым жылдык рейтинг" : "Жылдык рейтинг"}</T></h1>
            <p><T>{training ? "Ар бир тилке ушул мезгилдеги рейтингди көрсөтөт. Сиз алтын түс менен белгиленгенсиз." : showScore ? "Ар бир тилке заставанын ушул мезгилдеги реалдуу рейтингин көрсөтөт. " + (user?.role === "outpost" ? " Сиздин заставаңыз алтын түс менен белгиленген." : "") : "Ар бир тилке заставанын ушул мезгилдеги документтеринин үлүшүн көрсөтөт."}</T></p>
          </div>
        </header>
        <div className="regional-rating-period-picker">
          <label><T>{"Жыл"}</T><select onChange={(event) => setRatingYear(Number(event.target.value))} value={ratingYear}>{Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          {ratingPeriod === "month" ? <label><T>{"Ай"}</T><select onChange={(event) => setRatingMonth(Number(event.target.value))} value={ratingMonth}>{MONTH_NAMES.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label> : null}
          {ratingPeriod === "half-year" ? <label><T>{"Жарым жылдык"}</T><select onChange={(event) => setRatingHalf(Number(event.target.value))} value={ratingHalf}><option value={1}><T>{"I жарым жылдык"}</T></option><option value={2}><T>{"II жарым жылдык"}</T></option></select></label> : null}
        </div>
        {!loading && !error && !hasRatingData ? <p className="dashboard-state"><T>{"Бул мезгилде документтер жөнөтүлгөн эмес. Башка айды же мезгилди тандаңыз."}</T></p> : null}
        <div className="regional-rating-vertical-chart">
          <div className="regional-rating-vertical-chart__scroll">
            <div
              className="regional-rating-vertical-chart__canvas"
              style={{ minWidth: `${Math.max(620, chartData.length * 140)}px` }}
            >
              <div className="regional-rating-vertical-chart__axis">
                {chartTicks.map((tick) => (
                  <span key={tick} style={{ top: `${((chartMaximum - tick) / chartMaximum) * 300}px` }}>
                    {tick}%
                  </span>
                ))}
              </div>
              <div className="regional-rating-vertical-chart__plot">
                <div className="regional-rating-vertical-chart__grid">
                  {chartTicks.map((tick) => (
                    <span key={tick} style={{ top: `${((chartMaximum - tick) / chartMaximum) * 300}px` }} />
                  ))}
                </div>
                <div className="regional-rating-vertical-chart__columns">
                  {chartData.map((item) => {
                    const isCurrent = isCurrentOutpost(item);
                    return (
                    <div className={`regional-rating-vertical-chart__column${isCurrent ? " regional-rating-vertical-chart__column--current" : ""}`} key={item.userId || `${item.unitNumber}-${item.outpostName}`}>
                      <div className="regional-rating-vertical-chart__bar-area">
                        <span
                          aria-label={`${item.outpostName}: ${item.percentage.toFixed(1)}%`}
                          className={`regional-rating-vertical-chart__bar${isCurrent ? " regional-rating-vertical-chart__bar--current" : ""}`}
                          style={{ height: `${(item.percentage / chartMaximum) * 300}px` }}
                          title={`${item.outpostName}: ${showScore ? `${item.score}%` : `${item.totalDocuments} документ`}`}
                        ><i>{item.percentage.toFixed(1)}%</i></span>
                      </div>
                      <strong><RatingLeaderBadge rank={item.rank} />{item.outpostName}{user?.role === "outpost" ? ` · ${item.unitNumber}` : ""}{isCurrent ? <small>{currentLabel}</small> : null}</strong>
                    </div>
                  );})}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="module-panel regional-rating">
      <header className="module-header">
        <div>
          <p className="eyebrow"><T>{`Аскер бөлүгү ${user?.region}`}</T></p>
          <h1><T>{ratingTitle}</T></h1>
          <p><T>{training ? "Бирдей ролдогу бардык катышуучулардын рейтинги. Сиз тизмеде өзгөчө түс менен белгиленгенсиз." : user?.role === "outpost" ? "Сиздин аскер бөлүгүңүзгө караган бардык заставалар. Сиздин заставаңыз өзгөчө түс менен белгиленген." : "Сиздин аскер бөлүгүңүзгө караган бардык заставалардын рейтинги."}</T></p>
        </div>
        <button disabled={loading || ratings.length === 0} onClick={() => setActiveView("chart")} type="button"><T>{"График"}</T></button>
      </header>

      <div className="regional-rating-controls">
        {user?.role === "regional" && !training ? <button className={ownOutposts ? "is-active" : ""} onClick={() => { setOwnOutposts(true); setActiveView("rating"); }} type="button"><T>{"Болукчолордун рейтинги"}</T></button> : null}
        {user?.role === "regional" && !training ? <button onClick={() => setActiveView("units")} type="button"><T>{"Аскер бөлүктөрүнүн рейтинги жана графиги"}</T></button> : null}
        <button className={ratingPeriod === "month" ? "is-active" : ""} onClick={() => { setRatingPeriod("month"); setActiveView("chart"); }} type="button"><T>{"Айлык рейтинг"}</T></button>
        <button className={ratingPeriod === "half-year" ? "is-active" : ""} onClick={() => { setRatingPeriod("half-year"); setActiveView("chart"); }} type="button"><T>{"Жарым жылдык рейтинг"}</T></button>
        <button className={ratingPeriod === "year" ? "is-active" : ""} onClick={() => { setRatingPeriod("year"); setActiveView("chart"); }} type="button"><T>{"Жылдык рейтинг"}</T></button>
      </div>

      {error ? <p className="dashboard-error"><T>{error}</T></p> : null}
      {loading ? <p className="dashboard-state"><T>{"Рейтинг жүктөлүүдө..."}</T></p> : null}
      {!loading && !error && ratings.length === 0 ? (
        <p className="dashboard-state"><T>{"Заставалардын рейтинги үчүн маалымат азырынча жок."}</T></p>
      ) : null}
      {!loading && ratings.length > 0 ? (
        <div className="regional-rating__list">
          {ratings.map((item) => {
            const isCurrent = isCurrentOutpost(item);
            return (
            <article
              className={`regional-rating-card regional-rating-card--rank-${Math.min(item.rank, 4)}${isCurrent ? " regional-rating-card--current" : ""}`}
              key={item.userId || `${item.unitNumber}-${item.outpostName}`}
            >
              <div className="regional-rating-card__rank">{getMedal(item.rank)}</div>
              <div className="regional-rating-card__main"><RatingLeaderBadge rank={item.rank} />
                <h2><T>{item.outpostName}</T></h2>
                {item.trainingCenterName ? <span><T>{"Окуу борбору: "}</T>{item.trainingCenterName}</span> : null}
                {user?.role === "outpost" ? <span><T>{"Аскер бөлүгү: "}</T>{item.unitNumber}</span> : null}
                {isCurrent ? <strong className="regional-rating-card__current-label">{currentLabel}</strong> : null}
                <div className="regional-rating-card__sections">
                  {item.sections.length ? item.sections.map((section) => (
                    <span key={section.sectionId}>
                      {SECTION_LABELS[section.sectionId] || section.sectionId}: <strong>{section.count}</strong>
                    </span>
                  )) : <span><T>{"Документтер жөнөтүлө элек"}</T></span>}
                  {showScore ? <>
                    <span><T>{"Дедлайн: "}</T><strong>{item.deadlineScore}%</strong></span>
                    <span><T>{"Критерийлер үчүн айып: "}</T><strong>−{item.criteriaPenalty}%</strong></span>
                  </> : null}
                </div>
              </div>
              <div className="regional-rating-card__score">
                <strong>{showScore ? `${item.score}%` : item.totalDocuments}</strong>
                <span><T>{showScore ? "рейтинг" : "документ"}</T></span>
              </div>
            </article>
          );})}
        </div>
      ) : null}
    </section>
  );
}
