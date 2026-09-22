"use client";

import * as React from "react";
import Link from "next/link";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { useCurrentUser } from "@/features/auth/queries";
import { useUserPublications, useRetryPublication } from "../queries";
import { ClipPublication, PublicationStatus } from "../types";
import { AppCard } from "@/components/common/AppCard";
import { AppButton } from "@/components/common/AppButton";
import { AppTabs } from "@/components/common/AppTabs";
import { YouTubeIcon } from "@/features/dashboard/icons";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Search,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  Share2,
  Film,
  Lock,
  Globe,
  EyeOff,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                            Status Helper Badge                             */
/* -------------------------------------------------------------------------- */

function PublicationStatusBadge({ status }: { status: PublicationStatus }) {
  switch (status) {
    case "published":
      return (
        <Badge
          variant="outline"
          className="text-[11px] font-semibold tracking-wide bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 gap-1.5 py-0.5 px-2 rounded-md"
        >
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          Published
        </Badge>
      );
    case "uploading":
    case "processing":
      return (
        <Badge
          variant="outline"
          className="text-[11px] font-semibold tracking-wide bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 gap-1.5 py-0.5 px-2 rounded-md"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span className="capitalize">{status}</span>
        </Badge>
      );
    case "queued":
      return (
        <Badge
          variant="outline"
          className="text-[11px] font-semibold tracking-wide bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25 gap-1.5 py-0.5 px-2 rounded-md"
        >
          <Clock className="h-3 w-3 text-blue-500" />
          Queued
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="text-[11px] font-semibold tracking-wide bg-destructive/10 text-destructive border-destructive/25 gap-1.5 py-0.5 px-2 rounded-md"
        >
          <AlertTriangle className="h-3 w-3 text-destructive" />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}

function PrivacyBadge({ privacy }: { privacy?: string }) {
  switch (privacy) {
    case "public":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
          <Globe className="h-3 w-3" /> Public
        </span>
      );
    case "unlisted":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
          <EyeOff className="h-3 w-3" /> Unlisted
        </span>
      );
    case "private":
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
          <Lock className="h-3 w-3" /> Private
        </span>
      );
  }
}

/* -------------------------------------------------------------------------- */
/*                          Single Publication Card                           */
/* -------------------------------------------------------------------------- */

