"use client";

import * as React from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { AppButton } from "@/components/common/AppButton";
import { AppSpinner } from "@/components/common/AppSpinner";
import { AppSteps, AppStepDef } from "@/components/common/AppSteps";
import { YouTubeIcon } from "@/features/dashboard/icons";
import {
  useYouTubeStatus,
  usePublications,
  usePublishToYouTube,
  useRetryPublication,
  useConnectYouTube,
  useYouTubeCategories,
  useUploadThumbnail,
} from "../queries";
import { toast } from "sonner";
import {
  AlertCircle,
  RotateCw,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { YouTubeChannelHeader } from "./YouTubeChannelHeader";
import {
  YouTubeWizardStepDetails,
  TITLE_MAX,
  DESCRIPTION_MAX,
} from "./YouTubeWizardStepDetails";
import { YouTubeWizardStepAppearance } from "./YouTubeWizardStepAppearance";
import { YouTubeWizardStepSettings } from "./YouTubeWizardStepSettings";
import { YouTubePublishStatusView } from "./YouTubePublishStatusView";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface PublishToYouTubeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  clipId: string;
  clipTitle?: string;
  defaultDescription?: string;
  defaultTags?: string[];
  defaultHashtags?: string[];
}

interface WizardFormState {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: "private" | "unlisted" | "public";
  thumbnailKey?: string;
  thumbnailPreviewUrl?: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants & Helpers                                                       */
/* -------------------------------------------------------------------------- */

const WIZARD_STEPS: AppStepDef[] = [
  { id: "details", label: "Details", description: "" },
  { id: "appearance", label: "Appearance", description: "" },
  { id: "settings", label: "Settings", description: "" },
];

function computeInitialDescription(desc?: string, hashtags?: string[]): string {
  const baseDesc = desc?.trim() || "";
  const htags = (hashtags || [])
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .filter(Boolean);

  if (htags.length > 0) {
    const hasTagsAlready = htags.some((h) => baseDesc.includes(h));
    if (!hasTagsAlready) {
      return baseDesc ? `${baseDesc}\n\n${htags.join(" ")}` : htags.join(" ");
    }
  }
  return baseDesc;
}

function computeInitialTags(tags?: string[]): string[] {
  const tagsSet = new Set<string>();
  (tags || []).forEach((t) => {
    const clean = t.replace(/^#/, "").trim();
    if (clean && clean.length <= 100) {
      tagsSet.add(clean);
    }
  });
  return Array.from(tagsSet).slice(0, 30);
}

/* -------------------------------------------------------------------------- */
/*  Inner Wizard Content Component                                            */
/* -------------------------------------------------------------------------- */

interface WizardContentProps {
  jobId: string;
  clipId: string;
  clipTitle: string;
  defaultDescription: string;
  defaultTags?: string[];
  defaultHashtags?: string[];
  onClose: () => void;
}

function PublishToYouTubeWizardContent({
  jobId,
  clipId,
  clipTitle,
  defaultDescription,
  defaultTags,
  defaultHashtags,
  onClose,
}: WizardContentProps) {
  /* ---- Wizard step & view state ---- */
  const [currentStep, setCurrentStep] = React.useState(0);
  const [showWizard, setShowWizard] = React.useState(false);

  /* ---- Single form state across all steps (initialized on mount) ---- */
  const [form, setForm] = React.useState<WizardFormState>(() => ({
    title: (clipTitle || "").slice(0, TITLE_MAX),
    description: computeInitialDescription(defaultDescription, defaultHashtags).slice(
      0,
      DESCRIPTION_MAX
    ),
    tags: computeInitialTags(defaultTags),
    categoryId: "",
    privacyStatus: "private",
    thumbnailKey: undefined,
    thumbnailPreviewUrl: undefined,
  }));

  /* ---- Per-step validation errors ---- */
  const [stepErrors, setStepErrors] = React.useState<Record<string, string>>({});

  /* ---- API queries ---- */
  const { data: ytStatus, isLoading: isStatusLoading } = useYouTubeStatus();
  const { data: publications } = usePublications(jobId, clipId);
  const { data: categories, isLoading: isCategoriesLoading } = useYouTubeCategories({
    enabled: !!ytStatus?.connected,
  });

  /* ---- Auto-select default category when categories load ---- */
  React.useEffect(() => {
    if (categories && categories.length > 0) {
      setForm((prev) => {
        if (prev.categoryId) return prev;
        const preferred =
          categories.find((c) => c.id === "24") || // Entertainment
          categories.find((c) => c.title.toLowerCase().includes("entertainment")) ||
          categories.find((c) => c.id === "22") || // People & Blogs
          categories.find((c) => c.title.toLowerCase().includes("people")) ||
          categories.find((c) => c.id === "23") || // Comedy
          categories[0];
        return {
          ...prev,
          categoryId: preferred ? preferred.id : categories[0].id,
        };
      });
    }
  }, [categories]);

  /* ---- Mutations ---- */
  const connectMutation = useConnectYouTube({
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err.message || "Failed to start YouTube connection");
    },
  });

