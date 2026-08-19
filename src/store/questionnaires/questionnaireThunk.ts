import { createAsyncThunk } from "@reduxjs/toolkit";
import { fetchQuestionnairesApi } from "../../lib/questionnairesApi";
import type { QuestionnairesResponse } from "./questionnaireType";

export const fetchQuestionnaires = createAsyncThunk<
  QuestionnairesResponse,
  void,
  { rejectValue: string }
>("questionnaires/fetchQuestionnaires", async (_, { rejectWithValue }) => {
  try {
    return await fetchQuestionnairesApi();
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Failed to fetch questionnaires"
    );
  }
});
