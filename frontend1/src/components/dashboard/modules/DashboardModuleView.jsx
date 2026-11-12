import { isTrainingUnit, TRAINING_UNIT_MODULES } from "../../../data/unitTypes.js";
import React from "react";

import TrainingDocumentInbox from "./TrainingDocumentInbox.jsx";
import Analytics from "./Analytics.jsx";
import AboutPlatform from "./AboutPlatform.jsx";
import CombatTrainingJournal from "./CombatTrainingJournal.jsx";
import CombatTrainingNews from "./CombatTrainingNews.jsx";
import CombatTrainingPlan from "./CombatTrainingPlan.jsx";
import CombatTrainingResults from "./CombatTrainingResults.jsx";
import ContactAdmin from "./ContactAdmin.jsx";
import DocumentRegistry from "./DocumentRegistry.jsx";
import { ArchivedModuleContent } from "./DocumentYearArchive.jsx";
import Games from "./Games.jsx";
import DashboardHome from "./DashboardHome.jsx";
import Journal from "./Journal.jsx";
import Library from "./Library.jsx";
import Meetings from "./Meetings.jsx";
import MemoLetter from "./MemoLetter.jsx";
import ModuleTemplates from "./ModuleTemplates.jsx";
import Profile from "./Profile.jsx";
import SavedTables from "./SavedTables.jsx";
import Schedule from "./Schedule.jsx";
import ShootingStatements from "./ShootingStatements.jsx";
import SMR from "./SMR.jsx";
import YoungSoldierTrainingCourse from "./YoungSoldierTrainingCourse.jsx";

export default function DashboardModuleView({ activeModule, dashboardData, initialChatPartnerId, modules, onNavigate, onRefresh, user }) {
  if (isTrainingUnit(user?.unit_type) && ![...TRAINING_UNIT_MODULES, "profile"].includes(activeModule)) {
    return <ArchivedModuleContent key="shootingStatements" moduleId="shootingStatements" user={user}><ShootingStatements user={user} /></ArchivedModuleContent>;
  }
  const withTrainingInbox = (content) => user?.role === "regional" || user?.unit_type === "training_center_head"
    ? <TrainingDocumentInbox key={activeModule} user={user} moduleId={activeModule}>{content}</TrainingDocumentInbox> : content;
  const withTemplates = (moduleKey, content) => (
    <ArchivedModuleContent className="module-with-templates" key={moduleKey} moduleId={moduleKey} user={user}>
      <ModuleTemplates moduleKey={moduleKey} user={user} />
      {content}
    </ArchivedModuleContent>
  );

  if (activeModule === "home") {
    return <DashboardHome data={dashboardData?.home} modules={modules} onNavigate={onNavigate} user={user} />;
  }

  if (activeModule === "profile") {
    return <Profile user={user} />;
  }

  if (activeModule === "aboutPlatform") {
    return <AboutPlatform />;
  }

  if (activeModule === "games") {
    return <Games />;
  }

  if (activeModule === "library") {
    return withTemplates("library", <Library data={modules?.library} onRefresh={onRefresh} />);
  }

  if (activeModule === "combatTrainingJournal") {
    return withTemplates("combatTrainingJournal", (
      <CombatTrainingJournal
        data={modules?.combatTrainingJournal}
        methodicalSubjects={modules?.smr?.subjects || []}
        user={user}
      />
    ));
  }

  if (activeModule === "combatTrainingResults") {
    return withTemplates("combatTrainingResults", <CombatTrainingResults data={modules?.combatTrainingResults} user={user} />);
  }

  if (activeModule === "shootingStatements") {
    return <ArchivedModuleContent key="shootingStatements" moduleId="shootingStatements" user={user}>{withTrainingInbox(<ShootingStatements user={user} />)}</ArchivedModuleContent>;
  }

  if (activeModule === "meetings") {
    return withTemplates("meetings", <Meetings modules={modules} user={user} />);
  }

  if (activeModule === "youngSoldierTrainingCourse") {
    return <ArchivedModuleContent className="module-with-templates" key="youngSoldierTrainingCourse" moduleId="youngSoldierTrainingCourse" user={user}>
      <ModuleTemplates moduleKey="youngSoldierTrainingCourse" user={user} />
      {withTrainingInbox(<YoungSoldierTrainingCourse modules={modules} user={user} />)}
    </ArchivedModuleContent>;
  }

  if (activeModule === "combatTrainingPlan") {
    return withTemplates("combatTrainingPlan", <CombatTrainingPlan user={user} />);
  }

  if (activeModule === "combatTrainingReport") {
    return withTemplates("combatTrainingReport", <CombatTrainingNews user={user} />);
  }

  if (activeModule === "savedTables") {
    return <SavedTables />;
  }

  if (activeModule === "smr") {
    return withTemplates("smr", <SMR data={modules?.smr} user={user} />);
  }

  if (activeModule === "schedule") {
    return <Schedule data={modules?.schedule} />;
  }

  if (activeModule === "journal") {
    return <Journal data={modules?.journal} />;
  }

  if (activeModule === "analytics" || activeModule === "combatTrainingAnalytics") {
    return withTemplates("combatTrainingAnalytics", <Analytics data={modules?.analytics} user={user} />);
  }

  if (activeModule === "contactAdmin") {
    return withTemplates("contactAdmin", (
      <ContactAdmin
        initialPartnerId={initialChatPartnerId}
        user={user}
        onRefresh={onRefresh}
      />
    ));
  }

  if (activeModule === "memoLetter") {
    return <ArchivedModuleContent key="memoLetter" moduleId="memoLetter" user={user}>{withTrainingInbox(<MemoLetter user={user} />)}</ArchivedModuleContent>;
  }

  if (activeModule === "documents") {
    return <DocumentRegistry user={user} />;
  }

  return null;
}
