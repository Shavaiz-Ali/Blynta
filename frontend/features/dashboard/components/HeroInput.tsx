"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { SourcePlatform, useCreateJob, useStylePresets, type StylePresetInfo } from "@/features/jobs";
import { useCurrentUser } from "@/features/auth/queries";
import { cn } from "@/lib/utils";
import {
  CoinsIcon,
  AlertTriangleIcon,
  CrownIcon,
  CheckIcon,
  PaletteIcon,
  ArrowRightIcon,
  SlidersIcon,
} from "../icons";
import { AppSelect } from "@/components/common/AppSelect";
import { AppButton } from "@/components/common/AppButton";
import { AppCard } from "@/components/common/AppCard";
import { AppDialog } from "@/components/common/AppDialog";
import { useRouter } from "next/navigation";

/* -------------------------------------------------------------------------- */
/*                      AI Model options (matches backend)                   */
/* -------------------------------------------------------------------------- */

interface AiModelOption {
  value: string;
  label: string;
  description: string;
}

const AI_MODEL_OPTIONS: AiModelOption[] = [
  {
    value: "default",
    label: "Standard (Fast · GPT-4o Mini)",
    description: "High quality, fast processing speed",
  },
  {
    value: "gpt-4o",
    label: "GPT-4o (Deep Reasoning)",
    description: "Slower, sharper reasoning and hook detection",
  },
  {
    value: "claude-3-5-sonnet",
    label: "Claude 3.5 Sonnet",
    description: "Top-tier creative hook detection and context depth",
  },
  {
    value: "claude-3-opus",
    label: "Claude 3 Opus",
    description: "Maximum analytical depth for nuanced podcasts",
  },
];

const PRESETS_FALLBACK: StylePresetInfo[] = [
  { key: "default", label: "Simple", isPro: false },
  { key: "meme", label: "Meme / Funny", isPro: true },
  { key: "sad", label: "Emotional", isPro: true },
  { key: "motivational", label: "Motivational", isPro: true },
];

const PRESET_META: Record<string, { icon: string; description: string }> = {
  default: {
    icon: "✨",
    description: "Natural AI highlight detection with clean Montserrat subtitles",
  },
  meme: {
    icon: "😂",
    description: "Prioritizes punchlines & twists with bold animated pop captions",
  },
  sad: {
    icon: "🥺",
    description: "Prioritizes heartfelt & sincere moments with elegant serif captions",
  },
  motivational: {
    icon: "⚡",
    description: "Prioritizes inspiring advice & high energy with dynamic captions",
  },
};

interface HeroInputProps {
  onSuccess?: () => void;
}

