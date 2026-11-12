import React from "react";
import ModuleTemplates from "./ModuleTemplates.jsx";

function templateModule(sectionId = "") {
  if (sectionId === "memo-letter") return "memoLetter";
  if (sectionId === "shooting-statements") return "shootingStatements";
  if (sectionId.startsWith("meetings-")) return "meetings";
  if (sectionId.startsWith("young-soldier-")) return "youngSoldierTrainingCourse";
  if (sectionId.includes("analysis")) return "combatTrainingAnalytics";
  if (sectionId.includes("journal")) return "combatTrainingJournal";
  if (sectionId.startsWith("combat-training-results")) return "combatTrainingResults";
  return "library";
}

export default function DocumentTemplateFrame({ sectionId, user, children }) {
  return <div className="module-with-templates">
    <ModuleTemplates moduleKey={templateModule(sectionId)} user={user} />
    {children}
  </div>;
}
