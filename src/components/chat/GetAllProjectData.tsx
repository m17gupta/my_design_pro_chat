"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setContext } from "../../store/briefSlice";
import { hydrateProject } from "../../store/persistence/persistenceThunk";
import { hydrationSkipped } from "../../store/persistence/persistenceSlice";
import { fetchQuestionnaires } from "../../store/questionnaires/questionnaireThunk";
import { resolveQuestionnaireContext, cachedRoleMatches, type QuestionnaireChoice } from "../../lib/questionnaireContext";
import { selectQuestionnairesState } from "../../store/questionnaires/questionnaireSlice";

/** Decoded shape of the base64 `?params` query string sent from the site. */
interface ClientParams {
  id?: number | string;
  projectId?: string;
  work_type?: string;
  image_url?: string;
  watermark?: string;
  value?: string;
  user_type?: string;
  dc_name?: string;
  role?: string | null;
  custom_engage_designer?: boolean;
  question_sets?: {
    original?: string[];
    revision?: string[];
  };
  project_address?: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  };
}

/** URL-safe base64 → JSON object; returns undefined when absent/malformed. */
function decodeClientParams(raw: string | null): ClientParams | undefined {
  if (!raw) return undefined;
  try {
    const standard = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = standard.padEnd(standard.length + ((4 - (standard.length % 4)) % 4), "=");
    const decoded: unknown = JSON.parse(atob(padded));
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return undefined;
    const params = decoded as ClientParams;
    if ([params.role, params.user_type, params.work_type, params.projectId].some(
      (value) => value != null && typeof value !== "string"
    )) return undefined;
    if (params.question_sets != null) {
      if (typeof params.question_sets !== "object" || Array.isArray(params.question_sets)) return undefined;
      for (const phases of [params.question_sets.original, params.question_sets.revision]) {
        if (phases !== undefined && (!Array.isArray(phases) || phases.some((key) => typeof key !== "string"))) return undefined;
      }
    }
    return params;
  } catch {
    return undefined;
  }
}

interface GetAllProjectDataProps {
  defaultRole?: string;
  children?: ReactNode;
}

const GetAllProjectData = ({ defaultRole, children }: GetAllProjectDataProps = {}) => {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const { data, lifecycle, error: fetchError } = useAppSelector(selectQuestionnairesState);
  const initialized = useRef(false);
  const hydrationStarted = useRef(false);
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [savedContext, setSavedContext] = useState<ClientParams | null>(null);
  const [ready, setReady] = useState(false);
  const [choices, setChoices] = useState<QuestionnaireChoice[]>([]);
  const [selected, setSelected] = useState<QuestionnaireChoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data && lifecycle === "idle") dispatch(fetchQuestionnaires());
  }, [data, lifecycle, dispatch]);

  // This effect imports external session/Redux state into the bootstrap UI.
  // The chat stays unmounted until context resolution and hydration complete.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialized.current || !data) return;
    const storageKey = defaultRole ? `dzinly_chat_params_${defaultRole}` : "dzinly_chat_params";
    const rawParams = searchParams.get("params");
    let params = decodeClientParams(rawParams);
    if (rawParams && !params) {
      setError("The project parameters are invalid. Open the project again from its source.");
      return;
    }
    if (!rawParams) {
      try {
        const scoped = decodeClientParams(sessionStorage.getItem(storageKey));
        const shared = decodeClientParams(sessionStorage.getItem("dzinly_chat_params"));
        params = scoped && (!scoped.role || cachedRoleMatches(scoped.role, defaultRole))
          ? scoped : shared && cachedRoleMatches(shared.role, defaultRole) ? shared : undefined;
      } catch { /* Storage is optional. */ }
    }
    const role = params?.role ?? defaultRole;
    const projectId = params?.projectId ?? (params?.id != null
      ? role === "enterprise-client" ? `cp-${params.id}` : String(params.id)
      : undefined);
    // Load saved context before choosing a branch, including links containing
    // only a project id. Do not ask users to reselect a restored project type.
    if (projectId && !projectLoaded) {
      if (!hydrationStarted.current) {
        hydrationStarted.current = true;
        dispatch(setContext({ ...params, role, projectId }));
        dispatch(hydrateProject({ projectId })).then((action) => {
          if (hydrateProject.fulfilled.match(action) && action.payload.row?.chats) {
            const saved = action.payload.row.chats;
            setSavedContext({
              role: saved.role,
              user_type: saved.user_type ?? undefined,
              work_type: saved.work_type,
              question_sets: saved.question_sets ?? undefined,
            });
          }
          setProjectLoaded(true);
        });
      }
      return;
    }
    const source = savedContext ?? params;
    const result = resolveQuestionnaireContext(data, {
      role: source?.role ?? role,
      user_type: selected?.user_type ?? source?.user_type,
      work_type: selected?.work_type ?? source?.work_type,
      question_sets: source?.question_sets,
    });
    setChoices(result.choices);
    setError(result.error);
    if (!result.context) return;
    const context = result.context;
    initialized.current = true;
    dispatch(setContext({
      ...(savedContext ? {} : params),
      role: context.role,
      user_type: context.user_type,
      work_type: context.work_type ?? undefined,
      question_sets: context.question_sets,
      projectId: projectId ?? "",
    }));
    if (rawParams) {
      try {
        sessionStorage.setItem(storageKey, rawParams);
        sessionStorage.setItem("dzinly_chat_params", rawParams);
      } catch { /* Storage is optional. */ }
    }
    if (!projectId) dispatch(hydrationSkipped());
    setReady(true);
  }, [data, defaultRole, dispatch, searchParams, selected, projectLoaded, savedContext]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (ready) return children ?? null;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-white p-6">
      <section aria-live="polite" className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-200 p-6 text-zinc-800">
        <h1 className="text-lg font-semibold">{choices.length > 1 ? "Choose your project type" : "Preparing your questionnaire"}</h1>
        {lifecycle === "failed" ? <>
          <p role="alert">{fetchError || "Unable to load the questionnaire."}</p>
          <button className="rounded-lg bg-emerald-900 px-4 py-2 text-white" onClick={() => dispatch(fetchQuestionnaires({ force: true }))}>Try again</button>
        </> : error ? <p role="alert">{error}</p> : choices.length > 1 ? (
          <div className="grid gap-2">
            {choices.map((choice) => <button
              key={`${choice.user_type}/${choice.work_type ?? ""}`}
              className="rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50"
              onClick={() => setSelected(choice)}
            >{[choice.user_type, choice.work_type].filter(Boolean).map((part) => part!.replace(/[_-]/g, " ")).join(" / ")}</button>)}
          </div>
        ) : <p>Loading project questions…</p>}
      </section>
    </div>
  );
};

export default GetAllProjectData;
