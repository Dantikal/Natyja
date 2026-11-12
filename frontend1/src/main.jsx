import SurfaceDepth from "./components/SurfaceDepth.jsx";
import DragScrollbars from "./components/DragScrollbars.jsx";
import TouchFeedback from "./components/TouchFeedback.jsx";
import HierarchicalBack from "./components/HierarchicalBack.jsx";
import EditRequestNotifications from "./components/EditRequestNotifications.jsx";
import KeyboardNavigation from "./components/KeyboardNavigation.jsx";
import MemoNotifications from "./components/MemoNotifications.jsx";
import ChatNotifications from "./components/ChatNotifications.jsx";
import SaveFeedback from "./components/SaveFeedback.jsx";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";

import App from "./App.jsx";
import { LanguageProvider } from "./i18n.jsx";
import SiteSettings from "./components/SiteSettings.jsx";
import AnnualArchiveSync from "./components/AnnualArchiveSync.jsx";
import { applyPreferences, readPreferences } from "./preferences.js";
import { store } from "./store.js";
import "./styles.css";
import "./styles/dashboard.css";
import "./styles/preferences.css";
import "./styles/responsive.css";
import "./styles/role-tabs.css";
import "./styles/auth-themes.css";

applyPreferences(readPreferences());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <LanguageProvider>
      <KeyboardNavigation />
      <TouchFeedback />
      <SurfaceDepth />
      <DragScrollbars />
      <HierarchicalBack />
      <App />
      <SiteSettings />
      <SaveFeedback />
      <ChatNotifications />
      <MemoNotifications />
      <EditRequestNotifications />
      <AnnualArchiveSync />
      </LanguageProvider>
    </Provider>
  </React.StrictMode>
);
import "./styles/theme-designs.css";

import "./styles/content-glass.css";
