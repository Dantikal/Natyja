import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { getDashboardData } from "../../api/dashboard.js";
import { getApiErrorMessage } from "../../api/errors.js";

export const fetchDashboard = createAsyncThunk(
  "dashboard/fetchDashboard",
  async (role, { rejectWithValue }) => {
    try {
      return await getDashboardData(role);
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Башкаруу панелин жүктөө мүмкүн болгон жок.")
      );
    }
  }
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: {
    role: null,
    data: null,
    loading: false,
    error: null,
    requestId: null,
  },
  reducers: {
    resetDashboard(state) {
      state.role = null;
      state.data = null;
      state.loading = false;
      state.error = null;
      state.requestId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state, action) => {
        if (state.role !== action.meta.arg) state.data = null;
        state.requestId = action.meta.requestId;
        state.role = action.meta.arg;
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.requestId = null;
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.requestId = null;
        state.loading = false;
        state.error =
          action.payload || action.error?.message || "Башкаруу панелин жүктөө мүмкүн болгон жок.";
      });
  },
});

export const { resetDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;
