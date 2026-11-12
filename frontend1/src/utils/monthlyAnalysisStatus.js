const OFFSET = 6 * 60 * 60 * 1000;
export function getMonthlyAnalysisDeadline(now) {
  const local = new Date(Number(now) + OFFSET);
  let deadline = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 28, 23, 59, 59, 999) - OFFSET;
  if (Number(now) > deadline) deadline = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 28, 23, 59, 59, 999) - OFFSET;
  return new Date(deadline);
}
export function isMonthlyAnalysisSubmitted(submission, now) {
  const sentAt = Date.parse(submission?.createdAt || "");
  if (!Number.isFinite(sentAt) || sentAt > now) return false;
  const deadline = new Date(getMonthlyAnalysisDeadline(now).getTime() + OFFSET);
  const start = Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth() - 1, 28, 23, 59, 59, 999) - OFFSET;
  return sentAt > start;
}
export function formatMonthlyAnalysisCountdown(now) {
  const seconds = Math.max(0, Math.ceil((getMonthlyAnalysisDeadline(now).getTime() - now) / 1000));
  return `${Math.floor(seconds / 86400)} ${String(Math.floor(seconds % 86400 / 3600)).padStart(2,"0")}:${String(Math.floor(seconds % 3600 / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
}
