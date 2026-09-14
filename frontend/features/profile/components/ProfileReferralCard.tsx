"use client";

import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AppButton } from "@/components/common/AppButton";
import { AppInput } from "@/components/common/AppInput";
import { GiftIcon, CopyIcon, CheckCircleIcon } from "@/features/dashboard/icons";
import { useReferralStats, useSendReferralInvite } from "@/features/auth";

/** Keep in sync with backend/src/users/referral.constants.ts */
const CREDITS_PER_INVITE = 5;
const BONUS_FOR_INVITED = 3;
const MAX_REFERRALS = 10;

export function ProfileReferralCard() {
  const { data: stats, isLoading } = useReferralStats();
  const [email, setEmail] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const sendMut = useSendReferralInvite({
    onSuccess: () => { toast.success(`Invite sent to ${email.trim()}!`); setEmail(""); },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to send invite."),
  });

  const code = stats?.referralCode ?? "";
  const sent = stats?.successfulReferralCount ?? 0;
  const max = stats?.maxReferrals ?? MAX_REFERRALS;
  const earned = stats?.totalCreditsEarned ?? 0;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = code ? `${origin}/signup?ref=${code}` : "";
  const pct = Math.min(100, Math.round((sent / max) * 100));

  function copy() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10">
            <GiftIcon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Referral Rewards</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Earn credits by inviting fellow creators
            </p>
          </div>
        </div>
        <Badge className="text-[10px] h-5 px-2 font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 shrink-0">
          +{CREDITS_PER_INVITE} credits / invite
        </Badge>
      </div>

      <div className="px-6 pb-5 space-y-4">
        {/* How it works */}
        <div className="rounded-lg bg-primary/5 border border-primary/15 px-4 py-3 flex items-start gap-3">
          <GiftIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Invite a creator → they get{" "}
            <strong className="text-foreground">{BONUS_FOR_INVITED} bonus credits</strong> on sign-up.
            You earn <strong className="text-foreground">{CREDITS_PER_INVITE} credits</strong> once they verify their email.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/40 border border-border/50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">Earned</p>
            {isLoading ? <div className="h-6 w-8 bg-muted rounded animate-pulse" /> : (
              <p className="text-xl font-bold text-foreground tabular-nums">+{earned}</p>
            )}
            <p className="text-[11px] text-muted-foreground">credits</p>
          </div>
          <div className="rounded-lg bg-muted/40 border border-border/50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">Invites</p>
            {isLoading ? <div className="h-6 w-8 bg-muted rounded animate-pulse" /> : (
              <p className="text-xl font-bold text-foreground tabular-nums">{sent}<span className="text-xs font-normal text-muted-foreground">/{max}</span></p>
            )}
            <p className="text-[11px] text-muted-foreground">successful</p>
          </div>
          <div className="rounded-lg bg-muted/40 border border-border/50 px-4 py-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Progress</p>
            <Progress value={pct} className="h-1.5" />
            <p className="text-[11px] text-muted-foreground">{pct}% of cap</p>
          </div>
        </div>

        {/* Link */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Your Referral Link</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={isLoading ? "Loading..." : link || "Generating…"}
              className="flex-1 h-9 rounded-lg border border-border/70 bg-muted/40 px-3 text-xs text-muted-foreground font-mono select-all focus:outline-none"
            />
            <AppButton
              size="sm"
              variant="outline"
              onClick={copy}
              disabled={!link || isLoading}
              icon={copied ? <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" /> : <CopyIcon className="h-3.5 w-3.5" />}
              className="h-9 shrink-0 text-xs"
            >
              {copied ? "Copied!" : "Copy"}
            </AppButton>
          </div>
        </div>

        {/* Direct invite */}
        <form onSubmit={(e) => { e.preventDefault(); const t = email.trim(); if (t) sendMut.mutate(t); }} className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Send a Direct Email Invite</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <AppInput
              type="email"
              placeholder="creator@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 text-xs"
            />
            <AppButton
              type="submit"
              size="sm"
              isLoading={sendMut.isPending}
              disabled={!email.trim() || sendMut.isPending}
              className="h-9 px-5 text-xs font-semibold shrink-0"
            >
              Send Invite
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  );
}
