import { createAsyncThunk } from "@reduxjs/toolkit";
import { fetchQuestionnairesApi } from "../../lib/questionnairesApi";
import type { QuestionnairesResponse, QuestionnairesState } from "./questionnaireType";

export const fetchQuestionnaires = createAsyncThunk<
  QuestionnairesResponse,
  { force?: boolean } | void,
  { state: { questionnaires?: QuestionnairesState }; rejectValue: string }
>(
  "questionnaires/fetchQuestionnaires",
  async (_, { rejectWithValue }) => {
    try {
      return await fetchQuestionnairesApi();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to fetch questionnaires"
      );
    }
  },
  {
    condition: (arg, { getState }) => {
      if (arg && typeof arg === "object" && arg.force) return true;
      const { questionnaires } = getState();
      if (questionnaires?.data !== null && questionnaires?.data !== undefined) {
        return false;
      }
      if (questionnaires?.lifecycle === "loading") {
        return false;
      }
      return true;
    },
  }
);
