const KEY = "munara:preferences";
export const defaults = { theme: "green", sound: true, notificationSound: true, notificationTone: "bell", customToneName: "", motion: true, largeText: false };
export function readPreferences() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    return {
      theme: ["green", "blue", "light"].includes(saved?.theme) ? saved.theme : defaults.theme,
      sound: typeof saved?.sound === "boolean" ? saved.sound : defaults.sound,
      notificationSound: typeof saved?.notificationSound === "boolean" ? saved.notificationSound : (typeof saved?.sound === "boolean" ? saved.sound : defaults.notificationSound),
      notificationTone: ["bell", "chime", "soft", "custom"].includes(saved?.notificationTone) ? saved.notificationTone : "bell",
      customToneName: typeof saved?.customToneName === "string" ? saved.customToneName : "",
      motion: typeof saved?.motion === "boolean" ? saved.motion : defaults.motion,
      largeText: typeof saved?.largeText === "boolean" ? saved.largeText : defaults.largeText,
    };
  } catch { return { ...defaults }; }
}
export function applyPreferences(settings) {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.motion = settings.motion ? "on" : "off";
  document.documentElement.dataset.largeText = settings.largeText ? "on" : "off";
}
export function savePreferences(settings) {
  try { window.localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* Settings still apply for this visit. */ }
  applyPreferences(settings);
  window.dispatchEvent(new Event("preferences:changed"));
}
