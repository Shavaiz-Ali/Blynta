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
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const currentDisplayUrl = React.useMemo(() => {
    if (recentlyCreatedUrl) return recentlyCreatedUrl;
    return null;
  }, [recentlyCreatedUrl]);

  const viewCountLabel = React.useMemo(() => {
    if (!activeShare) return "";
    const count = activeShare.accessCount;
    return `${count} ${count === 1 ? "view" : "views"}`;
  }, [activeShare]);

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
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4 space-y-3">
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

              {currentDisplayUrl ? (
                <div className="flex items-center gap-2">
                  <AppInput
                    readOnly
                    value={currentDisplayUrl}
                    size="sm"
                    className="font-mono text-xs select-all bg-background"
                    wrapperClassName="flex-1"
                  />
                  <AppButton
                    size="sm"
                    className="h-8 gap-1.5 shrink-0"
                    icon={copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    onClick={() => handleCopy(currentDisplayUrl)}
                  >
                    {copied ? "Copied" : "Copy"}
                  </AppButton>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  A public link is currently active for this clip. You can revoke this link or create a new one at any time.
                </p>
              )}

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

            {!currentDisplayUrl && (
              <AppButton
                variant="outline"
                size="sm"
                className="w-full text-xs"
                isLoading={createShareMutation.isPending}
                onClick={handleCreate}
              >
                Create New Link
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
