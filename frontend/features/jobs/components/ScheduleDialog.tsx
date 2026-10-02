"use client";

import * as React from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppDialog } from "@/components/common/AppDialog";
import { AppButton } from "@/components/common/AppButton";
import { AppInput } from "@/components/common/AppInput";
import { AppSelect } from "@/components/common/AppSelect";
import { AppSteps } from "@/components/common/AppSteps";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, SparklesIcon, YouTubeIcon } from "@/features/dashboard/icons";
import { useScheduleToYouTube, useYouTubeStatus } from "@/features/youtube";
import { ScheduleDateTimeFields } from "@/features/youtube/components/ScheduleDateTimeFields";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  clipId: string;
  clipTitle: string;
  clipDescription?: string;
}

const SCHEDULE_STEPS = [
  { id: "details", label: "Clip details" },
  { id: "publishing", label: "Publishing" },
];

function tomorrowAtSix() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(18, 0, 0, 0);
  return date;
}

export function ScheduleDialog({ open, onOpenChange, jobId, clipId, clipTitle, clipDescription = "" }: ScheduleDialogProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [date, setDate] = React.useState<Date>(() => tomorrowAtSix());
  const [time, setTime] = React.useState("18:00");
  const [title, setTitle] = React.useState(clipTitle);
  const [description, setDescription] = React.useState(clipDescription);
  const [privacyStatus, setPrivacyStatus] = React.useState("private");
  const { data: youtubeStatus, isLoading: statusLoading } = useYouTubeStatus({ enabled: open });
  const scheduleMutation = useScheduleToYouTube(jobId, clipId);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCurrentStep(0);
      setTitle(clipTitle);
      setDescription(clipDescription);
    }
    onOpenChange(nextOpen);
  };

  const handleContinue = () => {
    if (!title.trim()) {
      toast.error("Add a title for the scheduled Short.");
      return;
    }
    setCurrentStep(1);
  };

  const handleSubmit = () => {
    if (!youtubeStatus?.connected) {
      toast.error("Connect your YouTube channel before scheduling a post.");
      return;
    }
    if (!title.trim()) {
      toast.error("Add a title for the scheduled Short.");
      return;
    }

    const [hours, minutes] = time.split(":").map(Number);
    const scheduledAt = new Date(date);
    scheduledAt.setHours(hours, minutes, 0, 0);
    if (scheduledAt.getTime() <= Date.now() + 60_000) {
      toast.error("Choose a time at least one minute from now.");
      return;
    }

    scheduleMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      privacyStatus: privacyStatus as "private" | "unlisted" | "public",
      scheduledAt: scheduledAt.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }, {
      onSuccess: () => {
        toast.success(`Scheduled for ${format(scheduledAt, "MMM d 'at' h:mm a")}`);
        handleOpenChange(false);
        router.push("/calendar");
      },
      onError: (error) => toast.error(error.message || "Could not schedule this post."),
    });
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      size="lg"
      title="Schedule YouTube Short"
      description={currentStep === 0 ? "Review the content viewers will see on YouTube." : "Choose when and how this Short should be published."}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <AppButton variant="ghost" size="sm" onClick={() => handleOpenChange(false)} disabled={scheduleMutation.isPending}>Cancel</AppButton>
          <div className="flex items-center gap-2">
            {currentStep === 1 && (
              <AppButton variant="outline" size="sm" onClick={() => setCurrentStep(0)} disabled={scheduleMutation.isPending} icon={<ChevronLeftIcon className="h-3.5 w-3.5" />}>Back</AppButton>
            )}
            {currentStep === 0 ? (
              <AppButton size="sm" onClick={handleContinue} icon={<ChevronRightIcon className="h-3.5 w-3.5" />} iconPosition="right">Publishing details</AppButton>
            ) : (
              <AppButton size="sm" onClick={handleSubmit} isLoading={scheduleMutation.isPending} disabled={statusLoading || !youtubeStatus?.connected} icon={<ClockIcon className="h-3.5 w-3.5" />}>Schedule post</AppButton>
            )}
          </div>
        </div>
      }
      footerClassName="sm:justify-stretch"
    >
      <div className="space-y-5">
        <div className={cn("flex items-center gap-3 rounded-lg border p-3", youtubeStatus?.connected ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30")}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-500"><YouTubeIcon className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">YouTube Shorts</p>
            <p className="truncate text-xs text-muted-foreground">
              {statusLoading ? "Checking channel…" : youtubeStatus?.connected ? youtubeStatus.channel?.title || "Connected channel" : "Connect YouTube from Social Accounts to schedule posts"}
            </p>
          </div>
          {!statusLoading && !youtubeStatus?.connected && (
            <Link href="/social-accounts"><AppButton variant="outline" size="sm">Connect</AppButton></Link>
          )}
        </div>

        <AppSteps steps={SCHEDULE_STEPS} currentStep={currentStep} />

        {currentStep === 0 ? (
          <div className="space-y-4">
            <AppInput label="Video title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Description</label>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={5000} className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30" placeholder="Add context, links, or hashtags…" />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <ScheduleDateTimeFields date={date} time={time} onDateChange={setDate} onTimeChange={setTime} />
            <AppSelect label="Visibility" value={privacyStatus} onValueChange={setPrivacyStatus} options={[
              { value: "private", label: "Private", description: "Only you can watch" },
              { value: "unlisted", label: "Unlisted", description: "Anyone with the link can watch" },
              { value: "public", label: "Public", description: "Visible to everyone" },
            ]} />
            <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <SparklesIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Blynta keeps the post in the publishing queue and automatically uploads it at the selected local time.
            </div>
          </div>
        )}
      </div>
    </AppDialog>
  );
}
