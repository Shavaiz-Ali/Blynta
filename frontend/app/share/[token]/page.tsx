"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePublicShare } from "@/features/shares/queries";
import { AppButton } from "@/components/common/AppButton";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { AppSpinner } from "@/components/common/AppSpinner";
import { BlyntaLogo } from "@/components/logo";
import { StudioVideoPlayer } from "@/features/jobs/components/player/StudioVideoPlayer";
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Copy,
  Sparkles,
  Subtitles,
} from "lucide-react";
import { toast } from "sonner";

export default function PublicSharePage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  const { data: share, isLoading, isError, error } = usePublicShare(token);
  const [copied, setCopied] = React.useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Share link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* Top Navigation */}
      <header className="border-b border-border/80 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center hover:opacity-90 transition-opacity"
            aria-label="Blynta Home"
          >
            <BlyntaLogo size="sm" />
          </Link>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />

            <AppButton
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              icon={
                copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )
              }
              className="h-8 text-xs"
            >
              {copied ? "Copied" : "Copy Link"}
            </AppButton>

            <Link href="/login">
              <AppButton
                size="sm"
                className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-xs"
              >
                Create Clips
              </AppButton>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <AppSpinner size="md" />
            <p className="text-sm font-medium">Loading shared clip...</p>
          </div>
        ) : isError || !share ? (
          <div className="max-w-md w-full bg-card border border-border/80 rounded-2xl p-8 text-center shadow-lg space-y-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-foreground">Clip Not Available</h2>
              <p className="text-sm text-muted-foreground">
                {error?.message || "This share link has expired or was removed by its owner."}
              </p>
            </div>
            <Link href="/" className="inline-block pt-2">
              <AppButton variant="outline">Back to Blynta</AppButton>
            </Link>
          </div>
        ) : (
          <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 md:gap-8 items-start">
            {/* Custom Video Player Stage */}
            <div className="flex justify-center w-full max-w-[320px] mx-auto md:mx-0">
              <StudioVideoPlayer
                src={share.signedUrl}
                poster={share.thumbnailUrl || undefined}
                autoPlay={false}
                badgeText="9:16 Short"
                hasTranscript={false}
                className="rounded-2xl border border-border shadow-xl"
              />
            </div>

            {/* Details & Metadata Card */}
            <div className="space-y-5 bg-card/60 border border-border/80 rounded-2xl p-6 backdrop-blur-sm shadow-xs">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    <Sparkles className="h-3 w-3" />
                    AI Generated Clip
                  </span>
                  {share.hasCaptions && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border/50">
                      <Subtitles className="h-3 w-3" />
                      Captions
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  {share.videoTitle || "Shared Video Clip"}
                </h1>
              </div>

              {/* Video Attributes */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-[11px] text-muted-foreground">Duration</div>
                    <div className="text-xs font-semibold text-foreground">
                      {share.durationSec} seconds
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-[11px] text-muted-foreground">Expires</div>
                    <div className="text-xs font-semibold text-foreground">
                      {share.expiresAt
                        ? new Date(share.expiresAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "Never"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Call to action */}
              <div className="rounded-xl bg-muted/50 border border-border/70 p-4 space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Want to create clips like this?
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Blynta turns long YouTube videos, podcasts, and streams into viral short-form clips automatically with AI.
                  </p>
                </div>
                <Link href="/login" className="block">
                  <AppButton className="w-full text-xs font-semibold">
                    Try Blynta for Free
                  </AppButton>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Blynta. All rights reserved.</p>
      </footer>
    </div>
  );
}
