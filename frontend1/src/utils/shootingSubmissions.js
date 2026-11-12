// Older shooting statements are stored as observation subjects.
export const isShootingSubmission = (submission) =>
  submission.sectionId === "shooting-statements" ||
  (submission.sectionId === "combat-training-results-observation" &&
    ["observation-op", "observation-koj"].some(
      (key) => Boolean(submission.table?.subjects?.[key]),
    ));
