"use client";

import * as React from "react";
import { toast } from "sonner";
import { AppDialog } from "@/components/common/AppDialog";
import { AppButton } from "@/components/common/AppButton";
import { AppInput } from "@/components/common/AppInput";
import { AppSpinner } from "@/components/common/AppSpinner";
import { UserPlusIcon, CheckCircleIcon, CopyIcon, GiftIcon } from "../icons";
import { useCurrentUser, useSendReferralInvite } from "@/features/auth";

export interface InviteMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMembersDialog({ open, onOpenChange }: InviteMembersDialogProps) {
  const [email, setEmail] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const { data: profile, isLoading: isProfileLoading } = useCurrentUser();

  const sendInviteMutation = useSendReferralInvite({
    onSuccess: () => {
      toast.success(`Invitation email sent to ${email.trim()}!`);
      setEmail("");
      onOpenChange(false);
    },
    onError: (err: any) => {
      const message = err?.message || "Failed to send invitation. Please try again.";
      toast.error(message);
    },
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = profile?.referralCode
    ? `${origin}/signup?ref=${profile.referralCode}`
    : "";

  const isLinkLoading = isProfileLoading || !referralLink;

  function handleSendInvite(e?: React.FormEvent) {
    e?.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail) return;

    sendInviteMutation.mutate(targetEmail);
  }

  function handleCopyLink() {
    if (isLinkLoading || !referralLink) {
      toast.error("Generating your referral link. Please wait a moment...");
      return;
    }
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral invite link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Invite & Earn Bonus Credits"
      description="Invite fellow creators to Blynta and earn extra video generation credits."
      footer={
        <div className="flex w-full justify-between items-center gap-2">
          <AppButton
            variant="outline"
            size="sm"
            type="button"
            onClick={handleCopyLink}
            disabled={isLinkLoading}
            icon={
              isLinkLoading ? (
                <AppSpinner size="xs" />
              ) : copied ? (
                <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5 text-muted-foreground" />
              )
            }
          >
            {isLinkLoading ? "Loading link..." : copied ? "Link Copied!" : "Copy Link"}
          </AppButton>
          <AppButton
            size="sm"
            type="button"
            onClick={handleSendInvite}
            isLoading={sendInviteMutation.isPending}
            disabled={!email.trim() || sendInviteMutation.isPending}
            icon={<UserPlusIcon className="h-3.5 w-3.5" />}
          >
            Send Invite
          </AppButton>
        </div>
      }
    >
      <form onSubmit={handleSendInvite} className="flex flex-col gap-4 py-2">
        {/* ── Bonus Credits Banner ── */}
        <div className="flex items-start gap-3 rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs">
          <GiftIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">
              Give 2 credits, get 3 credits
            </p>
            <p className="text-muted-foreground leading-relaxed">
              When someone signs up using your link, you'll earn <strong>3 bonus credits</strong> and they'll get <strong>2 bonus credits</strong> to create clips.
            </p>
          </div>
        </div>

        {/* ── Email Invite Input ── */}
        <AppInput
          label="Send an email invite"
          placeholder="colleague@company.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />

        {/* ── Shareable Invite Link ── */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Or share your invite link
          </label>
          <div className="flex items-center gap-2 relative">
            {isLinkLoading ? (
              <div className="flex-1 flex items-center gap-2 h-9 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground animate-pulse">
                <AppSpinner size="xs" />
                <span>Generating your referral link...</span>
              </div>
            ) : (
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground font-mono focus:outline-hidden select-all"
              />
            )}
            <AppButton
              type="button"
              variant="secondary"
              size="icon"
              onClick={handleCopyLink}
              disabled={isLinkLoading}
              className="shrink-0 absolute z-10 top-1/2 -translate-y-1/2 right-3 h-7 w-7 flex justify-center items-center"
            >
              {isLinkLoading ? <AppSpinner size="xs" /> : copied ? <CheckCircleIcon className="mt-0.5  text-emerald-500" /> : <CopyIcon className="mt-0.5" />}
            </AppButton>
          </div>
        </div>
      </form>
    </AppDialog>
  );
}
