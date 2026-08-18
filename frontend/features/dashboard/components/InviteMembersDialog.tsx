"use client";

import * as React from "react";
import { toast } from "sonner";
import { AppDialog } from "@/components/common/AppDialog";
import { AppButton } from "@/components/common/AppButton";
import { AppInput } from "@/components/common/AppInput";
import { UserPlusIcon, CheckCircleIcon } from "../icons";
import { useCurrentUser } from "@/features/auth";

export interface InviteMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMembersDialog({ open, onOpenChange }: InviteMembersDialogProps) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"member" | "admin">("member");
  const [copied, setCopied] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const { data: profile } = useCurrentUser();

  console.log(profile)


  function handleSendInvite(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email.trim()) return;
    setSent(true);
    toast.success(`Invitation sent to ${email.trim()}!`);
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
    toast.success("Workspace invite link copied to clipboard!");
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

        <AppInput
          label="InviteLink"
          placeholder="Copy invite link"
          value={profile ? `${process.env.NEXT_PUBLIC_API_URL}/${profile.referralCode}` : ""}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />


        {/* <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">Role</label>
          <div className="grid grid-cols-2 gap-2">
            <AppButton
              type="button"
              variant={role === "member" ? "default" : "outline"}
              onClick={() => setRole("member")}
              className={`h-auto p-3 rounded-xl border text-left flex-col items-start justify-start font-normal transition-all ${
                role === "member"
                  ? "border-primary bg-primary/10 text-foreground hover:bg-primary/15"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
              }`}
            >
              <p className="text-xs font-bold">Member</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-normal">
                Can create and edit clips
              </p>
            </AppButton>

            <AppButton
              type="button"
              variant={role === "admin" ? "default" : "outline"}
              onClick={() => setRole("admin")}
              className={`h-auto p-3 rounded-xl border text-left flex-col items-start justify-start font-normal transition-all ${
                role === "admin"
                  ? "border-primary bg-primary/10 text-foreground hover:bg-primary/15"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
              }`}
            >
              <p className="text-xs font-bold">Admin</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-normal">
                Full billing and workspace access
              </p>
            </AppButton>
          </div>
        </div> */}
      </form>
    </AppDialog>
  );
}
