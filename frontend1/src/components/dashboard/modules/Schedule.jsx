import { T } from "../../../i18n.jsx";
import React from "react";

export default function Schedule({ data }) {
  return (
    <section className="module-panel">
      <header>
        <h1>{data?.title || "Пландоо"}</h1>
        <p><T>{"Нөөмөттөрдүн, наряддардын жана кезметтердин планы."}</T></p>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><T>{"Күнү"}</T></th>
              <th><T>{"Убакыт"}</T></th>
              <th><T>{"Наряд"}</T></th>
              <th><T>{"Статусу"}</T></th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((item) => (
              <tr key={`${item.date}-${item.name}`}>
                <td>{item.date}</td>
                <td>{item.time}</td>
                <td>{item.name}</td>
                <td>{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
