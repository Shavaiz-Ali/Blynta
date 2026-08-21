"use client";

import * as React from "react";
import { toast } from "sonner";
import { SourcePlatform, useCreateJob } from "@/features/jobs";
import { AppButton } from "@/components/common/AppButton";
import { AppDialog } from "@/components/common/AppDialog";
import { AppSelect, type AppSelectOption } from "@/components/common/AppSelect";
import { useCurrentUser } from "@/features/auth/queries";
import { cn } from "@/lib/utils";
import {
  SparklesIcon,
  CoinsIcon,
  AlertTriangleIcon,
  YoutubeIcon,
  CrownIcon,
  CheckIcon,
} from "../icons";
import { useRouter } from "next/navigation";

/* -------------------------------------------------------------------------- */
/*                      AI Model options (matches backend ALLOWED_PAID_AI_MODELS) */
/* -------------------------------------------------------------------------- */

const AI_MODEL_OPTIONS: AppSelectOption[] = [
  {
    value: "default",
    label: "Standard (fast)",
    description: "Great quality, fast · gpt-4o-mini",
  },
  {
    value: "gpt-4o",
    label: "Advanced (higher quality)",
    description: "Slower, sharper reasoning · gpt-4o",
  },
  {
    value: "claude-3-5-sonnet",
    label: "Sonnet",
    description: "Balanced speed & depth · Claude 3.5 Sonnet",
  },
  {
    value: "claude-3-opus",
    label: "Opus",
    description: "Highest-tier reasoning · Claude 3 Opus",
  },
];

interface HeroInputProps {
  onSuccess?: () => void;
}

