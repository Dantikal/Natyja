let pending = 0;
const listeners = new Set();
export const getPendingRequests = () => pending;
export const subscribeToRequests = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const changePendingRequests = (delta) => {
  pending = Math.max(0, pending + delta);
  listeners.forEach((listener) => listener());
};
