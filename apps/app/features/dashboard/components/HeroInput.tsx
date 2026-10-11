"use client";

import * as React from "react";
import { useAvailableEditingModels } from "@/features/ai-editor/models";
import {
  ModelSelector,
  modelSelectionError,
} from "@/features/ai-editor/ModelSelector";
import Link from "next/link";
import { toast } from "sonner";
import {
  SourcePlatform,
  useCreateJob,
  useStylePresets,
  type StylePresetInfo,
} from "@/features/jobs";
import { useCurrentUser } from "@/features/auth/queries";
import { cn } from "@/lib/utils";
import {
  CoinsIcon,
  AlertTriangleIcon,
  CrownIcon,
  CheckIcon,
  ArrowRightIcon,
  SlidersIcon,
} from "../icons";
import { AppButton } from "@blynta/ui";
import { AppCardRoot, AppInput, AppTextarea, AppSelect } from "@blynta/ui";
import { AppDialog } from "@blynta/ui";
import { useCreditBalance } from "@/features/billing/queries";
import { axiosClient } from "@/config/axiosClient";
import type { CreditEstimate } from "@blynta/types";
import { useRouter } from "next/navigation";
import { HowCreditsWork } from "@/features/billing/components/HowCreditsWork";
import { generationSourceUrl } from "../generation-input";
import { GenerationConfirmation } from "./GenerationConfirmation";

function authorizationValues(estimate: CreditEstimate) {
  return JSON.stringify([
    estimate.sourceSeconds,
    estimate.maxOutputSeconds,
    estimate.totalCredits,
    estimate.pricingVersion,
    estimate.sourceCredits,
    estimate.renderCredits,
    estimate.clipTargetMin,
    estimate.clipTargetMax,
  ]);
}

/* -------------------------------------------------------------------------- */
/*                      AI Model options (matches backend)                   */
/* -------------------------------------------------------------------------- */

const PRESETS_FALLBACK: StylePresetInfo[] = [
  { key: "default", label: "Simple", isPro: false },
  { key: "meme", label: "Meme / Funny", isPro: true },
  { key: "sad", label: "Emotional", isPro: true },
  { key: "motivational", label: "Motivational", isPro: true },
];

const PRESET_META: Record<string, { icon: string; description: string }> = {
  default: {
    icon: "✨",
    description:
      "Natural AI highlight detection with clean Montserrat subtitles",
  },
  meme: {
    icon: "😂",
    description:
      "Prioritizes punchlines & twists with bold animated pop captions",
  },
  sad: {
    icon: "🥺",
    description:
      "Prioritizes heartfelt & sincere moments with elegant serif captions",
  },
  motivational: {
    icon: "⚡",
    description:
      "Prioritizes inspiring advice & high energy with dynamic captions",
  },
};

interface HeroInputProps {
  onSuccess?: () => void;
  initialSourceUrl?: string;
  reviewJobId?: string;
}

