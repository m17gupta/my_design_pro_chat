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
    return JSON.parse(atob(padded)) as ClientParams;
  } catch {
    return undefined;
  }
}

interface GetAllProjectDataProps {
  defaultRole?: string;
}

const GetAllProjectData = ({ defaultRole }: GetAllProjectDataProps = {}) => {
  const searchParams = useSearchParams();

  const dispatch = useAppDispatch();
  const hydrationDispatchedRef = useRef(false);

  useEffect(() => {
    if (hydrationDispatchedRef.current) return;
    hydrationDispatchedRef.current = true;

    dispatch(fetchQuestionnaires());

    const storageKey = defaultRole ? `dzinly_chat_params_${defaultRole}` : "dzinly_chat_params";
    const rawParams = searchParams.get("params");
    let params = decodeClientParams(rawParams);
      console.log("params---",params)
    if (rawParams) {
      try {
        sessionStorage.setItem(storageKey, rawParams);
        sessionStorage.setItem("dzinly_chat_params", rawParams);
      } catch {
        // ignore
      }
    } else if (!params) {
      try {
        const cached = sessionStorage.getItem(storageKey) || sessionStorage.getItem("dzinly_chat_params");
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
          projectId: params.role==="enterprise-client"? `cp-${params.id?.toString()}`:params.id?.toString(),
          work_type: params.work_type,
          image_url: params.image_url,
          watermark: params.watermark,
          value: params.value,
          user_type: params?.user_type ?? "",
          dc_name: params.dc_name,
          role: params.role ?? defaultRole ?? null,
          custom_engage_designer: params.custom_engage_designer,
          question_sets: params.question_sets,
          project_address: params.project_address
        })
      );
      const incomingProjectId = params.role==="enterprise-client"? `cp-${params.id?.toString()}`:params.id?.toString();  
      if (incomingProjectId) {
        dispatch(hydrateProject({ projectId: incomingProjectId }));
      } else {
        // No project id — nothing to restore.
        dispatch(hydrationSkipped());
      }
    } else if (defaultRole) {
      // Direct access fallback without URL params
      dispatch(
        setContext({
          role: defaultRole,
          user_type: "landscape-design",
          work_type: defaultRole === "enterprise" ? "front_yard" : undefined,
          question_sets: {
            original: ["phase_1", "phase_2"],
            revision: ["phase_5"],
          },
        })
      );
      dispatch(hydrationSkipped());
    } else {
      dispatch(hydrationSkipped());
    }
  }, [searchParams, dispatch, defaultRole]);

  return null;
};

export default GetAllProjectData;