"use client";

import * as React from "react";
import { PageContent } from "@/components/layout/PageContent";

import { useYouTubeStatus, useDisconnectYouTube } from "../queries";
import { toast } from "sonner";

import { ConnectedYouTubeCard } from "./ConnectedYouTubeCard";
import { UpcomingPlatformsSection } from "./UpcomingPlatformsCard";
import { SocialAccountsSecurityCard } from "./SocialAccountsSecurityCard";
import { DisconnectYouTubeDialog } from "./DisconnectYouTubeDialog";

export function SocialAccountsPage() {
  const { data: status } = useYouTubeStatus();
  const [disconnectModalOpen, setDisconnectModalOpen] = React.useState(false);

  const disconnectMutation = useDisconnectYouTube({
    onSuccess: () => {
      setDisconnectModalOpen(false);
      toast.success("YouTube channel disconnected successfully");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to disconnect YouTube");
    },
  });

  return (
    <PageContent>
      <div className="w-full space-y-6 pb-16">
        {/* ── Page Header ── */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Social Accounts
          </h1>
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            Connect your social platforms to publish your Blynta clips directly
            from one place.
          </p>
        </div>

        {/* ── Section: Connected Accounts / Available Channel Hero ── */}
        <div className="space-y-2.5 w-full">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Connected Accounts
          </h2>

          <ConnectedYouTubeCard
            onOpenDisconnect={() => setDisconnectModalOpen(true)}
          />
        </div>

        {/* ── Section: More Platforms ── */}
        <UpcomingPlatformsSection />

        {/* ── Section: Privacy & Security (Trust Card) ── */}
        <SocialAccountsSecurityCard />
      </div>

      {/* ── Disconnect Confirmation Dialog ── */}
      <DisconnectYouTubeDialog
        open={disconnectModalOpen}
        onOpenChange={setDisconnectModalOpen}
        channelTitle={status?.channel?.title}
        isPending={disconnectMutation.isPending}
        onConfirm={() => disconnectMutation.mutate()}
      />
    </PageContent>
  );
}
