import { createAsyncThunk } from "@reduxjs/toolkit";
import type { SubscriptionFilters } from "../../types/subscription";

export const fetchAllVendorSubscriptionsThunk = createAsyncThunk(
  "vendorSubscription/fetchAllVendorSubscriptions",
  async (filters: SubscriptionFilters | undefined, { rejectWithValue }) => {
    try {
      const query = new URLSearchParams();
      if (filters?.search) query.set("search", filters.search);
      if (filters?.status && filters.status !== "all") query.set("status", filters.status);

      const url = `/api/subscriptions/vender${query.toString() ? `?${query.toString()}` : ""}`;
      const response = await fetch(url);
      const data = await response.json();
      return data;
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to load vendor subscriptions");
    }
  }
);

export const fetchAllSubscriptionsThunk = fetchAllVendorSubscriptionsThunk;
