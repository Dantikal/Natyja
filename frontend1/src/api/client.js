import axios from "axios";
import { changePendingRequests } from "./loading.js";

import { authStorage, clearAuthStorage } from "../features/auth/authStorage.js";

const API_BASE_URL = import.meta.env?.VITE_API_URL || "http://127.0.0.1:8000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

const getAccessToken = () =>
  authStorage.getItem("access") || authStorage.getItem("access_token");

const getRefreshToken = () =>
  authStorage.getItem("refresh") || authStorage.getItem("refresh_token");

const setAccessToken = (token) => {
  authStorage.setItem("access", token);
  authStorage.setItem("access_token", token);
};

let observedUnit = '';
export const isObservingUnit = () => !!observedUnit;
export const setObservedUnit = unit => { observedUnit = unit || ''; };
let refreshRequest = null;
const expireSession = () => {
  clearAuthStorage();
  window.dispatchEvent(new Event("auth:expired"));
};

api.interceptors.request.use((config) => {
  if (typeof FormData !== "undefined" && config.data instanceof FormData && config.timeout === 30000) {
    config.timeout = 120000;
  }
  if (observedUnit && /^(\/dashboard\/|\/auth\/chat\/|\/training\/)/.test(config.url || '')) {
    config.headers['X-Observe-Unit'] = observedUnit;
    if (!['get','head','options'].includes((config.method || 'get').toLowerCase())) {
      return Promise.reject(new Error('Cabinet is read-only'));
    }
  }
  const token = getAccessToken();
  config._sessionRefresh = getRefreshToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config._loadingTracked = true;
  changePendingRequests(1);
  return config;
});

const finishLoading = (config) => {
  if (config?._loadingTracked) {
    config._loadingTracked = false;
    changePendingRequests(-1);
  }
};

api.interceptors.response.use(
  (response) => {
    finishLoading(response.config);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    finishLoading(originalRequest);
    const refresh = getRefreshToken();
    if (originalRequest && originalRequest._sessionRefresh !== refresh) {
      return Promise.reject(error);
    }

    const isAuthRequest = /\/auth\/(login|register|refresh)\/?$/.test(originalRequest?.url || "");
    if (error.response?.status === 401 && originalRequest && !isAuthRequest) {
      if (!refresh || originalRequest._retry) {
        expireSession();
        return Promise.reject(error);
      }
      originalRequest._retry = true;

      try {
        if (!refreshRequest) {
          refreshRequest = axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh }, { timeout: 15000 })
            .then(({ data }) => {
              if (getRefreshToken() !== refresh) throw new Error("Session changed");
              setAccessToken(data.access);
              return data;
            })
            .catch((refreshError) => {
              if (getRefreshToken() === refresh && [400, 401, 403].includes(refreshError.response?.status)) {
                expireSession();
              }
              throw refreshError;
            })
            .finally(() => { refreshRequest = null; });
        }
        const data = await refreshRequest;
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
