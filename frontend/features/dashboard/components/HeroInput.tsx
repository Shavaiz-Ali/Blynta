"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { SourcePlatform, useCreateJob, useStylePresets, type StylePresetInfo } from "@/features/jobs";
import { useCurrentUser } from "@/features/auth/queries";
import { cn } from "@/lib/utils";
import {
  SparklesIcon,
  CoinsIcon,
  AlertTriangleIcon,
  CrownIcon,
  CheckIcon,
  PaletteIcon,
  ArrowRightIcon,
  SlidersIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "../icons";
import { AppSelect, type AppSelectOption } from "@/components/common/AppSelect";
import { AppButton } from "@/components/common/AppButton";
import { AppCard } from "@/components/common/AppCard";
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

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
  const [verticalCrop, setVerticalCrop] = React.useState(true);
  const [autoCaptions, setAutoCaptions] = React.useState(true);
  const [fieldError, setFieldError] = React.useState<string | undefined>();

  /* Progressive disclosure state for Advanced AI options */
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [customPrompt, setCustomPrompt] = React.useState("");
  const [aiModel, setAiModel] = React.useState<string>("default");

  const { mutate, isPending, failureReason, reset } = useCreateJob({
    onSuccess: (data: any) => {
      setUrl("");
      setStylePreset("default");
      setFieldError(undefined);
      setCustomPrompt("");
      setAiModel("default");
      setShowAdvanced(false);
      toast.success("Video ingested! AI clip generation started.");
      router.push(`/my-clips/${data?._id}`);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit video. Please try again.");
    },
  });

  const selectedPresetMeta = PRESET_META[stylePreset] || PRESET_META.default;
  const isCustomPromptSet = customPrompt.trim().length > 0;
  const isCustomModelSet = aiModel !== "default";
  const hasAdvancedOverrides = isCustomPromptSet || isCustomModelSet;
  const platformError: string | undefined = (failureReason as any)?.message;
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

  const firstName = profile?.name?.split(" ")[0] || null;

  return (
    <div className="w-full space-y-4">
      {/* ── Greeting ── */}
      {firstName && (
        <p className="text-sm text-muted-foreground font-medium">
          {getGreeting()}, <span className="text-foreground font-semibold">{firstName}</span>.
        </p>
      )}

      {/* ── Creation Card Surface ── */}
      <AppCard
        className="flex-col gap-4 p-4 sm:p-5 rounded-xl border border-border/80 bg-card/70 backdrop-blur-md shadow-sm"
        useDefaultClasses={false}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Label + Cost badge */}
          <div className="flex items-center justify-between">
            <label
              htmlFor="video-url-input"
              className="text-xs font-semibold text-foreground flex items-center gap-1.5"
            >
              <SparklesIcon className="h-3.5 w-3.5 text-primary" />
              <span>Create Viral Shorts with AI</span>
            </label>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium bg-muted/60 px-2 py-0.5 rounded-md">
              <CoinsIcon className="h-3 w-3 text-amber-500" />
              <span>1 credit per job</span>
            </span>
          </div>

          {/* Input field + submit button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                id="video-url-input"
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (fieldError) setFieldError(undefined);
                }}
                placeholder="Paste long-form video URL (YouTube, Vimeo, etc.)..."
                className={cn(
                  "w-full h-10 px-3.5 rounded-lg border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors",
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
              className="h-9 px-4 rounded-lg font-semibold text-xs shrink-0 cursor-pointer shadow-sm"
            >
              Generate
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
        <div className="space-y-2 pt-1 border-t border-border/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <PaletteIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Highlight style</span>
            </div>

            {/* Progressive disclosure trigger for Advanced options */}
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors cursor-pointer",
                showAdvanced || hasAdvancedOverrides
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <SlidersIcon className="h-3 w-3" />
              <span>Advanced options</span>
              {!isPaid && (
                <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                  PRO
                </span>
              )}
              {hasAdvancedOverrides && <CheckIcon className="h-3 w-3 text-primary" />}
              {showAdvanced ? (
                <ChevronUpIcon className="h-3 w-3" />
              ) : (
                <ChevronDownIcon className="h-3 w-3" />
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

        {/* ── Progressive Disclosure: Advanced AI Controls ── */}
        {showAdvanced && (
          <div className="pt-4 border-t border-border/60 space-y-4 animate-in fade-in duration-200">
            {!isPaid ? (
              /* Upgrade to Pro / Business Callout for Free Plan */
              <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary border border-primary/25 shrink-0 mt-0.5">
                      <CrownIcon className="h-4.5 w-4.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground">
                          Advanced AI Models &amp; Custom Prompts
                        </h4>
                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                          PRO &amp; BUSINESS
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                        Upgrade to Pro or Business to select deep reasoning models (<span className="font-semibold text-foreground">GPT-4o</span>, <span className="font-semibold text-foreground">Claude 3.5 Sonnet</span>), write custom hook prompts, and fine-tune output framing.
                      </p>
                    </div>
                  </div>

                  <Link href="/billing" className="shrink-0 self-start sm:self-center">
                    <AppButton
                      variant="default"
                      size="sm"
                      className="h-8.5 px-3.5 text-xs font-semibold cursor-pointer shadow-sm"
                      icon={<CrownIcon className="h-3.5 w-3.5" />}
                    >
                      Upgrade Plan
                    </AppButton>
                  </Link>
                </div>
              </div>
            ) : (
              /* Paid options for Pro / Business */
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CrownIcon className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Advanced AI &amp; Output Configuration
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/15 px-2 py-0.5 rounded">
                    Active Plan
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* AI Model Selection */}
                  <div className="space-y-1.5">
                    <AppSelect
                      label="AI Model Engine"
                      value={aiModel}
                      onValueChange={setAiModel}
                      options={AI_MODEL_OPTIONS}
                      triggerClassName="h-9 rounded-lg bg-background text-xs"
                      helperText="Select model reasoning depth for analyzing hooks and speaker dynamics."
                    />
                  </div>

                  {/* Output / Crop / Captions */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Output Formatting
                    </label>
                    <div className="flex items-center gap-3 pt-1">
                      <Toggle
                        active={verticalCrop}
                        onToggle={() => setVerticalCrop(!verticalCrop)}
                        label="9:16 Vertical Crop"
                      />
                      <span className="text-border">·</span>
                      <Toggle
                        active={autoCaptions}
                        onToggle={() => setAutoCaptions(!autoCaptions)}
                        label="Auto Captions"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Automatically reframes landscape videos and burns animated subtitles.
                    </p>
                  </div>
                </div>

                {/* Custom AI Prompt */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Custom AI Prompt / Focus Instructions (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Tell Blynta what kind of moments to prioritize (e.g., debate hooks, humor, actionable advice)..."
                    className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none resize-y min-h-[64px] focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </AppCard>
    </div>
  );
}

/* Small toggle utility */
function Toggle({
  active,
  onToggle,
  label,
}: {
  active: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer",
        active ? "text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full transition-colors",
          active ? "bg-primary" : "bg-muted-foreground/30"
        )}
      />
      {label}
    </button>
  );
}
