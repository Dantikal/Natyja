import { configureStore } from "@reduxjs/toolkit";

import dashboardReducer from "./features/dashboard/dashboardSlice.js";
import authReducer from "./features/auth/authSlice.js";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
  },
});