  const uploadThumbnailMutation = useUploadThumbnail({
    onSuccess: ({ thumbnailKey, previewUrl }) => {
      setForm((prev) => ({
        ...prev,
        thumbnailKey,
        thumbnailPreviewUrl: previewUrl,
      }));
      toast.success("Thumbnail uploaded");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to upload thumbnail");
    },
  });

  const publishMutation = usePublishToYouTube(jobId, clipId, {
    onSuccess: () => {
      setShowWizard(false);
      toast.success("Publication queued! Video is uploading in background.");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to start publication");
    },
  });

  const retryMutation = useRetryPublication(jobId, clipId, {
    onSuccess: () => {
      toast.success("Retrying YouTube upload...");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to retry upload");
    },
  });

  /* ---- Derived state ---- */
  const latestPub = publications && publications.length > 0 ? publications[0] : undefined;
  const isUploading =
    latestPub?.status === "queued" ||
    latestPub?.status === "uploading" ||
    latestPub?.status === "processing";
  const isPublished = latestPub?.status === "published";
  const isFailed = latestPub?.status === "failed";
  const isPublishing = publishMutation.isPending;

  const categoryOptions = React.useMemo(
    () => (categories ?? []).map((c) => ({ value: c.id, label: c.title })),
    [categories]
  );