export function HeroInput({ onSuccess }: HeroInputProps) {
  const { data: profile } = useCurrentUser();
  const { data: fetchedPresets } = useStylePresets();
  const router = useRouter();
  const isPaid = profile?.plan === "pro" || profile?.plan === "business";

  const presets = fetchedPresets?.length ? fetchedPresets : PRESETS_FALLBACK;

  const [url, setUrl] = React.useState("");
  const [stylePreset, setStylePreset] = React.useState<string>("default");
  const [fieldError, setFieldError] = React.useState<string | undefined>();

  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [customPrompt, setCustomPrompt] = React.useState("");
  const [aiModel, setAiModel] = React.useState<string>("default");

  const { mutate, isPending, failureReason, reset } = useCreateJob({
    onSuccess: (data) => {
      setUrl("");
      setStylePreset("default");
      setFieldError(undefined);
      setCustomPrompt("");
      setAiModel("default");
      setAdvancedOpen(false);
      toast.success("Video ingested! AI clip generation started.");
      router.push(`/my-clips/${data?._id}`);
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to submit video. Please try again.");
    },
  });

  const selectedPresetMeta = PRESET_META[stylePreset] || PRESET_META.default;
  const isCustomPromptSet = customPrompt.trim().length > 0;
  const isCustomModelSet = aiModel !== "default";
  const hasAdvancedOverrides = isCustomPromptSet || isCustomModelSet;
  const platformError = failureReason instanceof Error ? failureReason.message : undefined;
  const submitDisabled = !url.trim() || isPending;

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!url.trim()) {
      setFieldError("Paste a video link (YouTube, Vimeo, Podcast) to get started");
      return;
    }

    let sourceUrl = url.trim();
    if (!sourceUrl.startsWith("http://") && !sourceUrl.startsWith("https://")) {
      sourceUrl = `https://${sourceUrl}`;
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
    if (isPaid && aiModel && aiModel !== "default") {
      body.aiModel = aiModel;
    }

    mutate(body);
  }

  return (
    <div className="w-full">
      {/* ── Creation Card Surface ── */}
      <AppCard
        className="relative flex-col gap-4 overflow-hidden rounded-2xl border border-primary/15 bg-card p-5 shadow-sm sm:px-6 sm:py-5"
        useDefaultClasses={false}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.08] to-transparent" />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">New project</p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">Create shorts from any long video</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Paste a YouTube or Vimeo link. Blynta finds the strongest moments, reframes them vertically, and adds captions.</p>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <CoinsIcon className="h-3 w-3 text-amber-500" />
              <span>1 credit per job</span>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="relative space-y-2">
          <label htmlFor="video-url-input" className="text-xs font-semibold text-foreground">Video URL</label>

          {/* Input field + submit button */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                id="video-url-input"
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (fieldError) setFieldError(undefined);
                }}
                placeholder="https://youtube.com/watch?v=..."
                className={cn(
                  "h-12 w-full rounded-xl border bg-background px-4 text-sm text-foreground shadow-inner shadow-black/[0.02] transition-colors placeholder:text-muted-foreground/60",
                  "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30",
                  fieldError ? "border-destructive ring-1 ring-destructive/30" : "border-border/80"
                )}
                disabled={isPending}
              />
            </div>

            <AppButton
              type="submit"
              disabled={submitDisabled}
              isLoading={isPending}
              icon={<ArrowRightIcon className="h-3.5 w-3.5" />}
              iconPosition="right"
              size="sm"
              className="h-12 w-full shrink-0 cursor-pointer rounded-xl px-5 text-sm font-semibold shadow-sm sm:w-auto"
            >
              Generate shorts
            </AppButton>
          </div>

          {/* Error */}
          {(fieldError || platformError) && (
            <p className="flex items-center gap-1.5 text-xs text-destructive px-1 pt-1">
              <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
              {fieldError || platformError}
            </p>
          )}
        </form>

        {/* ── Highlight Style Presets ── */}
        <div className="relative space-y-2.5 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <PaletteIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Highlight style</span>
            </div>
            <button
              type="button"
              onClick={() => setAdvancedOpen(true)}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors",
                hasAdvancedOverrides
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-border/70 bg-background text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <SlidersIcon className="h-3.5 w-3.5" />
              <span>Customize</span>
              {!isPaid && <span className="rounded bg-primary/10 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-primary">Pro</span>}
              {hasAdvancedOverrides && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckIcon className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => {
              const isSelected = stylePreset === preset.key;
              const meta = PRESET_META[preset.key];
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setStylePreset(preset.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer outline-none",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                      : "border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border"
                  )}
                >
                  <span>{meta?.icon || "✨"}</span>
                  <span>{preset.label}</span>
                  {preset.isPro && (
                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-1 py-px rounded bg-muted-foreground/15 text-muted-foreground">
                      PRO
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedPresetMeta?.description && (
            <p className="text-[11px] text-muted-foreground/70">
              {selectedPresetMeta.description}
            </p>
          )}

        </div>
      </AppCard>

      <AppDialog
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        size="lg"
        contentClassName="sm:max-w-2xl"
        bodyClassName="max-h-[70vh] overflow-y-auto"
        title="Fine-tune your results"
        description="Choose how Blynta analyzes this video. These settings are optional."
        footer={
          <AppButton type="button" size="sm" onClick={() => setAdvancedOpen(false)}>
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
                  <h4 className="text-sm font-bold text-foreground">Advanced AI models and custom prompts</h4>
                  <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
                    Upgrade to select deeper reasoning models and tell Blynta exactly which moments to prioritize.
                  </p>
                </div>
              </div>
              <Link href="/billing" className="shrink-0">
                <AppButton size="sm" className="cursor-pointer" icon={<CrownIcon className="h-3.5 w-3.5" />}>
                  Upgrade plan
                </AppButton>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)]">
              <div className="rounded-xl border border-border/70 bg-card/50 p-4">
                <AppSelect
                  label="Analysis model"
                  value={aiModel}
                  onValueChange={setAiModel}
                  options={AI_MODEL_OPTIONS}
                  triggerClassName="h-10 rounded-lg bg-background text-xs"
                  helperText="Standard is fastest. Deeper models can improve context and hook detection."
                />
              </div>

              <div className="rounded-xl border border-border/70 bg-card/50 p-4">
                <p className="text-xs font-semibold text-foreground">Included automatically</p>
                <div className="mt-3 space-y-2.5">
                  <IncludedFeature label="9:16 smart reframing" />
                  <IncludedFeature label="Animated captions" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <label htmlFor="custom-focus-instructions" className="text-xs font-semibold text-foreground">Focus instructions</label>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Describe the moments your audience will care about most.</p>
                </div>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Optional</span>
              </div>
              <textarea
                id="custom-focus-instructions"
                rows={4}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Example: Prioritize surprising opinions, practical advice, and moments that make sense without earlier context."
                className="mt-3 min-h-24 w-full resize-none rounded-lg border border-border bg-background p-3 text-xs leading-5 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>
        )}
      </AppDialog>
    </div>
  );
}

function IncludedFeature({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-foreground">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckIcon className="h-3 w-3" />
      </span>
      <span>{label}</span>
    </div>
  );
}
