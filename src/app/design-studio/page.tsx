"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { DEFAULT_TEST_PAYLOAD } from "@/lib/revisionTestScenarios";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  resetDesignerGenerate,
  selectDesignerLastApiResponse,
  selectDesignerLastHttpStatus,
  selectDesignerTasks,
} from "@/store/designerGenerate/designerGenerateSlice";
import { generateAndPollDesignerDesign } from "@/store/designerGenerate/designerGenerateThunk";
import type { DesignerGeneratePayload } from "@/store/designerGenerate/designerGenerateType";
import { DesignStudioHeader } from "@/components/designStudio/DesignStudioHeader";
import { DesignStudioInput } from "@/components/designStudio/DesignStudioInput";
import { DesignStudioOutput } from "@/components/designStudio/DesignStudioOutput";
import { DesignStudioGallery } from "@/components/designStudio/DesignStudioGallery";
import {
  DEFAULT_PROMPT,
  DEMO_HOUSE_SVG,
  DESIGN_DIRECTIONS,
  IMAGE_STYLES,
  INITIAL_DEMO_VERSIONS,
  type ApiEndpoint,
  type DesignVersion,
} from "@/components/designStudio/types";

export default function DesignStudioPage() {
  const dispatch = useAppDispatch();
  const designerTasks = useAppSelector(selectDesignerTasks);
  const reduxLastHttpStatus = useAppSelector(selectDesignerLastHttpStatus);
  const reduxLastApiResponse = useAppSelector(selectDesignerLastApiResponse);

  // Brief / API Test Config state
  const [showFullRequest, setShowFullRequest] = useState(false);
  const [endpoint, setEndpoint] = useState<ApiEndpoint>("/api/enterprise-design-test");
  const [projectId, setProjectId] = useState(String(DEFAULT_TEST_PAYLOAD.projectId ?? "138719"));
  const [workType, setWorkType] = useState("front_yard");
  const [userType, setUserType] = useState("");
  const [role, setRole] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState(
    "https://mydesigns.pro/tmp/f1_1794676329.jpeg"
  );
  const [watermarkUrl, setWatermarkUrl] = useState(
    DEFAULT_TEST_PAYLOAD.watermark ?? "https://mydesigns.pro/img/luna-logo.png"
  );

  // Assistant Form state
  const [activeTab, setActiveTab] = useState<"generate" | "upload">("generate");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [designDirection, setDesignDirection] = useState(DESIGN_DIRECTIONS[0]);
  const [imageStyle, setImageStyle] = useState(IMAGE_STYLES[0]);
  const [preserveArchitecture, setPreserveArchitecture] = useState(true);
  const [numGenerations, setNumGenerations] = useState<number>(1);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);

  // Versions & Preview state
  const [versions, setVersions] = useState<DesignVersion[]>(INITIAL_DEMO_VERSIONS);
  const [activeVersionId, setActiveVersionId] = useState<string>("demo-3");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // API Inspector state
  const [lastHttpStatus, setLastHttpStatus] = useState<number | null>(null);
  const [lastRequestPayload, setLastRequestPayload] = useState<unknown>(null);
  const [lastApiResponse, setLastApiResponse] = useState<unknown>(null);
  const [showInspector, setShowInspector] = useState(false);

  const mountedRef = useRef(true);
  const activeDispatchesRef = useRef<Array<{ abort: () => void }>>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeDispatchesRef.current.forEach((d) => d.abort());
      activeDispatchesRef.current = [];
    };
  }, []);

  // Merge Redux designerGenerate task state into the displayed DesignVersion cards
  const displayVersions = useMemo(() => {
    const taskKeys = Object.keys(designerTasks);
    if (taskKeys.length === 0) return versions;

    return versions.map((v) => {
      const task = designerTasks[v.id];
      if (!task) return v;

      if (task.status === "submitting") {
        return {
          ...v,
          status: "generating" as const,
          badge: "Generating...",
          subtitle: "Submitting request to designer-generate API...",
        };
      }

      if (task.status === "processing") {
        return {
          ...v,
          taskId: task.taskId ?? v.taskId,
          status: "polling" as const,
          badge: "Polling...",
          subtitle: task.taskId
            ? `Task ${task.taskId} processing — waiting for render...`
            : "Processing design...",
          rawResponse: task.rawResponse ?? v.rawResponse,
        };
      }

      if (task.status === "completed") {
        const generatedUrl = task.result?.generated_image_url;
        const originalUrl =
          task.result?.original_image_url || task.requestPayload.original_image_url;
        const palletsCount = task.result?.pallets_total;
        return {
          ...v,
          taskId: task.taskId ?? v.taskId,
          imageUrl: generatedUrl || v.imageUrl,
          originalImageUrl: originalUrl || referenceImageUrl.trim() || undefined,
          status: "completed" as const,
          badge: "Live AI",
          subtitle: task.taskId
            ? `Generated (task ${task.taskId}${typeof palletsCount === "number" ? ` · ${palletsCount} pallets` : ""})`
            : "Generated via designer-generate API",
          error: undefined,
          rawResponse: task.rawResponse ?? task.result ?? v.rawResponse,
          pallets: task.result?.pallets ?? [],
        };
      }

      if (task.status === "failed") {
        const errMsg = task.error ?? "Design generation failed";
        return {
          ...v,
          taskId: task.taskId ?? v.taskId,
          status: "failed" as const,
          badge: task.httpStatus && task.httpStatus >= 400 ? `HTTP ${task.httpStatus}` : "Failed",
          subtitle: errMsg,
          error: errMsg,
          rawResponse: task.rawResponse ?? v.rawResponse,
        };
      }

      return v;
    });
  }, [versions, designerTasks, referenceImageUrl]);

  const activeVersion =
    displayVersions.find((v) => v.id === activeVersionId) ??
    displayVersions[displayVersions.length - 1] ??
    null;

  const selectedCount = displayVersions.filter((v) => v.selected).length;

  const buildApiPayload = useCallback((): DesignerGeneratePayload => {
    const pid = projectId.trim() || "138719";
    const viewId = 12232;
    return {
      original_image_url: referenceImageUrl.trim(),
      prompt: prompt.trim(),
      design_direction: designDirection,
      image_style: imageStyle,
      preserve_original: preserveArchitecture,
      reference_files: [],
      s3_upload_dir: `liv/dev/local/projects/${pid}/${viewId}/luna`,
      extra: {
        project_id: pid,
        view_id: viewId,
      },
    };
  }, [
    referenceImageUrl,
    prompt,
    designDirection,
    imageStyle,
    preserveArchitecture,
    projectId,
  ]);

  const handleGenerate = async () => {
    if (isGenerating) return;

    if (!prompt.trim()) {
      toast.error("Please enter what Luna should design.");
      return;
    }

    // Abort any prior in-flight polling requests
    activeDispatchesRef.current.forEach((d) => d.abort());
    activeDispatchesRef.current = [];
    dispatch(resetDesignerGenerate());

    setIsGenerating(true);
    const batchId = Date.now();
    const newVersion: DesignVersion = {
      id: `live-${batchId}-1`,
      versionNumber: 1,
      title: "Luna concept 1",
      subtitle: "Submitting request to designer-generate API...",
      badge: "Generating...",
      imageUrl: referenceImageUrl.trim() || DEMO_HOUSE_SVG,
      selected: true,
      isDemo: false,
      status: "generating",
    };

    setVersions([newVersion]);
    setActiveVersionId(newVersion.id);

    try {
      const payload = buildApiPayload();
      setLastRequestPayload(payload);

      const thunkPromise = dispatch(
        generateAndPollDesignerDesign({
          versionId: newVersion.id,
          payload,
        })
      );
      activeDispatchesRef.current.push(thunkPromise);

      const resultAction = await thunkPromise;

      if (mountedRef.current) {
        if (generateAndPollDesignerDesign.fulfilled.match(resultAction)) {
          toast.success("Design generation completed!");
        } else if (generateAndPollDesignerDesign.rejected.match(resultAction)) {
          toast.error(
            resultAction.payload?.message ?? "Design generation failed."
          );
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-file-name": encodeURIComponent(file.name),
          "x-project-id": projectId.trim() || "138719",
        },
        body: file,
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        secure_url?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      const uploadedUrl = data.url || data.secure_url;
      if (!uploadedUrl) {
        throw new Error("Upload succeeded but no URL was returned.");
      }

      const newVer: DesignVersion = {
        id: `upload-${Date.now()}`,
        versionNumber: versions.length + 1,
        title: `Uploaded: ${file.name}`,
        subtitle: "Uploaded to S3 via /api/upload",
        badge: "Uploaded",
        imageUrl: uploadedUrl,
        selected: true,
        isDemo: false,
        status: "completed",
      };

      setReferenceImageUrl(uploadedUrl);
      setVersions((prev) => [...prev, newVer]);
      setActiveVersionId(newVer.id);
      toast.success("Image uploaded and set as reference!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleSelectVersion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setVersions((prev) =>
      prev.map((v) => (v.id === id ? { ...v, selected: !v.selected } : v))
    );
  };

  const handleResetDemo = () => {
    activeDispatchesRef.current.forEach((d) => d.abort());
    activeDispatchesRef.current = [];
    dispatch(resetDesignerGenerate());
    setVersions(INITIAL_DEMO_VERSIONS);
    setActiveVersionId("demo-3");
    setLastHttpStatus(null);
    setLastApiResponse(null);
    toast.success("Reset to demo concepts");
  };

  const handleSendToDc = () => {
    const chosen = versions.filter((v) => v.selected);
    if (chosen.length === 0) {
      toast.error("Select at least one design version to send.");
      return;
    }
    toast.success(
      `Ready to send ${chosen.length} selected version${chosen.length > 1 ? "s" : ""} to DC!`
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-[1380px] px-4 py-5 sm:px-6 lg:px-8">
        {/* TOP HEADER */}
        <DesignStudioHeader
          endpoint={endpoint}
          showInspector={showInspector}
          onToggleInspector={() => setShowInspector((prev) => !prev)}
          lastHttpStatus={reduxLastHttpStatus ?? lastHttpStatus}
          requestPayload={lastRequestPayload ?? buildApiPayload()}
          lastApiResponse={reduxLastApiResponse ?? lastApiResponse}
        />

        {/* MAIN 2-COLUMN WORKSPACE */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* LEFT COLUMN: INPUT */}
          <DesignStudioInput
            showFullRequest={showFullRequest}
            onToggleFullRequest={() => setShowFullRequest((prev) => !prev)}
            endpoint={endpoint}
            onEndpointChange={setEndpoint}
            projectId={projectId}
            onProjectIdChange={setProjectId}
            workType={workType}
            onWorkTypeChange={setWorkType}
            userType={userType}
            onUserTypeChange={setUserType}
            role={role}
            onRoleChange={setRole}
            referenceImageUrl={referenceImageUrl}
            onReferenceImageUrlChange={setReferenceImageUrl}
            watermarkUrl={watermarkUrl}
            onWatermarkUrlChange={setWatermarkUrl}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            prompt={prompt}
            onPromptChange={setPrompt}
            designDirection={designDirection}
            onDesignDirectionChange={setDesignDirection}
            imageStyle={imageStyle}
            onImageStyleChange={setImageStyle}
            preserveArchitecture={preserveArchitecture}
            onPreserveArchitectureChange={setPreserveArchitecture}
            numGenerations={numGenerations}
            onNumGenerationsChange={setNumGenerations}
            isGenerating={isGenerating}
            isUploading={isUploading}
            onGenerate={handleGenerate}
            onFileUpload={(file) => void handleFileUpload(file)}
          />

          {/* RIGHT COLUMN: OUTPUT IMAGE */}
          <DesignStudioOutput
            activeVersion={activeVersion}
            endpoint={endpoint}
            lightboxOpen={lightboxOpen}
            onOpenLightbox={() => setLightboxOpen(true)}
            onCloseLightbox={() => setLightboxOpen(false)}
            onResetDemo={handleResetDemo}
          />
        </div>

        {/* BOTTOM SECTION: GENERATED IMAGE GALLERY */}
        <DesignStudioGallery
          versions={displayVersions}
          activeVersionId={activeVersion?.id}
          selectedCount={selectedCount}
          onSelectActive={setActiveVersionId}
          onToggleSelected={toggleSelectVersion}
          onSendToDc={handleSendToDc}
        />
      </div>
    </div>
  );
}
