"use client";
import React, { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAppDispatch } from "../../store/hooks";
import { setContext } from "../../store/briefSlice";
import { hydrateProject } from "../../store/persistence/persistenceThunk";
import { hydrationSkipped } from "../../store/persistence/persistenceSlice";

/** Decoded shape of the base64 `?params` query string sent from the site. */
interface ClientParams {
  id?: number;
  work_type?: string;
  image_url?: string;
  watermark?: string;
  value?: string;
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

    const params = decodeClientParams(searchParams.get("params"));
    console.log("paramas", params)
    if (params) {
      dispatch(
        setContext({
          id: params.id,
          work_type: params.work_type,
          image_url: params.image_url,
          watermark: params.watermark,
          value: params.value,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, dispatch]);

  return null;
};

export default GetAllProjectData;