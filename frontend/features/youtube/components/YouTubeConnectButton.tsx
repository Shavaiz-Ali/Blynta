"use client";

import { AppButton, type AppButtonProps } from "@/components/common/AppButton";
import { useYouTubeStatus, useConnectYouTube, useDisconnectYouTube } from "../queries";
import { CheckCircle2, LogOut } from "lucide-react";
import { YouTubeIcon } from "@/features/dashboard/icons";
import { toast } from "sonner";

export interface YouTubeConnectButtonProps {
  className?: string;
  variant?: AppButtonProps["variant"];
  size?: AppButtonProps["size"];
}

export function YouTubeConnectButton({
  className,
  variant = "outline",
  size = "sm",
}: YouTubeConnectButtonProps) {
  const { data: status, isLoading } = useYouTubeStatus();

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

  const disconnectMutation = useDisconnectYouTube({
    onSuccess: () => {
      toast.success("YouTube channel disconnected");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to disconnect YouTube");
    },
  });

  if (isLoading) {
    return (
      <AppButton
        variant={variant}
        size={size}
        isLoading
        disabled
        className={className}
      >
        <YouTubeIcon className="h-4 w-4 mr-1.5" />
        YouTube
      </AppButton>
    );
  }

  if (status?.connected) {
    return (
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{status.channel?.title || "YouTube Connected"}</span>
        </div>
        <AppButton
          variant="ghost"
          size="sm"
          onClick={() => disconnectMutation.mutate()}
          isLoading={disconnectMutation.isPending}
          title="Disconnect YouTube channel"
          className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
        >
          <LogOut className="h-3.5 w-3.5" />
        </AppButton>
      </div>
    );
  }

  return (
    <AppButton
      variant={variant}
      size={size}
      onClick={() => connectMutation.mutate()}
      isLoading={connectMutation.isPending}
      className={className}
    >
      <YouTubeIcon className="h-4 w-4 mr-1.5" />
      Connect YouTube
    </AppButton>
  );
}
