/**
 * Utilities to transform standard design-brief payloads into the format
 * expected by the enterprise-client endpoints:
 *   - POST /api/v1/luna/landscape-design
 *   - POST /api/v1/luna/color-material
 */

/** Extract clean answer value from a brief item or raw answer object. */
export function extractAnswerValue(item: unknown): unknown {
  if (item === null || item === undefined) return null;

  // If already a primitive or array, return directly
  if (typeof item !== "object" || Array.isArray(item)) {
    return item;
  }

  // If wrapped in an item with { name, question, answer }
  const answer = "answer" in item ? (item as { answer: unknown }).answer : item;
  if (answer === null || answer === undefined) return null;

  if (typeof answer !== "object" || Array.isArray(answer)) {
    return answer;
  }

  const ansObj = answer as Record<string, unknown>;

  // Handle { value: string[] | string, notes?: string }
  if ("value" in ansObj) {
    const val = ansObj.value;
    const notes = typeof ansObj.notes === "string" ? ansObj.notes.trim() : "";
    if (notes) {
      if (Array.isArray(val)) {
        return [...val, notes];
      }
      if (typeof val === "string" && val) {
        return `${val} — ${notes}`;
      }
      return notes;
    }
    return val;
  }

  // Handle { files: string[], notes?: string }
  if ("files" in ansObj) {
    const files = Array.isArray(ansObj.files) ? ansObj.files : [];
    const notes = typeof ansObj.notes === "string" ? ansObj.notes.trim() : "";
    if (files.length > 0) return files;
    if (notes) return notes;
    return [];
  }

  return answer;
}

/** Non-design question gates that should be excluded from the AI generation brief. */
const GATES_TO_SKIP = new Set([
  "property_verified",
  "assessment_confirmation",
  "design_direction_approval",
  "design_summary",
  "render_satisfaction",
  "revision_approval",
  "overview",
  "summary",
]);

/** Find multi-question parent mappings and gate questions from questionnaire definition. */
function extractQuestionnaireMetadata(
  questionnaires?: Record<string, unknown> | null,
  role?: string,
  userType?: string
): { childToParent: Record<string, string>; dynamicGates: Set<string> } {
  const childToParent: Record<string, string> = {};
  const dynamicGates = new Set<string>();

  if (!questionnaires || typeof questionnaires !== "object") {
    return { childToParent, dynamicGates };
  }

  const scanPhases = (phases: Record<string, unknown>) => {
    for (const phase of Object.values(phases)) {
      if (!phase || typeof phase !== "object" || !("questions" in phase)) continue;
      const questions = (phase as { questions?: unknown[] }).questions;
      if (!Array.isArray(questions)) continue;

      for (const q of questions) {
        if (!q || typeof q !== "object") continue;
        const qObj = q as {
          id?: string;
          type?: string;
          is_ai_design?: boolean;
          is_property_address?: boolean;
          multi_questions?: Array<{ id?: string }>;
        };
        const id = qObj.id;
        if (!id) continue;

        if (
          qObj.type === "display" ||
          qObj.is_ai_design ||
          qObj.is_property_address ||
          id.includes("approval") ||
          id.includes("confirmation")
        ) {
          dynamicGates.add(id);
        }

        if (qObj.type === "multi_questions" && Array.isArray(qObj.multi_questions)) {
          for (const child of qObj.multi_questions) {
            if (child && child.id) {
              childToParent[child.id] = id;
            }
          }
        }
      }
    }
  };

  const normRole = (role ?? "enterprise-client").trim().toLowerCase();
  const roleSection = questionnaires[normRole];
  if (roleSection && typeof roleSection === "object") {
    const roleMap = roleSection as Record<string, unknown>;
    const normUserType = (userType ?? "").trim().toLowerCase().replace(/_/g, "-");
    const userSection = (roleMap[normUserType] ??
      roleMap[userType ?? ""] ??
      roleMap[(userType ?? "").replace(/-/g, "_")]) as Record<string, unknown> | undefined;

    if (userSection && typeof userSection === "object") {
      if (Object.keys(userSection).some((k) => k.startsWith("phase_"))) {
        scanPhases(userSection);
      } else {
        for (const sub of Object.values(userSection)) {
          if (sub && typeof sub === "object") scanPhases(sub as Record<string, unknown>);
        }
      }
    } else {
      for (const sec of Object.values(roleMap)) {
        if (sec && typeof sec === "object") {
          if (Object.keys(sec).some((k) => k.startsWith("phase_"))) {
            scanPhases(sec as Record<string, unknown>);
          } else {
            for (const sub of Object.values(sec as Record<string, unknown>)) {
              if (sub && typeof sub === "object") scanPhases(sub as Record<string, unknown>);
            }
          }
        }
      }
    }
  }

  return { childToParent, dynamicGates };
}

