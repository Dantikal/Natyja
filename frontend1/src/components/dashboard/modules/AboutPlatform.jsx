import { T, useLanguage } from "../../../i18n.jsx";
import React, { useEffect, useRef, useState, useId } from "react";

import { useSelector } from "react-redux";
import { api } from "../../../api/client";

const platformFunctions = [
  {
    id: "01",
    title: "Маалыматтарды топтоо",
    description: "Күжүрмөн даярдоо боюнча маалыматтарды бирдиктүү санарип мейкиндикке чогултуу.",
  },
  {
    id: "02",
    title: "Каттоо жана сактоо",
    description: "Маалыматтарды электрондук түрдө каттап, ишенимдүү жана иреттүү сактоо.",
  },
  {
    id: "03",
    title: "Талдоо жана көзөмөл",
    description: "Көрсөткүчтөрдү талдап, даярдоонун жүрүшүнө үзгүлтүксүз көзөмөл жүргүзүү.",
  },
  {
    id: "04",
    title: "Отчетторду түзүү",
    description: "Топтолгон маалыматтардын негизинде тиешелүү отчетторду ыкчам даярдоо.",
  },
];

const projectTeam = [
  {
    id: "shakenov",
    role: "Проект жетекчиси",
    name: "полковник Шакенов М.С.",
    department: "Күжүрмөн даярдоо башкармалыгынын башчысы",
  },
  {
    id: "akmatov",
    role: "Иштеп чыгуу тобунун жетекчиси",
    name: "майор Акматов Б.А.",
    department: "Күжүрмөн даярдоо башкармалыгынын улук офицери",
  },
  {
    id: "saifudinov",
    role: "Иштеп чыгуучу",
    name: "Жарандык кызматкер Сайфудинов Д.А.",
    department: "Cанариптештирүү башкармалыгынын башкы адиси",
  },
];

const PlatformEmblem = () => {
 const id=useId().replace(/:/g,'');
 return <svg aria-hidden="true" className="about-platform__emblem" viewBox="0 0 120 120">
  <defs><linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f1dfa8"/><stop offset=".3" stopColor="#ba9b50"/><stop offset=".55" stopColor="#f4e5b7"/><stop offset=".75" stopColor="#8c7137"/><stop offset="1" stopColor="#c8af6b"/></linearGradient><clipPath id={`${id}-clip`}><path d="M60 6 105 22v32c0 28-18 49-45 60C33 103 15 82 15 54V22L60 6Z"/></clipPath></defs>
  <path className="about-shield-metal" style={{fill:`url(#${id}-metal)`}} d="M60 6 105 22v32c0 28-18 49-45 60C33 103 15 82 15 54V22L60 6Z"/>
  <path className="about-shield-core" d="M60 19 93 31v23c0 20-12 36-33 46-21-10-33-26-33-46V31l33-12Z"/>
  <path className="about-shield-star" style={{fill:`url(#${id}-metal)`}} d="m60 31 6.2 12.7 14 2-10.1 9.8 2.4 13.9L60 62.8 47.5 69.4l2.4-13.9-10.1-9.8 14-2L60 31Z"/>
  <g clipPath={`url(#${id}-clip)`}><path className="about-shield-glint" d="M-55-10h18l65 145H10Z"/></g>
 </svg>;
};
const FunctionIcon=({index})=><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{[
 <React.Fragment key="collect"><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M4 15v6h16v-6"/></React.Fragment>,
 <React.Fragment key="store"><path d="M4 3h14l2 2v16H4Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></React.Fragment>,
 <React.Fragment key="chart"><path d="M3 20h18M6 16v-5m6 5V5m6 11V9"/></React.Fragment>,
 <React.Fragment key="report"><path d="M5 3h10l4 4v14H5ZM14 3v5h5M8 12h8M8 16h6"/></React.Fragment>
][index]}</svg>;

