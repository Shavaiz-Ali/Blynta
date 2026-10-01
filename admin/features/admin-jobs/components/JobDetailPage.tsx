"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Film,
  Layers,
  RotateCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminJobDetailQuery, useRetryJobMutation } from "../queries";
import type { AdminJobItem, JobStatus, SourcePlatform } from "../types";
import { AppButton, AppLinkButton } from "@/components/common/AppButton";
import {
  AppCard,
  AppCardAction,
  AppCardContent,
  AppCardDescription,
  AppCardHeader,
  AppCardTitle,
} from "@/components/common/AppCard";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import {
  AppBadge as Badge,
  AppProgress as Progress,
  AppSkeleton as Skeleton,
  AppTabs as Tabs,
  AppTabsContent as TabsContent,
  AppTabsList as TabsList,
  AppTabsTrigger as TabsTrigger,
} from "@/components/common/primitives";

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6a3 3 0 0 0-2.1 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z" />
    </svg>
  );
}

const platformIcons: Record<SourcePlatform, ReactNode> = {
  youtube: <YoutubeIcon className="size-4 text-primary" />,
  tiktok: <Film className="size-4 text-primary" />,
  instagram: <Film className="size-4 text-primary" />,
  upload: <Upload className="size-4 text-muted-foreground" />,
};

const statusVariants: Record<JobStatus, "default" | "secondary" | "outline" | "destructive"> = {
  completed: "default",
  transcribing: "secondary",
  detecting_highlights: "secondary",
  cutting_clips: "secondary",
  pending: "outline",
  failed: "destructive",
};

function getUserEmail(job: AdminJobItem): string {
  if (typeof job.userId === "object") return job.userId.email;
  return job.userEmail || job.userId;
}

function JobDetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-[34rem] w-full" />
        <Skeleton className="h-[34rem] w-full" />
      </div>
    </div>
  );
}