export function HeroInput({
  onSuccess,
  initialSourceUrl = "",
  reviewJobId,
}: HeroInputProps) {
  const { data: profile } = useCurrentUser();
  const balance = useCreditBalance();
  const [creditsHelpOpen, setCreditsHelpOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState<{
    body: Parameters<ReturnType<typeof useCreateJob>["mutate"]>[0];
    estimate: CreditEstimate;
  } | null>(null);
  const [estimating, setEstimating] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [confirmationError, setConfirmationError] = React.useState<string>();
  const [verifiedAvailable, setVerifiedAvailable] = React.useState<{
    available: number;
    prior: number;
  }>();
  const estimatingRef = React.useRef(false);
  const submittingRef = React.useRef(false);
  const operationRef = React.useRef<
    { signature: string; id: string } | undefined
  >(undefined);
  const { data: fetchedPresets } = useStylePresets();
  const router = useRouter();
  const isPaid = profile?.plan === "pro" || profile?.plan === "business";

  const presets = fetchedPresets?.length ? fetchedPresets : PRESETS_FALLBACK;

  const [url, setUrl] = React.useState(initialSourceUrl);
  const [stylePreset, setStylePreset] = React.useState<string>("default");
  const [fieldError, setFieldError] = React.useState<string | undefined>();

  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [customPrompt, setCustomPrompt] = React.useState("");
  const [aiModel, setAiModel] = React.useState<string>("auto");
  const models = useAvailableEditingModels("highlight_detection");

  const { mutate, isPending, failureReason, reset } = useCreateJob({
    onSuccess: (data) => {
      submittingRef.current = false;
      setChecking(false);
      setConfirmationError(undefined);
      setConfirmation(null);
      operationRef.current = undefined;
      setUrl("");
      setStylePreset("default");
      setFieldError(undefined);
      setCustomPrompt("");
      setAiModel("auto");
      setAdvancedOpen(false);
      toast.success("Video ingested! AI clip generation started.");
      router.push(`/my-clips/${data?._id}`);
      onSuccess?.();
    },
    onError: (err) => {
      submittingRef.current = false;
      setChecking(false);
      setConfirmationError(
        "Couldn’t start generation. Try again to check the latest estimate.",
      );
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to submit video. Please try again.",
      );
    },
  });

  const isCustomPromptSet = customPrompt.trim().length > 0;
  const isCustomModelSet = aiModel !== "auto";
  const hasAdvancedOverrides = isCustomPromptSet || isCustomModelSet;
  const platformError =
    failureReason instanceof Error ? failureReason.message : undefined;
  const submitDisabled =
    !url.trim() ||
    isPending ||
    estimating ||
    !balance.data?.enabled ||
    !!modelSelectionError(models.data, aiModel) ||
    !!presets.find((p) => p.key === stylePreset && p.isPro && !isPaid);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (estimatingRef.current || submittingRef.current || isPending) return;
    if (modelSelectionError(models.data, aiModel)) {
      setFieldError(modelSelectionError(models.data, aiModel));
      return;
    }
    if (!url.trim()) {
      setFieldError(
        "Paste a video link (YouTube, Vimeo, Podcast) to get started",
      );
      return;
    }

    if (presets.find((p) => p.key === stylePreset && p.isPro && !isPaid)) {
      setFieldError("This highlight style requires a paid plan.");
      return;
    }
    let sourceUrl: string;
    try {
      sourceUrl = generationSourceUrl(url);
    } catch (error) {
      setFieldError((error as Error).message);
      return;
    }

    setFieldError(undefined);
    reset();

    const body: Parameters<typeof mutate>[0] = {
      sourceUrl,
      sourcePlatform: SourcePlatform.YOUTUBE,
      stylePreset,
    };

    if (isPaid && customPrompt.trim().length > 0) {
      body.customPrompt = customPrompt.trim();
    }
    if (isPaid && aiModel && aiModel !== "auto") {
      body.modelId = aiModel;
    }

    if (!balance.data) return;
    if (!balance.data.enabled) {
      setFieldError(
        "Usage-based billing is not active. New processing is temporarily unavailable.",
      );
      return;
    }
    estimatingRef.current = true;
    setEstimating(true);
    setConfirmationError(undefined);
    try {
      const estimate = (
        await axiosClient.post<CreditEstimate>("/jobs/estimate", {
          sourceUrl,
          ...(reviewJobId && sourceUrl === initialSourceUrl
            ? { reviewJobId }
            : {}),
        })
      ).data;
      setVerifiedAvailable(undefined);
      const signature = JSON.stringify([
        body,
        estimate.sourceSeconds,
        estimate.maxOutputSeconds,
        estimate.totalCredits,
        estimate.pricingVersion,
      ]);
      if (operationRef.current?.signature !== signature)
        operationRef.current = { signature, id: crypto.randomUUID() };
      setConfirmation({
        body: {
          ...body,
          operationId: operationRef.current.id,
          sourceSeconds: estimate.sourceSeconds,
          maxOutputSeconds: estimate.maxOutputSeconds,
          authorizedCredits: estimate.totalCredits,
          pricingVersion: estimate.pricingVersion,
        },
        estimate,
      });
    } catch {
      setFieldError(
        "Couldn’t fetch an estimate. Check your video link and try again.",
      );
    } finally {
      estimatingRef.current = false;
      setEstimating(false);
    }
  }

  async function approveGeneration() {
    if (
      !confirmation ||
      submittingRef.current ||
      isPending ||
      !balance.data?.enabled ||
      balance.error ||
      confirmation.estimate.totalCredits > balance.data.available
    )
      return;
    submittingRef.current = true;
    setChecking(true);
    setConfirmationError(undefined);
    let submitted = false;
    try {
      const latest = (
        await axiosClient.post<CreditEstimate>("/jobs/estimate", {
          sourceUrl: confirmation.body.sourceUrl,
          ...(reviewJobId && confirmation.body.sourceUrl === initialSourceUrl
            ? { reviewJobId }
            : {}),
        })
      ).data;
      if (latest.enabled === false) {
        setConfirmationError(
          "Processing is temporarily unavailable. Please try again later.",
        );
        return;
      }
      if (
        authorizationValues(latest) !==
        authorizationValues(confirmation.estimate)
      ) {
        setVerifiedAvailable({
          available: latest.available,
          prior: balance.data.available,
        });
        const id = crypto.randomUUID();
        operationRef.current = undefined;
        setConfirmation({
          estimate: latest,
          body: {
            ...confirmation.body,
            operationId: id,
            sourceSeconds: latest.sourceSeconds,
            maxOutputSeconds: latest.maxOutputSeconds,
            authorizedCredits: latest.totalCredits,
            pricingVersion: latest.pricingVersion,
          },
        });
        setConfirmationError(
          "Your estimate changed. Review the updated maximum before confirming again.",
        );
        return;
      }
      if (latest.totalCredits > latest.available) {
        setVerifiedAvailable({
          available: latest.available,
          prior: balance.data.available,
        });
        setConfirmation({ ...confirmation, estimate: latest });
        setConfirmationError(
          "Your balance changed. Refresh your balance or view plans to add credits.",
        );
        void balance.refetch();
        return;
      }
      mutate(confirmation.body);
      submitted = true;
    } catch {
      setConfirmationError(
        "Couldn’t refresh the estimate. Try again before generating.",
      );
    } finally {
      setChecking(false);
      if (!submitted) submittingRef.current = false;
    }
  }

  return (
    <div className="w-full">
      {/* ── Creation Card Surface ── */}
      <AppCardRoot className="relative flex-col gap-4 overflow-hidden rounded-2xl border border-primary/15 bg-card p-5 shadow-sm sm:px-6 sm:py-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.08] to-transparent"
        />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              New project
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Turn long videos into standout shorts
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Paste a YouTube or Vimeo link. Blynta finds the strongest moments,
              reframes them vertically, and adds captions.
            </p>
          </div>
          <AppButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCreditsHelpOpen(true)}
            className="inline-flex w-fit shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <CoinsIcon className="h-3 w-3 text-amber-500" />
            How credits work
          </AppButton>
        </div>

        <form
          onSubmit={handleSubmit}
          className="relative space-y-3 rounded-xl border bg-background p-3 sm:p-4"
        >
          <label htmlFor="video-url-input" className="sr-only">
            Video URL
          </label>

          {/* Input field + submit button */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <AppInput
                id="video-url-input"
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (fieldError) setFieldError(undefined);
                }}
                placeholder="Paste a YouTube or Vimeo link…"
                className={cn(
                  "h-16 w-full rounded-lg border-0 bg-transparent pl-3 pr-3 text-sm text-foreground shadow-inner shadow-black/[0.02] transition-colors placeholder:text-muted-foreground/60",
                  "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30",
                  url && "pr-16",
                  fieldError
                    ? "border-destructive ring-1 ring-destructive/30"
                    : "border-border/80",
                )}
                disabled={isPending || estimating}
                aria-invalid={!!fieldError}
                aria-describedby={
                  fieldError || platformError
                    ? "generation-input-error"
                    : undefined
                }
              />
              {url && (
                <AppButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Clear video URL"
                  disabled={isPending || estimating}
                  onClick={() => setUrl("")}
                  className="absolute right-1 top-4"
                >
                  Clear
                </AppButton>
              )}
            </div>
          </div>

          {/* Error */}
          {(fieldError || platformError) && (
            <p
              id="generation-input-error"
              role="alert"
              className="flex items-center gap-1.5 text-xs text-destructive px-1 pt-1"
            >
              <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
              {fieldError || platformError}
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border/60 pt-3">
            <div className="flex min-w-0 flex-wrap items-start gap-2">
              <div className="min-w-0 w-full sm:w-auto">
                <ModelSelector
                  data={models.data}
                  loading={models.isPending}
                  error={models.isError}
                  selected={aiModel}
                  onChange={setAiModel}
                  disabled={isPending || checking || !!confirmation}
                />
              </div>

              <AppSelect
                aria-label="Highlight style"
                size="sm"
                value={stylePreset}
                onValueChange={setStylePreset}
                disabled={isPending || estimating || !!confirmation}
                wrapperClassName="w-full sm:w-44"
                options={presets.map((p) => ({
                  value: p.key,
                  label: (
                    <span>
                      {PRESET_META[p.key]?.icon} {p.label}
                      {p.isPro ? " · Pro" : ""}
                    </span>
                  ),
                  description: PRESET_META[p.key]?.description,
                  disabled: p.isPro && !isPaid,
                }))}
              />
              <AppButton
                type="button"
                variant="ghost"
                disabled={isPending || estimating || !!confirmation}
                onClick={() => setAdvancedOpen(true)}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors",
                  hasAdvancedOverrides
                    ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                    : "border-border/70 bg-background text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <SlidersIcon className="h-3.5 w-3.5" />
                <span>Customize</span>
                {!isPaid && (
                  <span className="rounded bg-primary/10 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-primary">
                    Pro
                  </span>
                )}
                {hasAdvancedOverrides && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <CheckIcon className="h-2.5 w-2.5" />
                  </span>
                )}
              </AppButton>
            </div>
            <AppButton
              type="submit"
              disabled={submitDisabled}
              isLoading={isPending || estimating}
              icon={<ArrowRightIcon className="h-3.5 w-3.5" />}
              iconPosition="right"
              size="sm"
              className="w-full sm:w-auto"
            >
              Review &amp; Generate
            </AppButton>
          </div>
        </form>
        {balance.data && !balance.data.enabled && (
          <p role="alert" className="text-sm text-muted-foreground">
            Usage-based billing is not active. New processing is temporarily
            unavailable.
          </p>
        )}
        {balance.error && (
          <p role="alert" className="text-sm text-destructive">
            Credit balance unavailable.{" "}
            <AppButton
              type="button"
              className="underline"
              onClick={() => void balance.refetch()}
            >
              Try again
            </AppButton>
          </p>
        )}
      </AppCardRoot>

      <GenerationConfirmation
        estimate={confirmation?.estimate}
        available={
          verifiedAvailable === undefined ||
          balance.data?.available !== verifiedAvailable.prior
            ? (balance.data?.available ?? confirmation?.estimate.available ?? 0)
            : verifiedAvailable.available
        }
        busy={isPending || checking}
        checking={checking}
        enabled={!!balance.data?.enabled && !balance.error}
        error={confirmationError}
        onCancel={() => {
          if (!submittingRef.current && !isPending) {
            setConfirmation(null);
            setConfirmationError(undefined);
          }
        }}
        onApprove={approveGeneration}
      />
      <HowCreditsWork
        open={creditsHelpOpen}
        onOpenChange={setCreditsHelpOpen}
        balance={balance.data}
      />
      <AppDialog
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        size="md"
        contentClassName="sm:max-w-xl"
        bodyClassName="max-h-[70vh] overflow-y-auto"
        title="Guide your highlights"
        description="Tell Blynta which moments to prioritize, what to avoid, or what kind of clips you want."
        footer={
          <AppButton
            type="button"
            size="sm"
            onClick={() => setAdvancedOpen(false)}
          >
            Done
          </AppButton>
        }
      >
        {!isPaid ? (
          <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/15 text-primary">
                  <CrownIcon className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-foreground">
                    Advanced AI models and custom prompts
                  </h4>
                  <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
                    Upgrade to select deeper reasoning models and tell Blynta
                    exactly which moments to prioritize.
                  </p>
                </div>
              </div>
              <Link href="/billing" className="shrink-0">
                <AppButton
                  size="sm"
                  className="cursor-pointer"
                  icon={<CrownIcon className="h-3.5 w-3.5" />}
                >
                  Upgrade plan
                </AppButton>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label htmlFor="custom-focus-instructions" className="sr-only">
              Focus instructions
            </label>
            <AppTextarea
              id="custom-focus-instructions"
              rows={6}
              maxLength={2000}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Focus on the funniest reactions and unexpected moments. Prefer clips that make sense without extra context. Avoid long introductions, repeated jokes, and quiet sections."
              className="min-h-40 resize-y text-sm leading-6"
            />
            <div className="flex flex-wrap gap-2">
              {[
                "Find surprising opinions and strong reactions.",
                "Prioritize educational moments with practical advice.",
                "Avoid introductions and repetitive sections.",
              ].map((example) => (
                <AppButton
                  key={example}
                  type="button"
                  variant="outline"
                  size="sm"
                  contentClassName="whitespace-normal"
                  className="h-auto py-2 text-left text-xs"
                  onClick={() =>
                    setCustomPrompt((p) =>
                      (p.trim() ? p.trim() + "\n" + example : example).slice(
                        0,
                        2000,
                      ),
                    )
                  }
                >
                  {example}
                </AppButton>
              ))}
            </div>
            <p className="text-right text-xs text-muted-foreground">
              {customPrompt.length}/2000
            </p>
          </div>
        )}
      </AppDialog>
    </div>
  );
}