export default function AboutPlatform() {
  const { t, language } = useLanguage();
  const pageRef = useRef(null);
  const user = useSelector((state) => state.auth.user);
  const isAdmin = user?.role === "admin" || user?.is_superuser;
  const [photos, setPhotos] = useState({});
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/auth/platform-team/").then(({ data }) => {
      if (active) setPhotos(Object.fromEntries(data.map((item) => [item.member, item.photo])));
    }).catch(() => {
      if (active) setError("Сүрөттөрдү жүктөө мүмкүн болгон жок. Баракты жаңыртыңыз.");
    });
    return () => { active = false; };
  }, []);

  const uploadPhoto = async (member, file) => {
    if (!file) return;
    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError("Сүрөт 5 МБ ашпашы керек.");
      return;
    }
    setUploading(member);
    const form = new FormData();
    form.append("member", member);
    form.append("photo", file);
    try {
      const { data } = await api.post("/auth/platform-team/", form);
      setPhotos((previous) => ({ ...previous, [member]: data.photo }));
    } catch {
      setError("Сүрөт сакталган жок. Сүрөт файлын текшерип, кайра аракет кылыңыз.");
    } finally {
      setUploading(null);
    }
  };

  useEffect(() => {
    const elements = pageRef.current?.querySelectorAll("[data-reveal]");
    if (!elements?.length) return undefined;

    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.14 }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <article className="about-platform" ref={pageRef}>
      <div aria-hidden="true" className="about-platform__glow about-platform__glow--one" />
      <div aria-hidden="true" className="about-platform__glow about-platform__glow--two" />

      <header className="about-platform__hero">
        <div className="about-platform__emblem-wrap">
          <span className="about-platform__emblem-ring" />
          <PlatformEmblem />
        </div>
        <div className="about-platform__heading">
          <span className="about-platform__eyebrow"><T>{"КҮЖҮРМӨН АСКЕР 1.0"}</T></span>
          <h1><T>{"Платформа боюнча"}</T></h1>
          <p><T>{"Күжүрмөн даярдоону башкаруунун бирдиктүү санарип мейкиндиги"}</T></p>
        </div>
        <div className="about-platform__order">
          <span><T>{"НЕГИЗ"}</T></span>
          <strong>№691</strong>
          <small>17.08.2026</small>
        </div>
      </header>

      <section className="about-platform__statement" data-reveal>
        <div className="about-platform__statement-mark" aria-hidden="true">“</div>
        <p><T>{"Кыргыз Республикасынын Мамлекеттик чек ара кызматынын төрагасы генерал-майор А.K.Алимбаевдин 2026-жылдын 17-августундагы №691 буйругунун негизинде күжүрмөн даярдоону санариптештирүүгө багытталган электрондук платформа ишке киргизилди."}</T></p>
      </section>

      <section className="about-platform__mission">
        <div className="about-platform__section-title" data-reveal>
          <span><T>{"НЕГИЗГИ МИЛДЕТТЕР"}</T></span>
          <h2><T>{"Платформанын мүмкүнчүлүктөрү"}</T></h2>
        </div>
        <p className="about-platform__mission-text" data-reveal style={{ "--reveal-delay": "80ms" }}><T>{"Платформанын негизги милдеттери — күжүрмөн даярдоо боюнча маалыматтарды топтоо, электрондук түрдө каттоо, сактоо, талдоо жана көзөмөл жүргүзүү, ошондой эле тиешелүү отчетторду түзүү."}</T></p>

        <div className="about-platform__functions">
          {platformFunctions.map((item, index) => (
            <div
              className="about-platform__function"
              data-reveal
              key={item.id}
              style={{ "--reveal-delay": `${index * 90}ms` }}
            >
              <span className="about-function-symbol"><FunctionIcon index={index}/><small>{item.id}</small></span>
              <div>
                <h3><T>{item.title}</T></h3>
                <p><T>{item.description}</T></p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="about-platform__team">
        <div className="about-platform__section-title" data-reveal>
          <h2><T>{"Күжүрмөн даярдоону санариптештирүү боюнча долбоордук топтун курамы"}</T></h2>
        </div>
        {error && <p role="alert"><T>{error}</T></p>}
        <div className="about-platform__team-grid">
          {projectTeam.map((member, index) => (
            <div
              className="about-platform__team-member"
              data-reveal
              key={member.id}
              style={{ "--reveal-delay": `${index * 110}ms` }}
            >
              {!photos[member.id] && <div className="about-team-initials" aria-hidden="true">{member.name.match(/[А-ЯЁ]\./g)?.join("").replaceAll(".","") || "КА"}</div>}
              {photos[member.id] && (
                <img className="about-platform__team-photo" src={photos[member.id]} alt={member.name} />
              )}
              <span className="about-platform__team-role"><T>{member.role}</T></span>
              <strong><T>{member.name}</T></strong>
              <p><T>{member.department}</T></p>
              {isAdmin && (
                <label className="about-platform__photo-control">
                  <span>{language === "ru" ? (uploading === member.id ? "Сохранение…" : "Изменить фото") : (uploading === member.id ? "Сакталууда…" : "Сүрөттү өзгөртүү")}</span>
                  <input type="file" accept="image/*" disabled={uploading !== null}
                    aria-label={`${t(member.name)}: ${t("Сүрөттү өзгөртүү")}`}
                    onChange={(event) => {
                      uploadPhoto(member.id, event.target.files?.[0]);
                      event.target.value = "";
                    }} />
                </label>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className="about-platform__footer" data-reveal>
        <div className="about-platform__footer-status">
          <span className="about-platform__status-dot" />
          <span><T>{"Электрондук платформа иштөөдө"}</T></span>
        </div>
        <span className="about-platform__footer-line" />
        <div className="about-platform__project-meta">
          <strong><T>{"КҮЖҮРМӨН АСКЕР"}</T></strong>
          <span>2026</span>
          <span><T>{"Версия 1.0"}</T></span>
        </div>
      </footer>
    </article>
  );
}