export interface EnterpriseClientPayload {
  watermark: string;
  image_url: string;
  original: Record<string, unknown>;
  revisions: Record<string, unknown>;
}

/**
 * Transforms a full brief payload into the clean, simplified format
 * expected by enterprise-client Luna AI endpoints.
 */
export function buildEnterpriseClientPayload(
  payload: Record<string, unknown>,
  questionnaires?: Record<string, unknown> | null
): EnterpriseClientPayload {
  const role = String(payload.role ?? "enterprise-client");
  const userType = String(payload.user_type ?? "");

  const { childToParent, dynamicGates } = extractQuestionnaireMetadata(
    questionnaires,
    role,
    userType
  );

  const rawOriginal =
    payload && typeof payload === "object" && payload.original && typeof payload.original === "object"
      ? (payload.original as Record<string, unknown>)
      : {};

  const original: Record<string, unknown> = {};
  const groups: Record<string, Record<string, unknown>> = {};

  for (const [key, item] of Object.entries(rawOriginal)) {
    if (GATES_TO_SKIP.has(key) || dynamicGates.has(key)) continue;

    const val = extractAnswerValue(item);
    if (val === null || val === undefined) continue;
    if (Array.isArray(val) && val.length === 0) continue;
    if (typeof val === "string" && !val.trim()) continue;

    const parentGroupKey = childToParent[key];
    if (parentGroupKey) {
      if (!groups[parentGroupKey]) {
        groups[parentGroupKey] = {};
        original[parentGroupKey] = groups[parentGroupKey];
      }
      groups[parentGroupKey][key] = val;
    } else if (key.startsWith("ai_site_assessment_")) {
      if (!groups["ai_site_assessment"]) {
        groups["ai_site_assessment"] = {};
        original["ai_site_assessment"] = groups["ai_site_assessment"];
      }
      groups["ai_site_assessment"][key] = val;
    } else if (
      key === "existing_architecture" ||
      key === "design_constraints" ||
      (key === "opportunities" && !rawOriginal["primary_uses"])
    ) {
      if (!groups["ai_home_assessment"]) {
        groups["ai_home_assessment"] = {};
        original["ai_home_assessment"] = groups["ai_home_assessment"];
      }
      groups["ai_home_assessment"][key] = val;
    } else if (
      (key === "ai_site_assessment" || key === "ai_home_assessment") &&
      typeof val === "object"
    ) {
      original[key] = val;
    } else {
      original[key] = val;
    }
  }

  // Ensure all collected groups are preserved on original
  for (const [groupName, groupData] of Object.entries(groups)) {
    if (Object.keys(groupData).length > 0) {
      original[groupName] = groupData;
    }
  }

  // Resolve revisions object
  let revisions: Record<string, unknown> = {};
  if (payload.revisions && typeof payload.revisions === "object") {
    revisions = payload.revisions as Record<string, unknown>;
  } else if (payload.revision_comment && typeof payload.revision_comment === "object") {
    const rc = payload.revision_comment as { files?: string[]; notes?: string };
    if ((rc.files && rc.files.length > 0) || (rc.notes && rc.notes.trim())) {
      revisions = { files: rc.files ?? [], notes: rc.notes ?? "" };
    }
  }

  return {
    watermark: typeof payload.watermark === "string" ? payload.watermark : "",
    image_url: typeof payload.image_url === "string" ? payload.image_url : "",
    original,
    revisions,
  };
}
