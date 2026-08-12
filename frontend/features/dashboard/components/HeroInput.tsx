"use client";

import * as React from "react";
import { toast } from "sonner";
import { SourcePlatform, useCreateJob } from "@/features/jobs";
import { AppButton } from "@/components/common/AppButton";
import { AppInput } from "@/components/common/AppInput";
import { useCurrentUser } from "@/features/auth/queries";
import { cn } from "@/lib/utils";
import {
  SparklesIcon,
  CoinsIcon,
  AlertTriangleIcon,
  YoutubeIcon,
  TiktokIcon,
  InstagramIcon,
  TwitchIcon,
  RumbleIcon,
  ZoomIcon,
  UploadIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CrownIcon,
  CheckIcon,
} from "../icons";
import { useRouter } from "next/navigation";

export interface PlatformConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  platform: SourcePlatform;
  placeholder: string;
  regex?: RegExp;
}

export const SUPPORTED_PLATFORMS: PlatformConfig[] = [
  {
    id: "youtube",
    label: "YouTube",
    icon: <YoutubeIcon className="h-4 w-4 text-[#FF0000]" />,
    platform: SourcePlatform.YOUTUBE,
    placeholder: "https://www.youtube.com/watch?v=...",
    regex: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i,
  },
  {
    id: "twitch",
    label: "Twitch",
    icon: <TwitchIcon className="h-4 w-4 text-[#9146FF]" />,
    platform: SourcePlatform.UPLOAD,
    placeholder: "https://www.twitch.tv/videos/...",
    regex: /^https?:\/\/(www\.)?twitch\.tv\//i,
  },
  {
    id: "rumble",
    label: "Rumble",
    icon: <RumbleIcon className="h-4 w-4 text-[#85C742]" />,
    platform: SourcePlatform.UPLOAD,
    placeholder: "https://rumble.com/v...",
    regex: /^https?:\/\/(www\.)?rumble\.com\//i,
  },
  {
    id: "zoom",
    label: "Zoom",
    icon: <ZoomIcon className="h-4 w-4 text-[#2D8CFF]" />,
    platform: SourcePlatform.UPLOAD,
    placeholder: "https://zoom.us/rec/play/...",
    regex: /^https?:\/\/(www\.)?zoom\.us\//i,
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: <TiktokIcon className="h-4 w-4" />,
    platform: SourcePlatform.TIKTOK,
    placeholder: "https://www.tiktok.com/@user/video/...",
    regex: /^https?:\/\/(www\.)?tiktok\.com\//i,
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: <InstagramIcon className="h-4 w-4 text-[#E4405F]" />,
    platform: SourcePlatform.INSTAGRAM,
    placeholder: "https://www.instagram.com/reel/...",
    regex: /^https?:\/\/(www\.)?instagram\.com\//i,
  },
  {
    id: "upload",
    label: "Upload / Link",
    icon: <UploadIcon className="h-4 w-4 text-primary" />,
    platform: SourcePlatform.UPLOAD,
    placeholder: "https://cdn.example.com/video.mp4 or select local file...",
    regex: /^https?:\/\//i,
  },
];