export function JobDetailPage({ id }: { id: string }) {
  const query = useAdminJobDetailQuery(id);
  const retryMutation = useRetryJobMutation();
  const job = query.data;

  const copyJobId = () => {
    void navigator.clipboard.writeText(id);
    toast.success("Job ID copied to clipboard");
  };

  if (query.isLoading) return <JobDetailSkeleton />;
  if (query.isError || !job) {
    return (
      <div className="space-y-5">
        <AppLinkButton variant="ghost" render={<Link href="/jobs" />}><ArrowLeft />Back to jobs</AppLinkButton>
        <QueryErrorState
          title="Job details unavailable"
          description="This job could not be loaded. It may have been removed or the backend is unavailable."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </div>
    );
  }

  const pipelineSteps = [
    {
      id: "ingestion",
      label: "Ingestion & media probe",
      description: "Download the source and inspect its media metadata.",
      done: Boolean(job.videoDuration || job.status !== "pending"),
      active: job.status === "pending",
    },
    {
      id: "transcription",
      label: "Whisper transcription",
      description: "Extract timestamped speech for highlight analysis.",
      done: Boolean(job.transcript?.length) || ["detecting_highlights", "cutting_clips", "completed"].includes(job.status),
      active: job.status === "transcribing",
    },
    {
      id: "highlights",
      label: "AI highlight detection",
      description: "Score moments, hooks, and narrative segments.",
      done: Boolean(job.highlights?.length) || ["cutting_clips", "completed"].includes(job.status),
      active: job.status === "detecting_highlights",
    },
    {
      id: "render",
      label: "Vertical clip rendering",
      description: `Apply the ${job.stylePreset || "default"} preset and render subtitles.`,
      done: job.status === "completed",
      active: job.status === "cutting_clips",
    },
    {
      id: "storage",
      label: "Cloud storage",
      description: "Persist completed MP4 clips and delivery assets.",
      done: job.status === "completed",
      active: false,
    },
  ];

  return (
    <div className="space-y-5 lg:space-y-6">
      <AppLinkButton variant="ghost" className="-ml-2" render={<Link href="/jobs" />}>
        <ArrowLeft />Back to jobs
      </AppLinkButton>

      <AppPageHeader
        title={job.videoTitle || "Processing job"}
        description="Source, processing lifecycle, generated clips, highlights, and transcript."
        action={job.status === "failed" ? (
          <AppButton
            variant="destructive"
            isLoading={retryMutation.isPending}
            onClick={() => retryMutation.mutate(job._id)}
          >
            <RotateCw />Retry job
          </AppButton>
        ) : undefined}
      />

      <AppCard className="bg-gradient-to-br from-card via-card to-primary/10">
        <AppCardContent className="grid gap-5 pt-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Job ID</p>
            <div className="mt-1 flex items-center gap-1">
              <code className="truncate text-xs">{job._id}</code>
              <AppButton variant="ghost" size="icon-xs" onClick={copyJobId} aria-label="Copy job ID"><Copy /></AppButton>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={statusVariants[job.status]} className="mt-1 capitalize">{job.status.replaceAll("_", " ")}</Badge>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Owner</p>
            <p className="mt-1 truncate font-medium">{getUserEmail(job)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="mt-1 font-medium">{format(new Date(job.createdAt), "MMM d, yyyy · h:mm a")}</p>
          </div>
        </AppCardContent>
      </AppCard>

      {job.sourceUrl && (
        <a
          href={job.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-2 text-sm text-primary hover:underline"
        >
          {platformIcons[job.sourcePlatform]}
          <span className="truncate">{job.sourceUrl}</span>
          <ExternalLink className="size-3.5 shrink-0" />
        </a>
      )}

      {!['completed', 'failed'].includes(job.status) && (
        <AppCard size="sm">
          <AppCardContent>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="flex items-center gap-2 font-medium"><RotateCw className="size-4 animate-spin text-primary" />Currently processing {job.status.replaceAll("_", " ")}</span>
              <strong className="font-mono text-primary">{job.progressPercent}%</strong>
            </div>
            <Progress value={job.progressPercent} className="h-2" />
          </AppCardContent>
        </AppCard>
      )}

      {job.status === "failed" && (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="size-4" />Failed at {job.errorStage || "an unknown stage"}</p>
          <p className="break-words font-mono text-xs text-destructive/90">{job.errorMessage || "No detailed worker error was returned."}</p>
        </div>
      )}

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <AppCard className="min-w-0">
          <AppCardContent className="min-w-0">
            <Tabs defaultValue="overview" className="min-w-0 w-full">
              <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="overview"><Layers />Overview</TabsTrigger>
                <TabsTrigger value="clips"><Film />Clips ({job.clips?.length ?? job.clipsCount ?? 0})</TabsTrigger>
                <TabsTrigger value="highlights"><Sparkles />Highlights ({job.highlights?.length ?? 0})</TabsTrigger>
                <TabsTrigger value="transcript"><FileText />Transcript</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6 w-full space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Duration", job.videoDuration ? `${Math.round(job.videoDuration)} seconds` : "—"],
                    ["Style preset", job.stylePreset || "default"],
                    ["AI model", job.aiModel || "Default provider model"],
                    ["Output", job.resolutionUsed || "1080 × 1920"],
                    ["Highlights", (job.highlights?.length ?? 0).toLocaleString()],
                    ["Generated clips", (job.clips?.length ?? job.clipsCount ?? 0).toLocaleString()],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 font-medium capitalize">{value}</p>
                    </div>
                  ))}
                </div>
                {job.customPrompt && (
                  <div className="rounded-lg border p-4">
                    <p className="text-xs font-medium text-muted-foreground">Custom prompt</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{job.customPrompt}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="clips" className="mt-6">
                {job.clips?.length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {job.clips.map((clip, index) => (
                      <article key={clip._id || index} className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="outline">Clip {index + 1}</Badge>
                          <span className="font-mono text-xs text-muted-foreground">{clip.startTime.toFixed(1)}s – {clip.endTime.toFixed(1)}s</span>
                        </div>
                        {clip.outputUrl && /^https?:\/\//i.test(clip.outputUrl) && (
                          <video className="aspect-video w-full rounded-md bg-muted object-cover" controls preload="metadata" src={clip.outputUrl} />
                        )}
                        <code className="block truncate rounded bg-muted px-2 py-1 text-xs">{clip.r2ObjectKey || "Storage key unavailable"}</code>
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant={clip.hasCaptions ? "default" : "secondary"}>{clip.hasCaptions ? "Captioned" : "Raw cut"}</Badge>
                          {(clip.downloadUrl || clip.outputUrl) && (
                            <a className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={clip.downloadUrl || clip.outputUrl} target="_blank" rel="noopener noreferrer">Open clip <ExternalLink /></a>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <p className="py-12 text-center text-sm text-muted-foreground">No generated clips are available yet.</p>}
              </TabsContent>

              <TabsContent value="highlights" className="mt-6">
                {job.highlights?.length ? (
                  <div className="space-y-3">
                    {job.highlights.map((highlight, index) => (
                      <article key={`${highlight.startTime}-${index}`} className="space-y-2 rounded-lg border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="font-semibold">{highlight.clipTitle || `Highlight ${index + 1}`}</h2>
                          <Badge variant="secondary">Score {Math.round((highlight.score ?? 0) * 100)}/100</Badge>
                        </div>
                        {highlight.hookText && <p className="font-medium">“{highlight.hookText}”</p>}
                        {highlight.reason && <p className="text-sm text-muted-foreground">{highlight.reason}</p>}
                        <p className="font-mono text-xs text-muted-foreground">{highlight.startTime.toFixed(1)}s – {highlight.endTime.toFixed(1)}s</p>
                      </article>
                    ))}
                  </div>
                ) : <p className="py-12 text-center text-sm text-muted-foreground">No highlights have been detected yet.</p>}
              </TabsContent>

              <TabsContent value="transcript" className="mt-6">
                {job.transcript?.length ? (
                  <div className="max-h-[40rem] divide-y overflow-y-auto rounded-lg border">
                    {job.transcript.map((segment, index) => (
                      <div key={`${segment.startTime}-${index}`} className="flex gap-4 px-4 py-3 text-sm hover:bg-muted/30">
                        <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{Math.floor(segment.startTime / 60)}:{String(Math.floor(segment.startTime % 60)).padStart(2, "0")}</span>
                        <p className="leading-relaxed">{segment.text}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="py-12 text-center text-sm text-muted-foreground">No transcript is stored for this job.</p>}
              </TabsContent>
            </Tabs>
          </AppCardContent>
        </AppCard>

        <AppCard className="xl:sticky xl:top-4">
          <AppCardHeader>
            <AppCardTitle>Processing lifecycle</AppCardTitle>
            <AppCardDescription>Worker stages for this job</AppCardDescription>
            <AppCardAction><Badge variant="outline">{job.progressPercent}%</Badge></AppCardAction>
          </AppCardHeader>
          <AppCardContent>
            <ol className="space-y-3">
              {pipelineSteps.map((step, index) => (
                <li key={step.id} className="flex gap-3 rounded-lg border p-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs">
                    {step.done ? <CheckCircle2 className="size-4 text-primary" /> : step.active ? <RotateCw className="size-4 animate-spin text-primary" /> : index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{step.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </AppCardContent>
        </AppCard>
      </div>
    </div>
  );
}
