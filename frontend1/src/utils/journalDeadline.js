const DAY_MS = 24 * 60 * 60 * 1000;
const bishkekClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bishkek",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export const getJournalUpdateWindow = (now) => {
  const parts = Object.fromEntries(bishkekClock.formatToParts(new Date(now))
    .map(({ type, value }) => [type, value]));
  const sinceMidnight = ((Number(parts.hour) * 60 + Number(parts.minute)) * 60
    + Number(parts.second)) * 1000 + ((now % 1000) + 1000) % 1000;
  const elapsed = (sinceMidnight - 8 * 60 * 60 * 1000 + DAY_MS) % DAY_MS;
  const start = now - elapsed;
  return { start, end: start + DAY_MS };
};

export const isJournalUpdatedToday = (updatedAt, now) => {
  const updatedTime = new Date(updatedAt || "").getTime();
  return Number.isFinite(updatedTime) && updatedTime <= now &&
    updatedTime >= getJournalUpdateWindow(now).start;
};

export const formatJournalUpdateCountdown = (now) => {
  const secondsLeft = Math.ceil((getJournalUpdateWindow(now).end - now) / 1000);
  return [Math.floor(secondsLeft / 3600), Math.floor(secondsLeft % 3600 / 60), secondsLeft % 60]
    .map((value) => String(value).padStart(2, "0")).join(":");
};