export function autoDetectSource(url: string): PlatformConfig | null {
  if (!url) return null;
  for (const p of SUPPORTED_PLATFORMS) {
    if (p.regex && p.regex.test(url.trim())) return p;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                      AI Model options (matches backend ALLOWED_PAID_AI_MODELS) */
/* -------------------------------------------------------------------------- */

const AI_MODEL_OPTIONS: {
  value: string;
  label: string;
  description: string;
}[] = [
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
  const router = useRouter()
  const isPaid = profile?.plan === "pro" || profile?.plan === "business";

  const [url, setUrl] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string>("youtube");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<string | undefined>();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  /* Advanced options state (paid only) */
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [customPrompt, setCustomPrompt] = React.useState("");
  const [aiModel, setAiModel] = React.useState<string>("default");
  const [modelOpen, setModelOpen] = React.useState(false);
  const modelDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!modelDropdownRef.current) return;
      if (!modelDropdownRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const { mutate, isPending, failureReason, reset } = useCreateJob({
    onSuccess: (data: any) => {
      setUrl("");
      setFileName(null);
      setFieldError(undefined);
      setCustomPrompt("");
      setAiModel("default");
      setAdvancedOpen(false);
      toast.success("Video URL submitted! AI clip generation started.");
      router.push(`/jobs/${data?._id}`)
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit video. Please try again.");
    },
  });

  const detected = autoDetectSource(url);
  React.useEffect(() => {
    if (detected) {
      setSelectedId(detected.id);
    }
  }, [detected?.id]);

  const activeConfig =
    SUPPORTED_PLATFORMS.find((p) => p.id === selectedId) ||
    SUPPORTED_PLATFORMS[0];

  const selectedModel =
    AI_MODEL_OPTIONS.find((m) => m.value === aiModel) || AI_MODEL_OPTIONS[0];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setUrl(
        `https://local-upload.blynta.com/${encodeURIComponent(file.name)}`
      );
      setSelectedId("upload");
      if (fieldError) setFieldError(undefined);
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!url.trim() && !fileName) {
      setFieldError("Paste a video link or upload a file to get started");
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
      sourcePlatform: activeConfig.platform,
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

  const platformError: string | undefined = (failureReason as any)?.message;
  const submitDisabled = (!url.trim() && !fileName) || isPending;

  return (
    <div className="w-full rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-6">
      {/* Platform selection pills */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4">
        {SUPPORTED_PLATFORMS.map((p) => {
          const isSelected = selectedId === p.id;
          const isAutoDetected = detected?.id === p.id;
          return (
            <AppButton
              key={p.id}
              type="button"
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedId(p.id);
                if (p.id === "upload" && !url) {
                  fileInputRef.current?.click();
                }
              }}
              className={cn(
                "h-8 rounded-lg px-2.5 text-xs font-medium transition-all",
                isSelected
                  ? "bg-primary/10 text-foreground border-primary ring-1 ring-primary/30 hover:bg-primary/15"
                  : "border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-1.5">
                {p.icon}
                <span>{p.label}</span>
                {isAutoDetected && !isSelected && (
                  <span className="text-[9px] font-bold uppercase px-1 rounded bg-chart-4/20 text-chart-4 leading-none">
                    Auto
                  </span>
                )}
              </div>
            </AppButton>
          );
        })}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main input + file upload button + CTA */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (fileName) setFileName(null);
                if (fieldError) setFieldError(undefined);
              }}
              placeholder={activeConfig.placeholder}
              aria-label="Video URL or Link"
              aria-invalid={!!fieldError}
              className={cn(
                "w-full h-12 sm:h-14 rounded-xl border bg-background px-4 pr-24 text-sm sm:text-base text-foreground placeholder:text-muted-foreground/60 outline-none transition-all",
                "focus:ring-2 focus:ring-primary/40 focus:border-primary",
                fieldError
                  ? "border-destructive focus:ring-destructive/40 focus:border-destructive"
                  : "border-border/80"
              )}
            />

            {/* Quick file upload button inside input */}
            <AppButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="absolute right-2 h-8 px-2.5 rounded-lg bg-muted text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Upload local video file"
              icon={<UploadIcon className="h-3.5 w-3.5" />}
            >
              <span className="hidden sm:inline">Upload</span>
            </AppButton>
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

        {/* Advanced options (paid only) */}
        {isPaid && (
          <div className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors text-left rounded-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
                <CrownIcon className="h-3.5 w-3.5 text-chart-4" />
                Advanced options
                <span className="text-[10px] font-bold uppercase tracking-wider text-chart-4 bg-chart-4/15 px-1.5 py-0.5 rounded">
                  PRO
                </span>
              </span>
              {advancedOpen ? (
                <ChevronUpIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>

            {advancedOpen && (
              <div className="border-t border-border/70 px-4 py-4 space-y-4">
                {/* Custom instructions */}
                <div className="flex w-full flex-col gap-1.5">
                  <label className="text-sm font-medium leading-none text-foreground">
                    Custom instructions (optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Focus on moments with strong opinions or controversial statements"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className={cn(
                      "w-full rounded-xl border bg-card/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all resize-y min-h-[80px] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary border-border/80"
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tell the AI what kinds of moments you want prioritized.
                  </p>
                </div>

                {/* AI Model select */}
                <div className="space-y-1.5" ref={modelDropdownRef}>
                  <label className="text-sm font-medium leading-none text-foreground">
                    AI model
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setModelOpen((o) => !o)}
                      className="w-full flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/60 px-3 py-2.5 text-left hover:bg-accent/20 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          {selectedModel?.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {selectedModel?.description}
                        </div>
                      </div>
                      {modelOpen ? (
                        <ChevronUpIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>

                    {modelOpen && (
                      <div className="absolute z-20 left-0 right-0 mt-1.5 rounded-xl border border-border bg-card shadow-lg overflow-hidden shadow-xl">
                        {AI_MODEL_OPTIONS.map((opt) => {
                          const active = opt.value === aiModel;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setAiModel(opt.value);
                                setModelOpen(false);
                              }}
                              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent/40 transition-colors text-left border-b border-border/60 last:border-b-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                              <div
                                className={cn(
                                  "mt-0.5 h-4 w-4 shrink-0 rounded-full border flex items-center justify-center",
                                  active
                                    ? "border-primary bg-primary/15"
                                    : "border-border/80"
                                )}
                              >
                                {active && (
                                  <CheckIcon className="h-3 w-3 text-primary stroke-[3]" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground">
                                  {opt.label}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  {opt.description}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-0.5">
                    Advanced models may take slightly longer & use the same credit cost.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </form>

      {/* Uploaded file indicator */}
      {fileName && (
        <div className="mt-2 flex items-center gap-2 text-xs text-primary font-medium">
          <UploadIcon className="h-3.5 w-3.5" />
          <span>Selected file: {fileName}</span>
          <AppButton
            type="button"
            variant="link"
            size="sm"
            onClick={() => {
              setFileName(null);
              setUrl("");
            }}
            className="text-muted-foreground hover:text-destructive underline ml-2 h-auto p-0 text-xs"
          >
            Remove
          </AppButton>
        </div>
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
        video · supports YouTube, Twitch, Rumble, Zoom, TikTok, Instagram
        &amp; Video files
      </p>
    </div>
  );
}
