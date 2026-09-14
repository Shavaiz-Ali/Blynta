"use client";

import * as React from "react";
import { toast } from "sonner";
import { AppButton } from "@/components/common/AppButton";
import { AppInput } from "@/components/common/AppInput";
import { KeyRoundIcon, ShieldIcon, AlertTriangleIcon } from "@/features/dashboard/icons";
import { useChangePassword } from "@/features/auth";
import type { UserProfile } from "@/features/auth/types";

export function ProfileSecurityCard({ profile }: { profile: UserProfile }) {
  const linked = profile.linkedAccounts ?? [];
  const hasLocal = linked.some((a) => a.provider === "local") || linked.length === 0;

  const [cur, setCur] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  const mut = useChangePassword({
    onSuccess: () => {
      toast.success("Password changed!");
      setCur(""); setNext(""); setConfirm(""); setErr(null);
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.message || "Failed to change password.";
      setErr(msg); toast.error(msg);
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (!cur) { setErr("Current password is required."); return; }
    if (next.length < 8) { setErr("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setErr("Passwords do not match."); return; }
    mut.mutate({ currentPassword: cur, newPassword: next });
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
      <div className="px-6 pt-5 pb-4 flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-primary/10">
          <KeyRoundIcon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">Security &amp; Password</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Manage your credentials and login security</p>
        </div>
      </div>

      <div className="px-6 pb-5">
        {hasLocal ? (
          <form onSubmit={submit} className="space-y-3 max-w-md">
            {err && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                <AlertTriangleIcon className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive leading-snug">{err}</p>
              </div>
            )}
            <AppInput label="Current Password" type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Enter current password" required />
            <AppInput label="New Password" type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Minimum 8 characters" required />
            <AppInput label="Confirm New Password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" required />
            <AppButton type="submit" size="sm" isLoading={mut.isPending} disabled={!cur || !next || !confirm || mut.isPending} className="font-semibold">
              Update Password
            </AppButton>
          </form>
        ) : (
          <div className="flex items-start gap-3 rounded-xl bg-muted/50 border border-border/60 px-4 py-3.5">
            <ShieldIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground">Social authentication account</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                You signed in with Google or Facebook. Your authentication is managed by your provider — there is no local password to update.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
