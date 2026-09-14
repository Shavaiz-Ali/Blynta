"use client";

import * as React from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AppButton } from "@/components/common/AppButton";
import { AppInput } from "@/components/common/AppInput";
import { AppSpinner } from "@/components/common/AppSpinner";
import { cn } from "@/lib/utils";
import { useUpdateProfile, useUploadAvatar } from "@/features/auth";
import type { UserProfile } from "@/features/auth/types";
import { CameraIcon, PencilIcon, ClockIcon, ZapIcon } from "@/features/dashboard/icons";

/* ── helpers ── */
function getInitials(name?: string | null, email?: string | null) {
  return (name || email || "?")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}
function formatMemberDate(d?: string | null) {
  if (!d) return "Recently";
  try { return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
  catch { return "Recently"; }
}

export function ProfileIdentityCard({ profile }: { profile: UserProfile }) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(profile.name || "");
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => { setName(profile.name || ""); }, [profile.name]);

  const updateMut = useUpdateProfile({
    onSuccess: () => { toast.success("Name updated!"); setEditing(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to update name."),
  });
  const avatarMut = useUploadAvatar({
    onSuccess: () => toast.success("Avatar updated!"),
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to upload avatar."),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      toast.error("JPEG, PNG or WebP only."); return;
    }
    if (f.size > 5 * 1024 * 1024) { toast.error("Max 5 MB."); return; }
    avatarMut.mutate(f);
    e.target.value = "";
  }

  const planLabel = (profile.plan ?? "free").toLowerCase();
  const isPro = planLabel === "pro" || planLabel === "business";
  const initials = getInitials(profile.name, profile.email);

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
      {/* gradient accent bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

      <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        {/* ── Avatar ── */}
        <div className="relative group shrink-0">
          <Avatar className="h-20 w-20 rounded-2xl border-2 border-border/70 shadow-sm bg-muted overflow-hidden">
            {profile.avatarUrl && (
              <AvatarImage src={profile.avatarUrl} alt={profile.name || "Avatar"} className="object-cover" />
            )}
            <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary rounded-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          {avatarMut.isPending && (
            <div className="absolute inset-0 rounded-2xl bg-background/70 backdrop-blur-xs flex items-center justify-center z-20">
              <AppSpinner size="sm" />
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={avatarMut.isPending}
            title="Change avatar"
            className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-lg bg-primary text-primary-foreground shadow-md ring-2 ring-background opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 hover:bg-primary/90 transition-all cursor-pointer"
          >
            <CameraIcon className="h-3 w-3" />
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="hidden" />
        </div>

        {/* ── Details ── */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Name */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">Full Name</p>
            {editing ? (
              <form
                onSubmit={(e) => { e.preventDefault(); const t = name.trim(); if (!t) { toast.error("Name cannot be empty."); return; } updateMut.mutate({ name: t }); }}
                className="flex items-center gap-2 max-w-xs"
              >
                <AppInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus disabled={updateMut.isPending} className="h-8 text-sm" />
                <AppButton size="sm" type="submit" isLoading={updateMut.isPending} className="h-8 px-3 text-xs shrink-0">Save</AppButton>
                <AppButton size="sm" variant="ghost" type="button" onClick={() => { setName(profile.name || ""); setEditing(false); }} disabled={updateMut.isPending} className="h-8 px-2 text-xs text-muted-foreground shrink-0">Cancel</AppButton>
              </form>
            ) : (
              <div className="flex items-center gap-2 group/n">
                <span className="text-lg font-bold text-foreground">{profile.name || "No name set"}</span>
                <button type="button" onClick={() => setEditing(true)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 opacity-0 group-hover/n:opacity-100 transition-all cursor-pointer">
                  <PencilIcon className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Email */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">Email Address</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-foreground font-mono">{profile.email}</span>
              <span className="text-[11px] text-muted-foreground/60 italic">(read-only)</span>
            </div>
          </div>

          {/* Plan badge + member since */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] px-2 h-5 font-bold uppercase tracking-wider flex items-center gap-1",
                isPro ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted text-muted-foreground"
              )}
            >
              {isPro && <ZapIcon className="h-2.5 w-2.5 fill-primary text-primary" />}
              {planLabel}
            </Badge>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <ClockIcon className="h-3 w-3 text-muted-foreground/50" />
              Member since {formatMemberDate(profile.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
