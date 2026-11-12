import {printAnalysisDocument,installAnalysisPrinting} from "../../utils/printAnalysis.js";
import { T } from "../../i18n.jsx";
import React, { useEffect, useState } from "react";

export default function DashboardPrintButton() {
  useEffect(()=>installAnalysisPrinting(),[]);
  const [hasOpenDocument, setHasOpenDocument] = useState(false);

  const findDocumentRoot = () => {
    const content = document.querySelector(".dashboard-content");
    const specialDocument = content?.querySelector(
      ".monthly-analysis-print-root, .combat-training-plan--draft-print, .methodical-document-page",
    );
    if (specialDocument) return specialDocument;

    const visibleBackButtons = [...(content?.querySelectorAll(".module-back-button") || [])]
      .filter((button) => button.getClientRects().length > 0);

    return visibleBackButtons
      .map((button) => button.closest(".module-panel"))
      .reverse()
      .find((panel) => panel?.querySelector(
        "table, textarea, .document-registry__paper, .docx-preview, [class*='word-page']",
      )) || null;
  };

  useEffect(() => {
    const updateAvailability = () => {
      setHasOpenDocument(Boolean(findDocumentRoot()));
    };

    updateAvailability();
    const observer = new MutationObserver(updateAvailability);
    const content = document.querySelector(".dashboard-content");
    if (content) observer.observe(content, { childList: true, subtree: true });
    window.addEventListener("resize", updateAvailability);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateAvailability);
    };
  }, []);

  const handlePrint = () => {
    const analysisRoot=document.querySelector('.monthly-analysis-print-root');
    if(analysisRoot){printAnalysisDocument(analysisRoot);return;}
    const specialPrintRoot = document.querySelector(
      ".monthly-analysis-print-root, .combat-training-plan--draft-print",
    );

    if (!specialPrintRoot) {
      const printRoot = findDocumentRoot();

      if (!printRoot) return;

      document.body.classList.add("dashboard-document-print");
      printRoot.classList.add("dashboard-document-print-root");
      window.addEventListener(
        "afterprint",
        () => {
          document.body.classList.remove("dashboard-document-print");
          printRoot.classList.remove("dashboard-document-print-root");
        },
        { once: true },
      );
    }

    window.print();
  };

  return hasOpenDocument ? (
    <div className="dashboard-print-toolbar no-print">
      <button className="dashboard-print-button" onClick={handlePrint} type="button"><T>{"Документти басып чыгаруу"}</T></button>
    </div>
  ) : null;
}
