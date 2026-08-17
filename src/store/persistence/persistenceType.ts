import type { ApiBriefPayload } from "../../lib/apiBrief";
import type { EnterpriseEntry } from "../enterprise/enterpriseType";

/**
 * One row in `public.luna_my_design_projects`.
 *
 * `chats` holds the schema-shaped brief payload (all question answers +
 * context, see `payloadFromState`) so the transcript can be rebuilt on
 * refresh. `design_data` holds the design-history entries array (original +
 * revision rounds). Both are stored as-is (JSONB) so a refresh restores the
 * exact same Redux state.
 */
export interface LunaMyDesignProject {
  project_id: string;
  chats: ApiBriefPayload | null;
  design_data: EnterpriseEntry[] | null;
  created_at?: string;
  updated_at?: string;
}

/** UI-facing state of the persistence layer (hydration + save lifecycle). */
export interface PersistenceState {
  /** The project id (host params.id) the current session belongs to. */
  projectId: string | null;
  luna_data:LunaMyDesignProject|null,
  hydrated: boolean;
  /** True while a debounced save is in flight. */
  saving: boolean;
  /** ISO timestamp of the last successful row upsert. */
  lastSavedAt: string | null;
  isfetched:boolean
  error: string | null;
}
