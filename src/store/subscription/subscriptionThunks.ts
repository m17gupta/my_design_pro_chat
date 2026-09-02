import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchMySubscription,
  fetchAllSubscriptions,
  triggerExpiryCheck,
} from "../../lib/subscriptionApi";
import type { SubscriptionFilters } from "../../types/subscription";

export const fetchMySubscriptionThunk = createAsyncThunk(
  "subscription/fetchMySubscription",
  async (_, { rejectWithValue }) => {
    try {
      return await fetchMySubscription();
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to load vendor subscription status");
    }
  }
);

export const fetchAllSubscriptionsThunk = createAsyncThunk(
  "subscription/fetchAllSubscriptions",
  async (filters: SubscriptionFilters | undefined, { rejectWithValue }) => {
    try {
      return await fetchAllSubscriptions(filters);
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to load master vendor subscriptions list");
    }
  }
);

export const triggerExpiryCheckThunk = createAsyncThunk(
  "subscription/triggerExpiryCheck",
  async (_, { rejectWithValue }) => {
    try {
      return await triggerExpiryCheck();
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to execute manual email expiry check");
    }
  }
);
