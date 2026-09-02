import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type {
  VendorSubscription,
  SubscriptionListResponse,
  SubscriptionFilters,
  TriggerExpiryCheckResponse,
} from "../../types/subscription";
import {
  fetchMySubscriptionThunk,
  fetchAllSubscriptionsThunk,
  triggerExpiryCheckThunk,
} from "./subscriptionThunks";

interface SubscriptionState {
  mySubscription: {
    data: VendorSubscription | null;
    loading: boolean;
    error: string | null;
  };
  adminSubscriptions: {
    data: SubscriptionListResponse | null;
    loading: boolean;
    error: string | null;
    filters: SubscriptionFilters;
  };
  triggeringExpiryCheck: boolean;
  triggerResult: TriggerExpiryCheckResponse | null;
  triggerError: string | null;
}

const initialState: SubscriptionState = {
  mySubscription: {
    data: null,
    loading: false,
    error: null,
  },
  adminSubscriptions: {
    data: null,
    loading: false,
    error: null,
    filters: {
      search: "",
      status: "all",
    },
  },
  triggeringExpiryCheck: false,
  triggerResult: null,
  triggerError: null,
};

export const subscriptionSlice = createSlice({
  name: "subscription",
  initialState,
  reducers: {
    setAdminFilters: (state, action: PayloadAction<Partial<SubscriptionFilters>>) => {
      state.adminSubscriptions.filters = {
        ...state.adminSubscriptions.filters,
        ...action.payload,
      };
    },
    clearTriggerResult: (state) => {
      state.triggerResult = null;
      state.triggerError = null;
    },
  },
  extraReducers: (builder) => {
    // Vendor Status
    builder.addCase(fetchMySubscriptionThunk.pending, (state) => {
      state.mySubscription.loading = true;
      state.mySubscription.error = null;
    });
    builder.addCase(fetchMySubscriptionThunk.fulfilled, (state, action) => {
      state.mySubscription.loading = false;
      state.mySubscription.data = action.payload;
    });
    builder.addCase(fetchMySubscriptionThunk.rejected, (state, action) => {
      state.mySubscription.loading = false;
      state.mySubscription.error = action.payload as string;
    });

    // Admin List
    builder.addCase(fetchAllSubscriptionsThunk.pending, (state) => {
      state.adminSubscriptions.loading = true;
      state.adminSubscriptions.error = null;
    });
    builder.addCase(fetchAllSubscriptionsThunk.fulfilled, (state, action) => {
      state.adminSubscriptions.loading = false;
      state.adminSubscriptions.data = action.payload;
    });
    builder.addCase(fetchAllSubscriptionsThunk.rejected, (state, action) => {
      state.adminSubscriptions.loading = false;
      state.adminSubscriptions.error = action.payload as string;
    });

    // Trigger Expiry Check
    builder.addCase(triggerExpiryCheckThunk.pending, (state) => {
      state.triggeringExpiryCheck = true;
      state.triggerResult = null;
      state.triggerError = null;
    });
    builder.addCase(triggerExpiryCheckThunk.fulfilled, (state, action) => {
      state.triggeringExpiryCheck = false;
      state.triggerResult = action.payload;
    });
    builder.addCase(triggerExpiryCheckThunk.rejected, (state, action) => {
      state.triggeringExpiryCheck = false;
      state.triggerError = action.payload as string;
    });
  },
});

export const { setAdminFilters, clearTriggerResult } = subscriptionSlice.actions;
export default subscriptionSlice.reducer;
