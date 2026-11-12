const AUTH_STORAGE_KEYS = [
  "access",
  "refresh",
  "access_token",
  "refresh_token",
  "user",
];

export const authStorage = window.sessionStorage;

// Older versions stored the active account for the whole localhost origin.
// Move that session into the current tab once, then stop sharing it with other tabs.
AUTH_STORAGE_KEYS.forEach((key) => {
  const legacyValue = window.localStorage.getItem(key);

  if (authStorage.getItem(key) === null && legacyValue !== null) {
    authStorage.setItem(key, legacyValue);
  }

  window.localStorage.removeItem(key);
});

export const clearAuthStorage = () => {
  AUTH_STORAGE_KEYS.forEach((key) => authStorage.removeItem(key));
};

export const readStoredUser = () => {
  try {
    const user = JSON.parse(authStorage.getItem("user") || "null");
    if (user && typeof user === "object" && !Array.isArray(user) && user.id && user.role) {
      return user;
    }
  } catch {
    // A malformed session must not prevent the login screen from rendering.
  }
  clearAuthStorage();
  return null;
};
