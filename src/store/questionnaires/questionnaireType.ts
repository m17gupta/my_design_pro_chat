export interface AllQQuestion {
  id: string;
  type?: string;
  name?: string;
  details?: string;
  label?: string;
  placeholder?: string;
  max_files?: number;
  max_selection?: number;
  is_ai_design?: boolean;
  is_property_address?: boolean;
  example?: string;
  options?: string[] | Record<string, string>;
  multi_questions?: AllQQuestion[];
}

export interface AllQPhase {
  title: string;
  questions: AllQQuestion[];
}

/**
 * Root structure of the questionnaires JSON returned by the backend API:
 * nested mapping by role → user_type → (work_type →) phase_key → AllQPhase.
 */
export type QuestionnairesResponse = Record<string, unknown>;

export interface QuestionnairesState {
  data: QuestionnairesResponse | null;
  questionnaireSequence: string[];
  lifecycle: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
  lastFetchedAt: number | null;
}
