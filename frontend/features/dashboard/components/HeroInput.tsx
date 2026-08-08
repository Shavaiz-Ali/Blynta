"use client";

import * as React from "react";
import { SourcePlatform, useCreateJob } from "@/features/jobs";
import { AppButton } from "@/components/common/AppButton";
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
} from "../icons";

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

interface HeroInputProps {
  onSuccess?: () => void;
}

export function HeroInput({ onSuccess }: HeroInputProps) {
  const [url, setUrl] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string>("youtube");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<string | undefined>();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { mutate, isPending, failureReason, reset } = useCreateJob({
    onSuccess: () => {
      setUrl("");
      setFileName(null);
      setFieldError(undefined);
      onSuccess?.();
    },
  });

  const detected = autoDetectSource(url);
  React.useEffect(() => {
    if (detected) {
      setSelectedId(detected.id);
    }
  }, [detected?.id]);

  const activeConfig =
    SUPPORTED_PLATFORMS.find((p) => p.id === selectedId) || SUPPORTED_PLATFORMS[0];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setUrl(`https://local-upload.blynta.com/${encodeURIComponent(file.name)}`);
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
    if (!sourceUrl.startsWith("http://") && !sourceUrl.startsWith("https://")) {
      sourceUrl = `https://${sourceUrl}`;
    }

    setFieldError(undefined);
    reset();
    mutate({
      sourceUrl,
      sourcePlatform: activeConfig.platform,
    });
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
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectedId(p.id);
                if (p.id === "upload" && !url) {
                  fileInputRef.current?.click();
                }
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer",
                isSelected
                  ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                  : "border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {p.icon}
              <span>{p.label}</span>
              {isAutoDetected && !isSelected && (
                <span className="text-[9px] font-bold uppercase px-1 rounded bg-chart-4/20 text-chart-4 leading-none">
                  Auto
                </span>
              )}
            </button>
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
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute right-2 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            title="Upload local video file"
          >
            <UploadIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </button>
        </div>

        <AppButton
          type="submit"
          size="lg"
          isLoading={isPending}
          disabled={submitDisabled}
          icon={!isPending ? <SparklesIcon className="h-4 w-4" /> : undefined}
          className="h-12 sm:h-14 px-6 sm:px-8 shrink-0 text-sm sm:text-base font-semibold shadow-md shadow-primary/15"
        >
          Get clips
        </AppButton>
      </form>

      {/* Uploaded file indicator */}
      {fileName && (
        <div className="mt-2 flex items-center gap-2 text-xs text-primary font-medium">
          <UploadIcon className="h-3.5 w-3.5" />
          <span>Selected file: {fileName}</span>
          <button
            type="button"
            onClick={() => {
              setFileName(null);
              setUrl("");
            }}
            className="text-muted-foreground hover:text-destructive underline ml-2 cursor-pointer"
          >
            Remove
          </button>
        </div>
      )}

      {/* Error message */}
      {(fieldError || platformError) && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
          {fieldError || platformError || "Something went wrong — please try again"}
        </p>
      )}

      {/* Credit note */}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CoinsIcon className="h-3.5 w-3.5 shrink-0" />
        Uses <span className="font-semibold text-foreground">1 credit</span> per video · supports YouTube, Twitch, Rumble, Zoom, TikTok, Instagram &amp; Video files
      </p>
    </div>
  );
}
