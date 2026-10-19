import { resolveAllQuestionFlow, type FlowContext } from "../components/chat/flow";
import { toWorkType } from "../components/chat/types";

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const normalize = (value: string) => value.trim().toLowerCase().replace(/_/g, "-");
const isPhase = (value: unknown) => Array.isArray(object(value)?.questions);

export interface QuestionnaireChoice {
  user_type: string;
  work_type?: string;
}

/** Enumerate actual schema branches, excluding metadata and unsupported work types. */
export function questionnaireChoices(data: Record<string, unknown>, role: string): QuestionnaireChoice[] {
  const choices: QuestionnaireChoice[] = [];
  for (const [user_type, section] of Object.entries(object(data[role]) ?? {})) {
    const user = object(section);
    if (!user) continue;
    if (Object.values(user).some(isPhase)) {
      choices.push({ user_type });
      continue;
    }
    for (const [work_type, phases] of Object.entries(user)) {
      if (toWorkType(work_type) && Object.values(object(phases) ?? {}).some(isPhase)) {
        choices.push({ user_type, work_type });
      }
    }
  }
  return choices;
}

export function resolveQuestionnaireContext(data: Record<string, unknown>, ctx: FlowContext) {
  // Optional role-level defaults: { defaults: { user_type, work_type } }.
  // Existing payloads need no metadata: a sole branch is selected automatically.
  const defaults = object(object(data[ctx.role ?? ""])?.defaults);
  const defaultUser = typeof defaults?.user_type === "string" ? defaults.user_type : undefined;
  const defaultWork = typeof defaults?.work_type === "string" ? defaults.work_type : undefined;
  const effective = {
    ...ctx,
    user_type: ctx.user_type || defaultUser,
    work_type: ctx.work_type || ((!ctx.user_type || (defaultUser && normalize(ctx.user_type) === normalize(defaultUser))) ? defaultWork : undefined),
  };
  const choices = questionnaireChoices(data, ctx.role ?? "").filter((choice) =>
    (!effective.user_type || normalize(choice.user_type) === normalize(effective.user_type)) &&
    (!effective.work_type || !choice.work_type || normalize(choice.work_type) === normalize(effective.work_type))
  );
  if (choices.length !== 1) return { choices, context: null, error: choices.length ? null : "No matching questionnaire is configured for this project." };
  const choice = choices[0];
  const candidate = { ...effective, ...choice };
  const resolved = resolveAllQuestionFlow(candidate, data);
  if (!resolved || !resolved.originalPhases.length) {
    return { choices, context: null, error: "The questionnaire phase configuration is missing or invalid." };
  }
  return {
    choices,
    context: { ...candidate, question_sets: { original: resolved.originalPhases, revision: resolved.revisionPhases } },
    error: null,
  };
}

/** Shared cache may only be reused when its declared role matches this route. */
export function cachedRoleMatches(role: string | null | undefined, routeRole?: string) {
  return !routeRole || (typeof role === "string" && normalize(role) === normalize(routeRole));
}
