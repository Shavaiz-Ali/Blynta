"use client";

import * as React from "react";
import { YouTubeIcon } from "@/features/dashboard/icons";
import { AppButton } from "@/components/common/AppButton";
import { Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { YouTubeChannelInfo } from "../types";

export interface YouTubeChannelHeaderProps {
  channel: YouTubeChannelInfo | null;
}

export function YouTubeChannelHeader({ channel }: YouTubeChannelHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        {channel?.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={channel.thumbnail}
            alt={channel.title ?? "Channel"}
            className="h-7 w-7 rounded-full object-cover border border-border shrink-0"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
            <YouTubeIcon className="h-3.5 w-3.5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground leading-none mb-0.5">
            Connected channel
          </p>
          <p className="text-xs font-semibold text-foreground truncate">
            {channel?.title || "Connected YouTube Channel"}
          </p>
        </div>
      </div>
      <AppButton
        variant="ghost"
        size="sm"
        className="h-7 text-[11px] text-muted-foreground hover:text-foreground hover:bg-card/10 px-2 shrink-0"
        onClick={() => router.push("/social-accounts")}
        icon={<Settings className="h-3 w-3" />}
      >
        Manage Accounts
      </AppButton>
    </div>
  );
}
