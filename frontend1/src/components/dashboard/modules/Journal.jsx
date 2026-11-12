import { T } from "../../../i18n.jsx";
import React from "react";

export default function Journal({ data }) {
  return (
    <section className="module-panel">
      <header>
        <h1>{data?.title || "Уюштуруу"}</h1>
        <p><T>{"Кызматтын ыкчам жазуулары жана окуялары."}</T></p>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><T>{"Күнү"}</T></th>
              <th><T>{"Окуя"}</T></th>
              <th><T>{"Статусу"}</T></th>
            </tr>
          </thead>
          <tbody>
            {(data?.entries || []).map((entry) => (
              <tr key={`${entry.date}-${entry.event}`}>
                <td>{entry.date}</td>
                <td>{entry.event}</td>
                <td>{entry.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
