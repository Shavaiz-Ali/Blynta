"use client";

import * as React from "react";
import Image from "next/image";
import { AppCard } from "@/components/common/AppCard";
import { AppButton } from "@/components/common/AppButton";
import { YouTubeIcon } from "@/features/dashboard/icons";
import {
  useYouTubeStatus,
  useConnectYouTube,
} from "../queries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Unlink,
  Plug,
  AlertTriangle,
  Lock,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export interface ConnectedYouTubeCardProps {
  onOpenDisconnect: () => void;
}

export function ConnectedYouTubeCard({ onOpenDisconnect }: ConnectedYouTubeCardProps) {
  const { data: status, isLoading, isError, refetch, isFetching } = useYouTubeStatus();

  const connectMutation = useConnectYouTube({
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to initiate YouTube connection");
    },
  });

  const isConnected = status?.connected;
  const channel = status?.channel;

  // 1. Loading Skeleton
  if (isLoading) {
    return (
      <AppCard
        className="rounded-lg border-border/70 overflow-hidden"
        useDefaultClasses={false}
        contentClassName="p-5 space-y-4 flex flex-col w-full animate-pulse"
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted" />
            <div className="space-y-1.5">
              <div className="h-4 w-28 bg-muted rounded-md" />
              <div className="h-3 w-20 bg-muted rounded-md" />
            </div>
          </div>
          <div className="h-6 w-20 bg-muted rounded-full" />
        </div>
        <div className="h-px bg-border/40 w-full" />
        <div className="flex items-center gap-4 w-full">
          <div className="h-12 w-12 rounded-full bg-muted shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-40 bg-muted rounded-md" />
            <div className="h-3 w-24 bg-muted rounded-md" />
          </div>
        </div>
      </AppCard>
    );
  }

  // 2. Error State
  if (isError) {
    return (
      <AppCard
        className="rounded-lg border-destructive/30 bg-destructive/5"
        useDefaultClasses={false}
        contentClassName="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-destructive/10 text-destructive shrink-0 mt-0.5">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Unable to load YouTube connection status
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              There was an issue communicating with the server. Please check your connection.
            </p>
          </div>
        </div>
        <AppButton
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          isLoading={isFetching}
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          className="rounded-lg h-8 text-xs shrink-0"
        >
          Try Again
        </AppButton>
      </AppCard>
    );
  }

  // 3. Connected Hero State
  if (isConnected && channel) {
    const channelUrl = `https://youtube.com/channel/${channel.id}`;

    return (
      <AppCard
        className="group relative rounded-lg border border-border/80 bg-card shadow-xs overflow-hidden transition-all flex flex-col pb-0"
        useDefaultClasses={false}
        contentClassName="p-0 flex flex-col w-full"
      >
        {/* Sleek tapered top accent glow & line */}
        <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#FF0000]/80 to-transparent pointer-events-none" />
        <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-[#FF0000]/8 to-transparent pointer-events-none" />

        {/* Top bar: Platform info & status */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-border/40 w-full">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#FF0000]/10 border border-[#FF0000]/20 flex items-center justify-center shrink-0">
              <YouTubeIcon className="h-4 w-4 text-[#FF0000]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">YouTube</span>
              <span className="text-[11px] font-medium text-muted-foreground">• Shorts Publishing</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Connected pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Connected
            </div>

            {/* Refresh status */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50 cursor-pointer"
                    aria-label="Refresh connection status"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin text-primary")} />
                  </button>
                }
              />
              <TooltipContent side="top" className="text-xs">
                Sync connection status
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Channel Details & Actions */}
        <div className="p-5 w-full space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Channel Identity */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative h-12 w-12 rounded-full overflow-hidden border border-border/80 bg-muted shrink-0 shadow-2xs">
                {channel.thumbnail ? (
                  <Image
                    src={channel.thumbnail}
                    alt={channel.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-[#FF0000]/10 text-[#FF0000]">
                    <YouTubeIcon className="h-5 w-5" />
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm sm:text-base font-bold text-foreground truncate">{channel.title}</h2>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <span className="font-mono text-[11px]">ID: {channel.id}</span>
                  <span className="text-border">•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                    Direct publishing enabled
                  </span>
                </div>
              </div>
            </div>

            {/* Action Group */}
            <div className="flex items-center gap-2 flex-wrap lg:shrink-0">
              <a
                href={channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border/80 bg-background/80 hover:bg-muted text-foreground transition-all shadow-2xs hover:shadow-xs"
              >
                View Channel
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>

              <AppButton
                variant="outline"
                size="sm"
                onClick={() => connectMutation.mutate()}
                isLoading={connectMutation.isPending}
                icon={<RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />}
                className="rounded-lg h-8 text-xs font-semibold"
                title="Re-authorize YouTube permissions or switch channel"
              >
                Reconnect
              </AppButton>

              <AppButton
                variant="ghost"
                size="sm"
                onClick={onOpenDisconnect}
                icon={<Unlink className="h-3.5 w-3.5" />}
                className="rounded-lg h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors font-medium"
              >
                Disconnect
              </AppButton>
            </div>
          </div>

          {/* Publishing Capabilities */}
          <div className="pt-3.5 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-4 w-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
              </div>
              <span className="text-foreground/90 font-medium text-[11px]">Upload Shorts directly</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-4 w-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
              </div>
              <span className="text-foreground/90 font-medium text-[11px]">Auto-sync metadata</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-4 w-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
              </div>
              <span className="text-foreground/90 font-medium text-[11px]">Privacy &amp; tags control</span>
            </div>
          </div>
        </div>

        {/* Security / Token Note */}
        <div className="px-5 py-2.5 bg-muted/30 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground w-full">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-muted-foreground/80" />
            <span>Encrypted OAuth 2.0 token active</span>
          </div>
          <span>Revocable anytime</span>
        </div>
      </AppCard>
    );
  }

  // 4. Disconnected State (Available to connect)
  return (
    <AppCard
      className="group relative rounded-lg border border-border/80 bg-card shadow-xs overflow-hidden"
      useDefaultClasses={false}
      contentClassName="p-5 sm:p-6 flex flex-col w-full"
    >
      {/* Sleek tapered top accent glow & line */}
      <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#FF0000]/80 to-transparent pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-[#FF0000]/8 to-transparent pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 w-full">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-lg bg-[#FF0000]/10 border border-[#FF0000]/20 flex items-center justify-center shrink-0 mt-0.5">
            <YouTubeIcon className="h-5 w-5 text-[#FF0000]" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-foreground">YouTube</h2>
              <Badge variant="outline" className="text-[10px] font-semibold tracking-wide uppercase px-2 h-4.5 bg-background rounded-md">
                Ready to connect
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              Connect your YouTube channel to publish vertical clips as Shorts with one click. Manage privacy settings, categories, and custom descriptions directly inside Blynta.
            </p>
            <div className="flex items-center gap-4 pt-1 text-[11px] text-muted-foreground font-medium flex-wrap">
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-emerald-500" /> Instant 1080p Shorts upload
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-emerald-500" /> Title &amp; description sync
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-emerald-500" /> Official Google OAuth 2.0
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <AppButton
            variant="default"
            size="default"
            isLoading={connectMutation.isPending}
            onClick={() => connectMutation.mutate()}
            icon={<Plug className="h-4 w-4" />}
            className="rounded-lg h-8 px-3.5 text-xs font-semibold shadow-xs"
          >
            Connect YouTube
          </AppButton>
        </div>
      </div>
    </AppCard>
  );
}
