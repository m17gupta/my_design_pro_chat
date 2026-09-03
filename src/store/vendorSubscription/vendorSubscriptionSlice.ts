import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { VendorItem, SubscriptionFilters } from "../../types/subscription";
import { fetchAllVendorSubscriptionsThunk } from "./vendorSubscriptionThunks";

interface VendorSubscriptionState {
  allVendor: VendorItem[];
  loading: boolean;
  error: string | null;
  filters: SubscriptionFilters;
}

const initialState: VendorSubscriptionState = {
  allVendor: [],
  loading: false,
  error: null,
  filters: {
    search: "",
    status: "all",
  },
};

export const vendorSubscriptionSlice = createSlice({
  name: "vendorSubscription",
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<SubscriptionFilters>>) => {
      state.filters = {
        ...state.filters,
        ...action.payload,
      };
    },
    setAdminFilters: (state, action: PayloadAction<Partial<SubscriptionFilters>>) => {
      state.filters = {
        ...state.filters,
        ...action.payload,
      };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchAllVendorSubscriptionsThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAllVendorSubscriptionsThunk.fulfilled, (state, action) => {
      state.loading = false;

      const payload = action.payload;
      let vendorList: VendorItem[] = [];

      if (Array.isArray(payload)) {
        vendorList = payload;
      } else if (payload && Array.isArray(payload.data)) {
        vendorList = payload.data;
      } else if (payload && Array.isArray(payload.allVendor)) {
        vendorList = payload.allVendor;
      } else if (payload && Array.isArray(payload.subscriptions)) {
        vendorList = payload.subscriptions;
      }

      state.allVendor = vendorList;
    });
    builder.addCase(fetchAllVendorSubscriptionsThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export const { setFilters, setAdminFilters } = vendorSubscriptionSlice.actions;
export default vendorSubscriptionSlice.reducer;
