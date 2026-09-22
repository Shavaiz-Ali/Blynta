"use client";

import * as React from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { AppButton } from "@/components/common/AppButton";
import { AppInput } from "@/components/common/AppInput";
import { AppSelect, AppSelectOption } from "@/components/common/AppSelect";
import {
  Check,
  Copy,
  Globe,
  Lock,
  Trash2,
  Calendar,
  Eye,
} from "lucide-react";
import {
  useShares,
  useCreateShare,
  useRevokeShare,
} from "../queries";
import { ShareView } from "../types";
import { toast } from "sonner";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  clipId: string;
  clipTitle?: string;
}

const EXPIRY_OPTIONS: AppSelectOption[] = [
  { value: "1d", label: "1 day", description: "Link valid for 24 hours" },
  { value: "7d", label: "7 days", description: "Link valid for 1 week" },
  { value: "30d", label: "30 days", description: "Link valid for 1 month" },
];

export function ShareDialog({
  open,
  onOpenChange,
  jobId,
  clipId,
  clipTitle,
}: ShareDialogProps) {
  const [expiryOption, setExpiryOption] = React.useState<string>("7d");
  const [copied, setCopied] = React.useState(false);
  const [recentlyCreatedUrl, setRecentlyCreatedUrl] = React.useState<string | null>(null);

  // Fetch any existing shares for this clip
  const {
    data: shares,
    isLoading: isSharesLoading,
  } = useShares(open ? clipId : undefined);

  const activeShare: ShareView | undefined = React.useMemo(() => {
    if (!shares || shares.length === 0) return undefined;
    return shares.find((s) => s.isActive && !s.revokedAt);
  }, [shares]);

  const createShareMutation = useCreateShare({
    onSuccess: (data) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const shareUrl = `${origin}/share/${data.token}`;
      setRecentlyCreatedUrl(shareUrl);
      toast.success("Share link created!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create share link");
    },
  });

  const revokeShareMutation = useRevokeShare({
    onSuccess: () => {
      setRecentlyCreatedUrl(null);
      toast.success("Share link revoked");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to revoke share link");
    },
  });

  const handleCreate = () => {
    let expiresAt: string | null = null;
    const now = new Date();
    if (expiryOption === "1d") {
      now.setDate(now.getDate() + 1);
      expiresAt = now.toISOString();
    } else if (expiryOption === "7d") {
      now.setDate(now.getDate() + 7);
      expiresAt = now.toISOString();
    } else if (expiryOption === "30d") {
      now.setDate(now.getDate() + 30);
      expiresAt = now.toISOString();
    }

    createShareMutation.mutate({
      jobId,
      clipId,
      expiresAt,
    });
  };

  const handleCopy = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const currentDisplayUrl = React.useMemo(() => {
    if (recentlyCreatedUrl) return recentlyCreatedUrl;
    if (activeShare?.token) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return `${origin}/share/${activeShare.token}`;
    }
    return null;
  }, [recentlyCreatedUrl, activeShare]);

  const viewCountLabel = React.useMemo(() => {
    if (!activeShare) return "";
    const count = activeShare.accessCount;
    return `${count} ${count === 1 ? "view" : "views"}`;
  }, [activeShare]);

  const shareText = clipTitle ? `Check out "${clipTitle}" on Blynta` : "Check out this clip on Blynta";

  const handleSocialShare = (platform: "whatsapp" | "twitter" | "linkedin" | "telegram" | "reddit" | "email" | "native") => {
    if (!currentDisplayUrl) return;

    const encodedUrl = encodeURIComponent(currentDisplayUrl);
    const encodedText = encodeURIComponent(shareText);

    switch (platform) {
      case "whatsapp":
        window.open(`https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`, "_blank", "noopener,noreferrer");
        break;
      case "twitter":
        window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`, "_blank", "noopener,noreferrer");
        break;
      case "linkedin":
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, "_blank", "noopener,noreferrer");
        break;
      case "telegram":
        window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, "_blank", "noopener,noreferrer");
        break;
      case "reddit":
        window.open(`https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`, "_blank", "noopener,noreferrer");
        break;
      case "email":
        window.open(`mailto:?subject=${encodedText}&body=${encodedText}%0A%0A${encodedUrl}`);
        break;
      case "native":
        if (navigator.share) {
          navigator.share({
            title: clipTitle || "Blynta Clip",
            text: shareText,
            url: currentDisplayUrl,
          }).catch(() => { });
        } else {
          handleCopy(currentDisplayUrl);
        }
        break;
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Share Clip"
      description={
        clipTitle
          ? `Create a public link for "${clipTitle}". Anyone with the link can view this clip.`
          : "Create a public link for this clip. Anyone with the link can view this clip."
      }
      size="md"
    >
      <div className="space-y-4 pt-1">
        {isSharesLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <span className="text-xs">Checking share status...</span>
          </div>
        ) : activeShare ? (
          /* Active Share State */
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-4">
              {/* Header Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    ACTIVE SHARE LINK
                  </span>
                </div>
                <AppButton
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive px-2"
                  isLoading={revokeShareMutation.isPending}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() =>
                    revokeShareMutation.mutate({
                      shareId: activeShare.id,
                      clipId,
                    })
                  }
                >
                  Revoke Link
                </AppButton>
              </div>

              {/* Copy URL Input Box */}
              {currentDisplayUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AppInput
                      readOnly
                      value={currentDisplayUrl}
                      size="sm"
                      className="font-mono text-xs select-all bg-background border-border/80 text-foreground"
                      wrapperClassName="flex-1"
                    />
                    <AppButton
                      size="sm"
                      variant={copied ? "outline" : "primary" as any}
                      className={`h-9 gap-1.5 shrink-0 px-3 font-medium transition-all ${copied ? "border-emerald-500/50 text-emerald-500 bg-emerald-500/10" : ""
                        }`}
                      icon={copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      onClick={() => handleCopy(currentDisplayUrl)}
                    >
                      {copied ? "Copied!" : "Copy Link"}
                    </AppButton>
                  </div>

                  {/* Social Sharing Options */}
                  <div className="pt-2 border-t border-border/50">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                      Share Directly
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {/* WhatsApp */}
                      <button
                        type="button"
                        onClick={() => handleSocialShare("whatsapp")}
                        className="flex flex-col items-center justify-center p-2 rounded-lg border border-border/60 bg-background/80 hover:bg-[#25D366]/10 hover:border-[#25D366]/40 text-muted-foreground hover:text-[#25D366] transition-all group cursor-pointer"
                        title="Share to WhatsApp"
                      >
                        <svg className="h-4 w-4 fill-current mb-1 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.062-2.115-.527-1.748-.724-2.883-2.496-2.97-2.612-.088-.116-.708-.941-.708-1.796 0-.855.449-1.277.61-1.45.161-.173.351-.217.468-.217.117 0 .234 0 .337.006.107.005.25.04.39.377.144.348.49 1.198.533 1.286.044.088.073.191.015.306-.059.116-.088.188-.176.291-.088.102-.185.228-.264.306-.088.087-.18.182-.078.357.102.175.454.748.974 1.211.669.596 1.233.78 1.408.868.175.088.278.073.38-.044.103-.117.439-.51.557-.686.117-.175.234-.146.39-.088.156.059.995.469 1.166.555.171.086.286.128.328.2.042.072.042.417-.102.822zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.66 1.434 5.176L2 22l4.956-1.396A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                        </svg>
                        <span className="text-[10px] font-medium">WhatsApp</span>
                      </button>

                      {/* X (Twitter) */}
                      <button
                        type="button"
                        onClick={() => handleSocialShare("twitter")}
                        className="flex flex-col items-center justify-center p-2 rounded-lg border border-border/60 bg-background/80 hover:bg-foreground/10 hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-all group cursor-pointer"
                        title="Share to X (Twitter)"
                      >
                        <svg className="h-4 w-4 fill-current mb-1 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        <span className="text-[10px] font-medium">X / Twitter</span>
                      </button>

                      {/* Telegram */}
                      <button
                        type="button"
                        onClick={() => handleSocialShare("telegram")}
                        className="flex flex-col items-center justify-center p-2 rounded-lg border border-border/60 bg-background/80 hover:bg-[#229ED9]/10 hover:border-[#229ED9]/40 text-muted-foreground hover:text-[#229ED9] transition-all group cursor-pointer"
                        title="Share to Telegram"
                      >
                        <svg className="h-4 w-4 fill-current mb-1 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                        </svg>
                        <span className="text-[10px] font-medium">Telegram</span>
                      </button>

                      {/* Reddit */}
                      <button
                        type="button"
                        onClick={() => handleSocialShare("reddit")}
                        className="flex flex-col items-center justify-center p-2 rounded-lg border border-border/60 bg-background/80 hover:bg-[#FF4500]/10 hover:border-[#FF4500]/40 text-muted-foreground hover:text-[#FF4500] transition-all group cursor-pointer"
                        title="Share to Reddit"
                      >
                        <svg className="h-4 w-4 fill-current mb-1 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
                        </svg>
                        <span className="text-[10px] font-medium">Reddit</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    A public link is currently active for this clip. Create a new link to refresh the public URL.
                  </p>
                  <AppButton
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    isLoading={createShareMutation.isPending}
                    onClick={handleCreate}
                  >
                    Create New Link
                  </AppButton>
                </div>
              )}

              {/* View Count and Expiration Stats */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{viewCountLabel}</span>
                </div>
                {activeShare.expiresAt && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      Expires{" "}
                      {new Date(activeShare.expiresAt).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric", year: "numeric" }
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {currentDisplayUrl && (
              <AppButton
                variant="outline"
                size="sm"
                className="w-full text-xs"
                isLoading={createShareMutation.isPending}
                onClick={handleCreate}
              >
                Create New Link (Regenerate)
              </AppButton>
            )}
          </div>
        ) : (
          /* Create New Share State */
          <div className="space-y-4">
            <AppSelect
              label="Link expiration"
              value={expiryOption}
              onValueChange={setExpiryOption}
              options={EXPIRY_OPTIONS}
              size="sm"
            />

            <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Lock className="h-3.5 w-3.5 text-primary" />
                <span>Security & Access</span>
              </div>
              <p className="leading-relaxed">
                Anyone with the link can view this clip without signing in. Your original video remains securely protected.
              </p>
            </div>

            <AppButton
              className="w-full"
              isLoading={createShareMutation.isPending}
              icon={<Globe className="h-4 w-4" />}
              onClick={handleCreate}
            >
              Create Share Link
            </AppButton>
          </div>
        )}
      </div>
    </AppDialog>
  );
}