function PublicationCard({ pub }: { pub: ClipPublication }) {
  const retryMutation = useRetryPublication(pub.jobId, pub.clipId, {
    onSuccess: () => {
      toast.success("Publication re-queued for upload");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to retry publication");
    },
  });

  const formattedDate = pub.publishedAt
    ? new Date(pub.publishedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date(pub.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  const watchUrl =
    pub.externalUrl ||
    (pub.externalId ? `https://youtube.com/shorts/${pub.externalId}` : null);

  return (
    <AppCard
      className="rounded-lg border-border/70 bg-card hover:border-border/90 transition-all shadow-xs overflow-hidden"
      useDefaultClasses={false}
      contentClassName="p-4 sm:p-5 flex flex-col w-full space-y-3.5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
        {/* Left: Platform & Metadata */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="h-7 w-7 rounded-md bg-[#FF0000]/10 border border-[#FF0000]/20 flex items-center justify-center shrink-0">
            <YouTubeIcon className="h-3.5 w-3.5 text-[#FF0000]" />
          </div>
          <span className="text-xs font-semibold text-foreground">YouTube Shorts</span>
          <span className="text-border">•</span>
          <PrivacyBadge privacy={pub.privacyStatus} />
          <span className="text-border">•</span>
          <span className="text-[11px] text-muted-foreground">{formattedDate}</span>
        </div>

        {/* Right: Status */}
        <div className="flex items-center gap-2 shrink-0">
          <PublicationStatusBadge status={pub.status} />
        </div>
      </div>

      {/* Main info */}
      <div className="space-y-1">
        <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug">
          {pub.title}
        </h3>
        {pub.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {pub.description}
          </p>
        )}
      </div>

      {/* Tags if available */}
      {pub.tags && pub.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {pub.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-medium text-muted-foreground bg-muted/50 border border-border/30 px-1.5 py-0.5 rounded"
            >
              #{tag}
            </span>
          ))}
          {pub.tags.length > 5 && (
            <span className="text-[10px] text-muted-foreground">
              +{pub.tags.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Error message if failed */}
      {pub.status === "failed" && pub.error && (
        <div className="rounded-md border border-destructive/25 bg-destructive/5 p-2.5 text-xs text-destructive flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{pub.error}</span>
        </div>
      )}

      {/* Card actions footer */}
      <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2">
          {pub.externalId && (
            <span className="font-mono text-[11px] text-muted-foreground">
              Video ID: {pub.externalId}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {pub.status === "failed" && (
            <AppButton
              variant="outline"
              size="sm"
              isLoading={retryMutation.isPending}
              onClick={() => retryMutation.mutate(pub._id)}
              icon={<RotateCcw className="h-3 w-3" />}
              className="rounded-lg h-7 text-xs font-semibold"
            >
              Retry
            </AppButton>
          )}

          {pub.status === "published" && watchUrl && (
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-border/80 bg-background hover:bg-muted text-foreground transition-colors shadow-2xs"
            >
              Watch on YouTube
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          )}
        </div>
      </div>
    </AppCard>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Main Page Component                             */
/* -------------------------------------------------------------------------- */

export function PublicationsPage() {
  const { data: profile } = useCurrentUser();
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState<string>("");

  const {
    data: response,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useUserPublications({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search.trim() ? search.trim() : undefined,
  });

  const publications = response?.publications || [];
  const total = response?.total || 0;

  const headerContent = (
    <div className="flex items-center justify-between w-full">
      <h1 className="text-sm font-semibold text-foreground">Publications</h1>
      {profile && <DashboardHeaderRight profile={profile} />}
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent}>
      <div className="w-full space-y-6 pb-16">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Publications
            </h1>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              Track and manage clips published across your connected social platforms.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/my-clips">
              <AppButton
                variant="outline"
                size="sm"
                icon={<Film className="h-3.5 w-3.5" />}
                className="rounded-lg h-8 text-xs font-semibold"
              >
                My Clips
              </AppButton>
            </Link>
            <Link href="/social-accounts">
              <AppButton
                variant="outline"
                size="sm"
                icon={<Share2 className="h-3.5 w-3.5" />}
                className="rounded-lg h-8 text-xs font-semibold"
              >
                Social Accounts
              </AppButton>
            </Link>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          {/* Status Tabs */}
          <AppTabs
            value={statusFilter}
            onValueChange={setStatusFilter}
            size="sm"
            tabs={[
              { value: "all", label: "All" },
              { value: "published", label: "Published" },
              { value: "uploading", label: "In Progress" },
              { value: "failed", label: "Failed" },
            ]}
          />

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search publications..."
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-border/70 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <AppCard
                key={i}
                className="rounded-lg border-border/70 p-5 space-y-3 animate-pulse"
                useDefaultClasses={false}
                contentClassName="p-0 flex flex-col w-full space-y-3"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-5 w-20 bg-muted rounded" />
                </div>
                <div className="h-5 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </AppCard>
            ))}
          </div>
        ) : isError ? (
          <AppCard
            className="rounded-lg border-destructive/30 bg-destructive/5 p-6 text-center"
            useDefaultClasses={false}
            contentClassName="p-0 flex flex-col items-center justify-center space-y-3 w-full"
          >
            <div className="p-2.5 rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Failed to load publications
            </p>
            <p className="text-xs text-muted-foreground max-w-sm">
              An error occurred while fetching your publications. Please check your connection and try again.
            </p>
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="rounded-lg text-xs"
            >
              Retry
            </AppButton>
          </AppCard>
        ) : publications.length === 0 ? (
          <AppCard
            className="rounded-lg border-border/70 bg-card p-10 sm:p-14 text-center"
            useDefaultClasses={false}
            contentClassName="p-0 flex flex-col items-center justify-center space-y-4 w-full"
          >
            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                No publications found
              </h3>
              <p className="text-xs text-muted-foreground max-w-md">
                {search || statusFilter !== "all"
                  ? "No publications matched your current filter. Try resetting search or filter options."
                  : "You haven't published any clips yet. Select a generated clip from My Clips and publish directly to YouTube Shorts."}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Link href="/my-clips">
                <AppButton
                  variant="default"
                  size="sm"
                  icon={<Film className="h-3.5 w-3.5" />}
                  className="rounded-lg h-8 text-xs font-semibold shadow-xs"
                >
                  Browse My Clips
                </AppButton>
              </Link>
              <Link href="/social-accounts">
                <AppButton
                  variant="outline"
                  size="sm"
                  icon={<Share2 className="h-3.5 w-3.5" />}
                  className="rounded-lg h-8 text-xs font-semibold"
                >
                  Connect Social Accounts
                </AppButton>
              </Link>
            </div>
          </AppCard>
        ) : (
          <div className="space-y-3.5">
            {publications.map((pub) => (
              <PublicationCard key={pub._id} pub={pub} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
