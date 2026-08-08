"use client";

import * as React from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { AppButton } from "@/components/common/AppButton";
import { AppInput } from "@/components/common/AppInput";
import { UserPlusIcon, CheckCircleIcon } from "../icons";

export interface InviteMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMembersDialog({ open, onOpenChange }: InviteMembersDialogProps) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"member" | "admin">("member");
  const [copied, setCopied] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  function handleSendInvite(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email.trim()) return;
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setEmail("");
      onOpenChange(false);
    }, 1500);
  }

  function handleCopyLink() {
    const inviteLink = `${window.location.origin}/signup?invite=team_blynta_workspace`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Invite Team Members"
      description="Collaborate with your team on video clips, templates, and social publishing."
      footer={
        <div className="flex w-full justify-between items-center gap-2">
          <AppButton
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            icon={copied ? <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" /> : undefined}
          >
            {copied ? "Link Copied!" : "Copy Invite Link"}
          </AppButton>
          <AppButton
            size="sm"
            onClick={handleSendInvite}
            disabled={!email.trim() || sent}
            icon={<UserPlusIcon className="h-3.5 w-3.5" />}
          >
            {sent ? "Sent!" : "Send Invite"}
          </AppButton>
        </div>
      }
    >
      <form onSubmit={handleSendInvite} className="flex flex-col gap-4 py-2">
        <AppInput
          label="Email Address"
          placeholder="colleague@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">Role</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole("member")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                role === "member"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
              }`}
            >
              <p className="text-xs font-bold">Member</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Can create and edit clips
              </p>
            </button>

            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                role === "admin"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
              }`}
            >
              <p className="text-xs font-bold">Admin</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Full billing and workspace access
              </p>
            </button>
          </div>
        </div>
      </form>
    </AppDialog>
  );
}