export function HeroInput({ onSuccess }: HeroInputProps) {
  const { data: profile } = useCurrentUser();
  const router = useRouter();
  const isPaid = profile?.plan === "pro" || profile?.plan === "business";

  const [url, setUrl] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | undefined>();

  /* Advanced options state (paid only) */
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [customPrompt, setCustomPrompt] = React.useState("");
  const [aiModel, setAiModel] = React.useState<string>("default");

  /* Draft state while editing in the dialog */
  const [draftPrompt, setDraftPrompt] = React.useState("");
  const [draftModel, setDraftModel] = React.useState<string>("default");

  const { mutate, isPending, failureReason, reset } = useCreateJob({
    onSuccess: (data: any) => {
      setUrl("");
      setFieldError(undefined);
      setCustomPrompt("");
      setAiModel("default");
      setDraftPrompt("");
      setDraftModel("default");
      setAdvancedOpen(false);
      toast.success("Video URL submitted! AI clip generation started.");
      router.push(`/jobs/${data?._id}`);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit video. Please try again.");
    },
  });

  const selectedModel =
    AI_MODEL_OPTIONS.find((m) => m.value === aiModel) || AI_MODEL_OPTIONS[0];

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!url.trim()) {
      setFieldError("Paste a YouTube video link to get started");
      return;
    }

    let sourceUrl = url.trim();
    if (
      !sourceUrl.startsWith("http://") &&
      !sourceUrl.startsWith("https://")
    ) {
      sourceUrl = `https://${sourceUrl}`;
    }

    setFieldError(undefined);
    reset();

    const body: Parameters<typeof mutate>[0] = {
      sourceUrl,
      sourcePlatform: SourcePlatform.YOUTUBE,
    };

    if (isPaid) {
      if (customPrompt.trim().length > 0) {
        body.customPrompt = customPrompt.trim();
      }
      if (aiModel && aiModel !== "default") {
        body.aiModel = aiModel;
      }
    }

    mutate(body);
  }

  const isCustomPromptSet = customPrompt.trim().length > 0;
  const isCustomModelSet = aiModel !== "default";
  const isAdvancedActive = isCustomPromptSet || isCustomModelSet;

  const platformError: string | undefined = (failureReason as any)?.message;
  const submitDisabled = !url.trim() || isPending;

  return (
    <div className="w-full rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-6">
      {/* YouTube platform static badge */}
      <div className="flex items-center gap-2 mb-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/60 text-xs font-medium text-foreground">
          <YoutubeIcon className="h-4 w-4 text-[#FF0000]" />
          <span>YouTube</span>
        </div>
      </div>

      {/* Main input + CTA */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (fieldError) setFieldError(undefined);
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              aria-label="YouTube Video URL"
              aria-invalid={!!fieldError}
              className={cn(
                "w-full h-12 sm:h-14 rounded-xl border bg-background px-4 text-sm sm:text-base text-foreground placeholder:text-muted-foreground/60 outline-none transition-all",
                "focus:ring-2 focus:ring-primary/40 focus:border-primary",
                fieldError
                  ? "border-destructive focus:ring-destructive/40 focus:border-destructive"
                  : "border-border/80"
              )}
            />
          </div>

          <AppButton
            type="submit"
            size="lg"
            isLoading={isPending}
            disabled={submitDisabled}
            icon={
              !isPending ? <SparklesIcon className="h-4 w-4" /> : undefined
            }
            className="h-12 sm:h-14 px-6 sm:px-8 shrink-0 text-sm sm:text-base font-semibold shadow-md shadow-primary/15"
          >
            Get clips
          </AppButton>
        </div>

        {/* Advanced options trigger (paid only) */}
        {isPaid && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setDraftPrompt(customPrompt);
                setDraftModel(aiModel);
                setAdvancedOpen(true);
              }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg py-1 px-1.5 -ml-1.5"
            >
              <CrownIcon className="h-3.5 w-3.5 text-chart-4" />
              <span>Advanced options</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-chart-4 bg-chart-4/15 px-1.5 py-0.5 rounded">
                PRO
              </span>
            </button>

            {isAdvancedActive && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckIcon className="h-3 w-3" />
                {isCustomPromptSet && isCustomModelSet
                  ? "Custom prompt & model set"
                  : isCustomPromptSet
                  ? "Custom prompt set"
                  : `${selectedModel?.label || "Custom model"} set`}
              </span>
            )}
          </div>
        )}
      </form>

      {/* Advanced Options Dialog (PRO) */}
      {isPaid && (
        <AppDialog
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          size="md"
          title={
            <span className="inline-flex items-center gap-2">
              <CrownIcon className="h-4 w-4 text-chart-4" />
              Advanced Options
              <span className="text-[10px] font-bold uppercase tracking-wider text-chart-4 bg-chart-4/15 px-1.5 py-0.5 rounded">
                PRO
              </span>
            </span>
          }
          description="Customize AI instructions and select AI models for clip generation."
          footer={
            <div className="flex w-full gap-2 justify-end">
              <AppButton
                variant="outline"
                size="sm"
                onClick={() => setAdvancedOpen(false)}
              >
                Cancel
              </AppButton>
              <AppButton
                variant="default"
                size="sm"
                onClick={() => {
                  setCustomPrompt(draftPrompt);
                  setAiModel(draftModel);
                  setAdvancedOpen(false);
                }}
              >
                Apply
              </AppButton>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Custom instructions */}
            <div className="flex w-full flex-col gap-1.5">
              <label className="text-sm font-medium leading-none text-foreground">
                Custom instructions (optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Focus on moments with strong opinions or controversial statements"
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                className={cn(
                  "w-full rounded-xl border bg-card/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all resize-y min-h-[80px] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary border-border/80"
                )}
              />
              <p className="text-xs text-muted-foreground">
                Tell the AI what kinds of moments you want prioritized.
              </p>
            </div>

            {/* AI Model select */}
            <AppSelect
              label="AI model"
              value={draftModel}
              onValueChange={setDraftModel}
              options={AI_MODEL_OPTIONS}
              helperText="Advanced models may take slightly longer & use the same credit cost."
            />
          </div>
        </AppDialog>
      )}

      {/* Error message */}
      {(fieldError || platformError) && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
          {fieldError ||
            platformError ||
            "Something went wrong — please try again"}
        </p>
      )}

      {/* Credit note */}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CoinsIcon className="h-3.5 w-3.5 shrink-0" />
        Uses{" "}
        <span className="font-semibold text-foreground">1 credit</span> per
        video · supports YouTube
      </p>
    </div>
  );
}
