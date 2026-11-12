export const notifySave = (ok = true) => window.dispatchEvent(new CustomEvent('munara:save-feedback', {detail:{ok}}));
