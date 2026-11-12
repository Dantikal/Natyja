import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { api } from "../../api/client.js";
import { getApiErrorMessage } from "../../api/errors.js";
import { authStorage, clearAuthStorage, readStoredUser } from "./authStorage.js";

export const login = createAsyncThunk(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/login/", credentials);
      authStorage.setItem("access", data.access);
      authStorage.setItem("refresh", data.refresh);
      authStorage.setItem("access_token", data.access);
      authStorage.setItem("refresh_token", data.refresh);
      return data.user;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Системага кирүү мүмкүн болгон жок.")
      );
    }
  }
);

const initialUser = readStoredUser();

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: initialUser,
    loading: false,
    error: null,
  },
  reducers: {
    updateUser(state, action) {
      state.user = action.payload;
      authStorage.setItem("user", JSON.stringify(action.payload));
    },
    logout(state) {
      state.user = null;
      clearAuthStorage();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        authStorage.setItem("user", JSON.stringify(action.payload));
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ||
          action.error?.message ||
          "Системага кирүү мүмкүн болгон жок.";
      });
  },
});

export const { logout, updateUser } = authSlice.actions;
export default authSlice.reducer;
