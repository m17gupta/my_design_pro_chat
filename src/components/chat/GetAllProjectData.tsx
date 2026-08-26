"use client";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAppDispatch } from "../../store/hooks";
import { setContext } from "../../store/briefSlice";
import { hydrateProject } from "../../store/persistence/persistenceThunk";
import { hydrationSkipped } from "../../store/persistence/persistenceSlice";
import { fetchQuestionnaires } from "../../store/questionnaires/questionnaireThunk";

/** Decoded shape of the base64 `?params` query string sent from the site. */
interface ClientParams {
  id?: number;
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
}

/** URL-safe base64 → JSON object; returns undefined when absent/malformed. */
function decodeClientParams(raw: string | null): ClientParams | undefined {
  if (!raw) return undefined;
  try {
    const standard = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = standard.padEnd(standard.length + ((4 - (standard.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as ClientParams;
  } catch {
    return undefined;
  }
}

const GetAllProjectData = () => {
  const searchParams = useSearchParams();

  const dispatch = useAppDispatch();
  const hydrationDispatchedRef = useRef(false);

  useEffect(() => {
    if (hydrationDispatchedRef.current) return;
    hydrationDispatchedRef.current = true;

    dispatch(fetchQuestionnaires());

    const rawParams = searchParams.get("params");
    let params = decodeClientParams(rawParams);
  // console.log("parmas", params)
    if (rawParams) {
      try {
        sessionStorage.setItem("dzinly_chat_params", rawParams);
      } catch {
        // ignore
      }
    } else if (!params) {
      try {
        const cached = sessionStorage.getItem("dzinly_chat_params");
        if (cached) {
          params = decodeClientParams(cached);
        }
      } catch {
        // ignore
      }
    }

    if (params) {
      dispatch(
        setContext({
          id: params.id,
          work_type: params.work_type,
          image_url: params.image_url,
          watermark: params.watermark,
          value: params.value,
          user_type: params?.user_type ?? "",
          dc_name: params.dc_name,
          role: params.role,
          custom_engage_designer: params.custom_engage_designer,
          question_sets: params.question_sets
        })
      );
      const incomingProjectId = params.id ? String(params.id) : "";
      if (incomingProjectId) {
        dispatch(hydrateProject({ projectId: incomingProjectId }));
      } else {
        // No project id — nothing to restore.
        dispatch(hydrationSkipped());
      }
    } else {
      dispatch(hydrationSkipped());
    }
  }, [searchParams, dispatch]);

  return null;
};

export default GetAllProjectData;