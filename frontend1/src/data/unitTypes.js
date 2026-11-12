export const unitLabels = {
  management: "Управление",
  subdivision: "Бөлүмчө",
  regional_department: "Аскер бөлүгү",
  outpost: "Застава",
  checkpoint: "КӨП",
  detachment: "Отряд",
  group: "Топ",
  company: "Рота",
  platoon: "Взвод",
  institution: "КЖжАККДБ",
  cynology: "Кинология кызматы",
  training_center_head: "Окуу борбордун башчысы",
  training_platoon_commander: "Окуу взводдун командири",
  course_head: "Курстун бачысы",
};

const roleLabels = {
  admin: "Администратор",
  regional: "Аскер бөлүгү",
  outpost: "Застава",
};

export const getUserTypeLabel = (user, fallbackRole) => {
  const role = user?.role || fallbackRole;
  if (role === "admin") return roleLabels.admin;
  return unitLabels[user?.unit_type] || user?.unit_type || roleLabels[role] || role || "";
};

export const isInstitutionSubunit = (unitType) => ["cynology", "course_head"].includes(unitType);

export const isTrainingUnit = (unitType) => ["training_center_head", "training_platoon_commander"].includes(unitType);

export const canShowModule = (user, moduleId) => !(
  moduleId === "youngSoldierTrainingCourse" && user?.role === "regional" &&
  String(user?.region || "").trim() === "2021"
);
export const TRAINING_UNIT_MODULES = [
  "home",
  "shootingStatements", "youngSoldierTrainingCourse", "smr", "combatTrainingPlan",
  "combatTrainingReport", "contactAdmin", "memoLetter", "outpostRating", "aboutPlatform", "games",
];

export const trainingContactLabel = (user) => user?.unit_type === "training_center_head"
  ? "Окуу взводтун командирлери менен байланыш"
  : user?.unit_type === "training_platoon_commander" ? "Окуу борбордун башчысы менен байланыш" : "";