  /* ---- Form helpers ---- */
  const updateForm = <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStepErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /* ---- Step validation ---- */
  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 0) {
      if (!form.title.trim()) {
        errors.title = "Title is required";
      } else if (form.title.length > TITLE_MAX) {
        errors.title = `Title must be ${TITLE_MAX} characters or fewer`;
      }
    }

    if (step === 1) {
      if (uploadThumbnailMutation.isPending) {
        errors.thumbnail = "Please wait for the thumbnail to finish uploading";
      }
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ---- Navigation ---- */
  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  };

  const handleBack = () => {
    setStepErrors({});
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  /* ---- Publish ---- */
  const handlePublish = () => {
    if (!validateStep(currentStep)) return;
    publishMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      privacyStatus: form.privacyStatus,
      tags: form.tags.length > 0 ? form.tags : undefined,
      categoryId: form.categoryId || undefined,
      thumbnailKey: form.thumbnailKey || undefined,
    });
  };

  const isConnected = !!ytStatus?.connected;

  if (isStatusLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
        <AppSpinner size="sm" />
        <span className="text-xs">Checking YouTube connection...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/40 p-5 text-center space-y-4">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <YouTubeIcon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">
            Connect Your YouTube Channel
          </h4>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Authorize Blynta to upload clips directly to your channel. You can disconnect at any time.
          </p>
        </div>
        <AppButton
          className="w-full"
          icon={<YouTubeIcon className="h-4 w-4" />}
          onClick={() => connectMutation.mutate()}
          isLoading={connectMutation.isPending}
        >
          Connect YouTube Channel
        </AppButton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Channel header */}
      <YouTubeChannelHeader channel={ytStatus.channel} />

      {/* ============================================================= */}
      {/* 1. ACTIVE UPLOADING / PUBLISHED STATUS VIEW                   */}
      {/* ============================================================= */}
      {isUploading || (isPublished && !showWizard) ? (
        <YouTubePublishStatusView
          isUploading={isUploading}
          latestPub={latestPub}
          onReupload={() => {
            setShowWizard(true);
            setCurrentStep(0);
          }}
          onClose={onClose}
        />
      ) : (
        /* ============================================================= */
        /* 2. 3-STEP WIZARD FORM                                         */
        /* ============================================================= */
        <div className="space-y-4">
          {/* Previous failed notice if retrying */}
          {isFailed && latestPub && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">Previous upload failed</p>
                  <p className="text-[11px] text-destructive/80 mt-0.5 leading-relaxed">
                    {latestPub.error || "An error occurred during upload."}
                  </p>
                </div>
              </div>
              <AppButton
                variant="outline"
                size="sm"
                onClick={() => retryMutation.mutate(latestPub._id)}
                isLoading={retryMutation.isPending}
                icon={<RotateCw className="h-3.5 w-3.5" />}
                className="text-xs h-7"
              >
                Retry Previous Upload
              </AppButton>
            </div>
          )}

          {/* 3-Step indicator */}
          <AppSteps steps={WIZARD_STEPS} currentStep={currentStep} />

          {/* Step content — scrollable container */}
          <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: "320px" }}>
            {currentStep === 0 && (
              <YouTubeWizardStepDetails
                title={form.title}
                description={form.description}
                onTitleChange={(val) => updateForm("title", val)}
                onDescriptionChange={(val) => updateForm("description", val)}
                disabled={isPublishing}
                titleError={stepErrors.title}
                descriptionError={stepErrors.description}
              />
            )}

            {currentStep === 1 && (
              <YouTubeWizardStepAppearance
                thumbnailPreviewUrl={form.thumbnailPreviewUrl}
                isUploading={uploadThumbnailMutation.isPending}
                onUploadFile={(file) => uploadThumbnailMutation.mutate({ file })}
                onRemove={() =>
                  setForm((prev) => ({
                    ...prev,
                    thumbnailKey: undefined,
                    thumbnailPreviewUrl: undefined,
                  }))
                }
                error={stepErrors.thumbnail}
              />
            )}

            {currentStep === 2 && (
              <YouTubeWizardStepSettings
                categoryId={form.categoryId}
                onCategoryChange={(val) => updateForm("categoryId", val)}
                categoryOptions={categoryOptions}
                isCategoriesLoading={isCategoriesLoading}
                tags={form.tags}
                onTagsChange={(tags) => updateForm("tags", tags)}
                privacyStatus={form.privacyStatus}
                onPrivacyChange={(val) => updateForm("privacyStatus", val)}
                disabled={isPublishing}
                tagsError={stepErrors.tags}
              />
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div>
              {currentStep > 0 && (
                <AppButton
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  disabled={isPublishing}
                  icon={<ChevronLeft className="h-4 w-4" />}
                  className="text-xs text-muted-foreground"
                >
                  Back
                </AppButton>
              )}
            </div>

            <div className="flex items-center gap-2">
              <AppButton
                variant="outline"
                size="sm"
                onClick={isPublished ? () => setShowWizard(false) : onClose}
                disabled={isPublishing}
                className="text-xs"
              >
                {isPublished ? "Back to Status" : "Cancel"}
              </AppButton>

              {currentStep < WIZARD_STEPS.length - 1 ? (
                <AppButton
                  size="sm"
                  onClick={handleNext}
                  icon={<ChevronRight className="h-4 w-4" />}
                  iconPosition="right"
                  className="text-xs"
                >
                  Continue
                </AppButton>
              ) : (
                <AppButton
                  size="sm"
                  onClick={handlePublish}
                  isLoading={isPublishing}
                  icon={<UploadCloud className="h-4 w-4" />}
                  className="text-xs"
                >
                  {isPublished ? "Re-publish to YouTube" : "Publish to YouTube"}
                </AppButton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Dialog Export                                                        */
/* -------------------------------------------------------------------------- */

export function PublishToYouTubeDialog({
  open,
  onOpenChange,
  jobId,
  clipId,
  clipTitle = "",
  defaultDescription = "",
  defaultTags,
  defaultHashtags,
}: PublishToYouTubeDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Publish to YouTube Shorts"
      description="Configure your Short before publishing."
      size="lg"
    >
      <div className="pt-1">
        {open && (
          <PublishToYouTubeWizardContent
            key={`${jobId}-${clipId}`}
            jobId={jobId}
            clipId={clipId}
            clipTitle={clipTitle}
            defaultDescription={defaultDescription}
            defaultTags={defaultTags}
            defaultHashtags={defaultHashtags}
            onClose={() => onOpenChange(false)}
          />
        )}
      </div>
    </AppDialog>
  );
}
