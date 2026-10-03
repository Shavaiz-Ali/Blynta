"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
} from "date-fns";
import type { DayButtonProps } from "react-day-picker";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeaderRight } from "@/features/dashboard/components/DashboardHeaderRight";
import { useCurrentUser } from "@/features/auth/queries";
import { Calendar } from "@/components/ui/calendar";
import { AppButton } from "@blynta/ui";
import { AppDialog } from "@blynta/ui";
import { AppSteps, type AppStepDef } from "@blynta/ui";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilmIcon,
  PlusIcon,
  Trash2Icon,
  YouTubeIcon,
} from "@/features/dashboard/icons";
import { JobStatus, useJobs } from "@/features/jobs";
import {
  getJobDisplayTitle,
  getJobThumbnail,
} from "@/features/dashboard/utils";
import { ScheduleDateTimeFields } from "./ScheduleDateTimeFields";
import { YouTubeWizardStepDetails } from "./YouTubeWizardStepDetails";
import { YouTubeWizardStepSettings } from "./YouTubeWizardStepSettings";
import {
  useCancelScheduledPublication,
  useReschedulePublication,
  useScheduleClipsToYouTube,
  useSchedules,
  useYouTubeCategories,
  useYouTubeStatus,
} from "../queries";
import type { ClipPublication } from "../types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function isValidFutureSchedule(date: Date) {
  return date.getTime() > Date.now() + 60_000;
}

const CREATE_STEPS: AppStepDef[] = [
  { id: "selection", label: "Select clips" },
  { id: "details", label: "Clip details" },
  { id: "publishing", label: "Publishing" },
];

interface ScheduledClipDetails {
  title: string;
  description: string;
}

export function SchedulingCalendarPage() {
  const router = useRouter();
  const { data: profile } = useCurrentUser();
  const [month, setMonth] = React.useState(() => new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date>(
    () => new Date(),
  );
  const [overflowDate, setOverflowDate] = React.useState<Date | null>(null);
  const [selectedPublication, setSelectedPublication] =
    React.useState<ClipPublication | null>(null);
  const [editDate, setEditDate] = React.useState<Date>(() => new Date());
  const [editTime, setEditTime] = React.useState("18:00");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createStep, setCreateStep] = React.useState(0);
  const [selectedJobId, setSelectedJobId] = React.useState("");
  const [selectedClipIds, setSelectedClipIds] = React.useState<string[]>([]);
  const [clipDetails, setClipDetails] = React.useState<
    Record<string, ScheduledClipDetails>
  >({});
  const [activeDetailsClipId, setActiveDetailsClipId] = React.useState("");
  const [createDate, setCreateDate] = React.useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(18, 0, 0, 0);
    return date;
  });
  const [createTime, setCreateTime] = React.useState("18:00");
  const [createPrivacy, setCreatePrivacy] = React.useState("private");
  const [createCategoryId, setCreateCategoryId] = React.useState("");
  const [createTags, setCreateTags] = React.useState<string[]>([]);

  const range = React.useMemo(
    () => ({
      from: startOfMonth(addMonths(month, -1)).toISOString(),
      to: endOfMonth(addMonths(month, 1)).toISOString(),
    }),
    [month],
  );
  const {
    data: schedules = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useSchedules(range);
  const { data: youtubeStatus } = useYouTubeStatus();
  const reschedule = useReschedulePublication();
  const cancel = useCancelScheduledPublication();
  const scheduleClips = useScheduleClipsToYouTube();
  const { data: categories, isLoading: categoriesLoading } =
    useYouTubeCategories({
      enabled: createOpen,
    });
  const { data: jobsData, isLoading: jobsLoading } = useJobs(
    { page: 1, limit: 50 },
    { enabled: createOpen },
  );
  const projects =
    jobsData?.jobs.filter((job) =>
      job.clips?.some((clip) => clip.status === JobStatus.COMPLETED),
    ) ?? [];
  const effectiveJobId =
    selectedJobId || projects[0]?._id || projects[0]?.id || "";
  const selectedJob = projects.find(
    (job) => (job._id || job.id) === effectiveJobId,
  );
  const availableClips =
    selectedJob?.clips?.filter((clip) => clip.status === JobStatus.COMPLETED) ??
    [];
  const activeDetails = clipDetails[activeDetailsClipId];
  const categoryOptions = React.useMemo(
    () =>
      (categories ?? []).map((category) => ({
        value: category.id,
        label: category.title,
      })),
    [categories],
  );
  const preferredCategoryId = React.useMemo(() => {
    const available = categories ?? [];
    return (
      (
        available.find((category) => category.id === "24") ||
        available.find((category) => category.id === "22") ||
        available.find((category) => category.id === "23") ||
        available[0]
      )?.id || ""
    );
  }, [categories]);
  const overflowPublications = React.useMemo(
    () =>
      overflowDate
        ? schedules
            .filter((item) =>
              isSameDay(new Date(item.scheduledAt!), overflowDate),
            )
            .sort(
              (a, b) =>
                new Date(a.scheduledAt!).getTime() -
                new Date(b.scheduledAt!).getTime(),
            )
        : [],
    [overflowDate, schedules],
  );

  const openSchedule = React.useCallback((publication: ClipPublication) => {
    const date = new Date(publication.scheduledAt!);
    setEditDate(date);
    setEditTime(format(date, "HH:mm"));
    setSelectedPublication(publication);
  }, []);

  const handleReschedule = () => {
    if (!selectedPublication) return;
    const [hours, minutes] = editTime.split(":").map(Number);
    const scheduledAt = new Date(editDate);
    scheduledAt.setHours(hours, minutes, 0, 0);
    if (!isValidFutureSchedule(scheduledAt)) {
      toast.error("Choose a time at least one minute from now.");
      return;
    }
    reschedule.mutate(
      {
        id: selectedPublication._id,
        scheduledAt: scheduledAt.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      {
        onSuccess: () => {
          toast.success("Schedule updated.");
          setSelectedPublication(null);
        },
        onError: (error) =>
          toast.error(error.message || "Could not update schedule."),
      },
    );
  };

  const handleCancel = () => {
    if (!selectedPublication) return;
    cancel.mutate(selectedPublication._id, {
      onSuccess: () => {
        toast.success("Scheduled post cancelled.");
        setSelectedPublication(null);
      },
      onError: (error) =>
        toast.error(error.message || "Could not cancel schedule."),
    });
  };

  const openCreateSchedule = () => {
    setCreateStep(0);
    setSelectedJobId("");
    setSelectedClipIds([]);
    setClipDetails({});
    setActiveDetailsClipId("");
    setCreatePrivacy("private");
    setCreateCategoryId("");
    setCreateTags([]);
    setCreateOpen(true);
  };

  const toggleClip = (clipId: string) => {
    setSelectedClipIds((current) =>
      current.includes(clipId)
        ? current.filter((id) => id !== clipId)
        : [...current, clipId],
    );
  };

  const handleSelectionNext = () => {
    if (!selectedJob || selectedClipIds.length === 0) {
      toast.error("Choose at least one clip to continue.");
      return;
    }

    const nextDetails: Record<string, ScheduledClipDetails> = {};
    const tags = new Set<string>();
    selectedClipIds.forEach((clipId) => {
      const clipIndex = selectedJob.clips.findIndex(
        (clip) => (clip._id || clip.id) === clipId,
      );
      const highlight = selectedJob.highlights?.[clipIndex];
      nextDetails[clipId] = clipDetails[clipId] || {
        title:
          highlight?.clipTitle ||
          highlight?.hookText ||
          `${getJobDisplayTitle(selectedJob, 70)} — Clip ${clipIndex + 1}`,
        description:
          highlight?.clipDescription ||
          highlight?.reason ||
          selectedJob.videoDescription ||
          "",
      };
      highlight?.tags?.forEach((tag) => tags.add(tag.replace(/^#/, "").trim()));
    });

    setClipDetails(nextDetails);
    setActiveDetailsClipId(selectedClipIds[0]);
    setCreateTags(Array.from(tags).filter(Boolean).slice(0, 30));
    setCreateStep(1);
  };

  const handleDetailsNext = () => {
    const missingTitleId = selectedClipIds.find(
      (clipId) => !clipDetails[clipId]?.title.trim(),
    );
    if (missingTitleId) {
      setActiveDetailsClipId(missingTitleId);
      toast.error("Every selected clip needs a title.");
      return;
    }
    setCreateStep(2);
  };

  const updateActiveDetails = (
    key: keyof ScheduledClipDetails,
    value: string,
  ) => {
    if (!activeDetailsClipId) return;
    setClipDetails((current) => ({
      ...current,
      [activeDetailsClipId]: {
        ...current[activeDetailsClipId],
        [key]: value,
      },
    }));
  };

  const handleCreateSchedule = () => {
    if (!selectedJob || selectedClipIds.length === 0) {
      toast.error("Choose a project and at least one clip.");
      return;
    }
    const [hours, minutes] = createTime.split(":").map(Number);
    const scheduledAt = new Date(createDate);
    scheduledAt.setHours(hours, minutes, 0, 0);
    if (!isValidFutureSchedule(scheduledAt)) {
      toast.error("Choose a time at least one minute from now.");
      return;
    }

    const jobId = selectedJob._id || selectedJob.id;
    const requests = selectedClipIds.map((clipId) => {
      const clipIndex = selectedJob.clips.findIndex(
        (clip) => (clip._id || clip.id) === clipId,
      );
      const details = clipDetails[clipId];
      return {
        jobId,
        clipId,
        input: {
          title:
            details?.title.trim() ||
            `${getJobDisplayTitle(selectedJob, 70)} — Clip ${clipIndex + 1}`,
          description: details?.description.trim() || undefined,
          privacyStatus: createPrivacy as "private" | "unlisted" | "public",
          tags: createTags.length ? createTags : undefined,
          categoryId: createCategoryId || preferredCategoryId || undefined,
          scheduledAt: scheduledAt.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };
    });

    scheduleClips.mutate(requests, {
      onSuccess: () => {
        toast.success(
          `${requests.length} ${requests.length === 1 ? "post" : "posts"} scheduled for ${format(scheduledAt, "MMM d 'at' h:mm a")}.`,
        );
        setCreateOpen(false);
        setMonth(scheduledAt);
        setSelectedDate(scheduledAt);
      },
      onError: (error) =>
        toast.error(error.message || "Could not schedule the selected clips."),
    });
  };

  const headerContent = (
    <div className="flex w-full items-center justify-between">
      <h1 className="text-sm font-semibold">Calendar</h1>
      {profile && <DashboardHeaderRight profile={profile} />}
    </div>
  );

  const showPreviousMonth = () => setMonth((current) => addMonths(current, -1));
  const showNextMonth = () => setMonth((current) => addMonths(current, 1));
  const showToday = () => {
    const today = new Date();
    setMonth(today);
    setSelectedDate(today);
  };

  const renderCalendarDay = React.useCallback(
    ({ day, modifiers, className, ...buttonProps }: DayButtonProps) => {
      const items = schedules.filter((item) =>
        isSameDay(new Date(item.scheduledAt!), day.date),
      );
      return (
        <button
          {...buttonProps}
          type="button"
          onClick={(event) => {
            const showOverflow = (
              event.target as HTMLElement
            ).closest<HTMLElement>("[data-day-overflow]");
            if (showOverflow) {
              event.preventDefault();
              event.stopPropagation();
              setSelectedDate(day.date);
              setOverflowDate(day.date);
              return;
            }
            const publicationId = (
              event.target as HTMLElement
            ).closest<HTMLElement>("[data-publication-id]")?.dataset
              .publicationId;
            const publication = items.find(
              (item) => item._id === publicationId,
            );
            if (publication?.status === "scheduled") {
              event.preventDefault();
              event.stopPropagation();
              openSchedule(publication);
              return;
            }
            buttonProps.onClick?.(event);
          }}
          className={cn(
            "relative flex h-full w-full flex-col items-start justify-start gap-1.5 rounded-none p-2 text-left text-xs transition-colors hover:bg-muted/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 sm:p-3",
            modifiers.outside && "bg-muted/20 text-muted-foreground/60",
            modifiers.today && "font-semibold text-primary",
            modifiers.selected &&
              "bg-primary/[0.06] ring-1 ring-inset ring-primary/30",
            className,
          )}
        >
          <span className="flex items-center gap-1 text-xs font-medium sm:text-sm">
            {modifiers.today && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
            {format(day.date, "MMM d")}
          </span>
          <span className="flex w-full flex-col gap-1 overflow-hidden">
            {items.slice(0, 2).map((item) => (
              <span
                key={item._id}
                data-publication-id={item._id}
                title={
                  item.status === "scheduled"
                    ? `Edit ${item.title}`
                    : item.title
                }
                className={cn(
                  "block w-full truncate rounded px-1.5 py-1 text-[10px] font-medium transition-colors",
                  item.status === "scheduled"
                    ? "cursor-pointer bg-primary/10 text-primary hover:bg-primary/20"
                    : item.status === "published"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {format(new Date(item.scheduledAt!), "h:mm a")} · {item.title}
              </span>
            ))}
            {items.length > 2 && (
              <span className="flex w-full justify-center pt-0.5">
                <span
                  data-day-overflow
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedDate(day.date);
                    setOverflowDate(day.date);
                  }}
                  className="cursor-pointer rounded-full px-2 py-0.5 text-center text-[10px] font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary/90"
                >
                  +{items.length - 2} more
                </span>
              </span>
            )}
          </span>
        </button>
      );
    },
    [schedules, openSchedule],
  );

  return (
    <DashboardLayout headerContent={headerContent}>
      <div className="w-full space-y-6 pb-14">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Content Calendar<span className="text-primary">.</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Plan, review, and manage your scheduled YouTube Shorts.
            </p>
          </div>
          <AppButton
            onClick={openCreateSchedule}
            size="sm"
            icon={<PlusIcon className="h-4 w-4" />}
            className="h-9 self-start font-semibold shadow-sm md:self-auto"
          >
            Schedule post
          </AppButton>
        </div>

        {!youtubeStatus?.connected && (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <YouTubeIcon className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-semibold">
                  Connect YouTube to start scheduling
                </p>
                <p className="text-xs text-muted-foreground">
                  Your scheduled Shorts publish through your connected channel.
                </p>
              </div>
            </div>
            <Link href="/social-accounts">
              <AppButton variant="outline" size="sm">
                Connect channel
              </AppButton>
            </Link>
          </div>
        )}

        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
            <div className="relative flex h-14 items-center justify-center border-b border-border/60 px-4">
              <div className="flex items-center gap-5">
                <AppButton
                  variant="ghost"
                  size="icon-sm"
                  onClick={showPreviousMonth}
                  aria-label="Previous month"
                  title="Previous month"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </AppButton>
                <h2 className="min-w-32 text-center text-sm font-semibold">
                  {format(month, "MMMM yyyy")}
                </h2>
                <AppButton
                  variant="ghost"
                  size="icon-sm"
                  onClick={showNextMonth}
                  aria-label="Next month"
                  title="Next month"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </AppButton>
              </div>
              <AppButton
                variant="ghost"
                size="sm"
                onClick={showToday}
                className="absolute right-3 h-8 px-2.5 text-xs"
              >
                Today
              </AppButton>
            </div>
            {isLoading ? (
              <div className="p-5">
                <Skeleton className="h-[390px] w-full" />
              </div>
            ) : isError ? (
              <div className="flex min-h-[390px] flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm font-semibold">
                  Couldn’t load your schedule
                </p>
                <AppButton
                  variant="outline"
                  size="sm"
                  disabled={isFetching}
                  onClick={() => void refetch()}
                >
                  {isFetching ? "Retrying…" : "Try again"}
                </AppButton>
              </div>
            ) : (
              <Calendar
                mode="single"
                month={month}
                onMonthChange={setMonth}
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="w-full bg-transparent p-0"
                formatters={{
                  formatWeekdayName: (date) => format(date, "EEEE"),
                }}
                components={{ DayButton: renderCalendarDay }}
                classNames={{
                  root: "w-full",
                  months: "w-full",
                  month: "w-full gap-0",
                  month_grid: "w-full table-fixed border-collapse",
                  button_previous: "hidden",
                  button_next: "hidden",
                  month_caption: "hidden",
                  weekdays: "flex w-full border-b border-border/60",
                  weekday:
                    "flex-1 py-3 text-center text-[11px] font-semibold text-muted-foreground sm:text-xs",
                  week: "mt-0 flex w-full",
                  day: "relative h-24 min-w-0 flex-1 rounded-none border-r border-b border-border/60 p-0 text-left last:border-r-0 sm:h-28",
                  outside: "text-muted-foreground",
                  today: "bg-transparent",
                }}
              />
            )}
          </section>
        </div>
      </div>

      <AppDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        size="lg"
        contentClassName="sm:max-w-3xl"
        bodyClassName="themed-scrollbar max-h-[72vh] overflow-y-auto"
        title="Schedule YouTube Shorts"
        description={
          createStep === 0
            ? "Choose a project and the clips you want to schedule."
            : createStep === 1
              ? "Review the title and description for every selected clip."
              : "Choose when and how the selected clips should be published."
        }
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <AppButton
              variant="ghost"
              size="sm"
              onClick={() => setCreateOpen(false)}
              disabled={scheduleClips.isPending}
            >
              Cancel
            </AppButton>
            <div className="flex items-center gap-2">
              {createStep > 0 && (
                <AppButton
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateStep((step) => step - 1)}
                  disabled={scheduleClips.isPending}
                  icon={<ChevronLeftIcon className="h-3.5 w-3.5" />}
                >
                  Back
                </AppButton>
              )}
              {createStep === 0 && projects.length > 0 && (
                <AppButton
                  size="sm"
                  onClick={handleSelectionNext}
                  disabled={selectedClipIds.length === 0}
                  icon={<ChevronRightIcon className="h-3.5 w-3.5" />}
                  iconPosition="right"
                >
                  Continue
                </AppButton>
              )}
              {createStep === 1 && (
                <AppButton
                  size="sm"
                  onClick={handleDetailsNext}
                  icon={<ChevronRightIcon className="h-3.5 w-3.5" />}
                  iconPosition="right"
                >
                  Publishing details
                </AppButton>
              )}
              {createStep === 2 && (
                <AppButton
                  size="sm"
                  onClick={handleCreateSchedule}
                  isLoading={scheduleClips.isPending}
                  disabled={!youtubeStatus?.connected}
                >
                  Schedule {selectedClipIds.length}{" "}
                  {selectedClipIds.length === 1 ? "post" : "posts"}
                </AppButton>
              )}
            </div>
          </div>
        }
        footerClassName="sm:justify-stretch"
      >
        <div className="space-y-5">
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3",
              youtubeStatus?.connected
                ? "border-primary/20 bg-primary/5"
                : "border-amber-500/25 bg-amber-500/5",
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <YouTubeIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">YouTube Shorts</p>
              <p className="truncate text-xs text-muted-foreground">
                {youtubeStatus?.connected
                  ? youtubeStatus.channel?.title || "Connected channel"
                  : "Connect YouTube before scheduling posts"}
              </p>
            </div>
            {!youtubeStatus?.connected && (
              <Link href="/social-accounts">
                <AppButton variant="outline" size="sm">
                  Connect
                </AppButton>
              </Link>
            )}
          </div>

          <AppSteps steps={CREATE_STEPS} currentStep={createStep} />

          {createStep === 0 && (
            <div className="space-y-5">
              <section className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">Choose a project</p>
                  <p className="text-xs text-muted-foreground">
                    The first available project is selected automatically.
                  </p>
                </div>
                {jobsLoading ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-20 rounded-lg" />
                    ))}
                  </div>
                ) : projects.length ? (
                  <div className="themed-scrollbar grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {projects.map((job) => {
                      const jobId = job._id || job.id;
                      const selected = jobId === effectiveJobId;
                      const thumbnail = getJobThumbnail(job);
                      return (
                        <button
                          key={jobId}
                          type="button"
                          onClick={() => {
                            setSelectedJobId(jobId);
                            setSelectedClipIds([]);
                          }}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg border p-2 text-left transition-colors",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border/70 hover:border-primary/30 hover:bg-muted/20",
                          )}
                        >
                          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                            {thumbnail ? (
                              <Image
                                src={thumbnail}
                                alt=""
                                fill
                                sizes="80px"
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <FilmIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-xs font-semibold leading-snug">
                              {getJobDisplayTitle(job, 65)}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {job.clips?.filter(
                                (clip) => clip.status === JobStatus.COMPLETED,
                              ).length ?? 0}{" "}
                              finished clips
                            </p>
                          </div>
                          {selected && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <CheckIcon className="h-3 w-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-primary/25 bg-primary/[0.03] px-6 py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                      <FilmIcon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-foreground">
                      No finished clips yet
                    </h3>
                    <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                      Create a project from a video first. Once its clips are
                      ready, you can select and schedule them here.
                    </p>
                    <AppButton
                      className="mt-5 h-9 px-4"
                      size="sm"
                      icon={<PlusIcon className="h-4 w-4" />}
                      onClick={() => {
                        setCreateOpen(false);
                        router.push("/dashboard");
                      }}
                    >
                      Create project
                    </AppButton>
                  </div>
                )}
              </section>

              {projects.length > 0 && (
                <section
                  className={cn(
                    "space-y-3 transition-opacity",
                    !selectedJob && "opacity-50",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Select clips</p>
                      <p className="text-xs text-muted-foreground">
                        Pick one clip or schedule several together.
                      </p>
                    </div>
                    {availableClips.length > 1 && (
                      <AppButton
                        variant="ghost"
                        size="sm"
                        disabled={!selectedJob}
                        onClick={() =>
                          setSelectedClipIds(
                            selectedClipIds.length === availableClips.length
                              ? []
                              : availableClips.map(
                                  (clip) => clip._id || clip.id,
                                ),
                          )
                        }
                      >
                        {selectedClipIds.length === availableClips.length
                          ? "Clear all"
                          : "Select all"}
                      </AppButton>
                    )}
                  </div>
                  {selectedJob ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {availableClips.map((clip) => {
                        const clipId = clip._id || clip.id;
                        const clipIndex = selectedJob.clips.findIndex(
                          (item) => (item._id || item.id) === clipId,
                        );
                        const highlight = selectedJob.highlights?.[clipIndex];
                        const selected = selectedClipIds.includes(clipId);
                        return (
                          <button
                            key={clipId}
                            type="button"
                            onClick={() => toggleClip(clipId)}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                              selected
                                ? "border-primary bg-primary/5"
                                : "border-border/70 hover:border-primary/30",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                                selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background",
                              )}
                            >
                              {selected && <CheckIcon className="h-3 w-3" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold">
                                {highlight?.clipTitle ||
                                  highlight?.hookText ||
                                  `Clip ${clipIndex + 1}`}
                              </span>
                              <span className="mt-1 block text-[10px] text-muted-foreground">
                                {Math.round(clip.endTime - clip.startTime)} sec
                                ·{" "}
                                {highlight?.score
                                  ? `${Math.round(highlight.score * 100)} score`
                                  : "Ready"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                      Choose a project to see its clips.
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {createStep === 1 && activeDetails && (
            <div className="space-y-4">
              {selectedClipIds.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectedClipIds.map((clipId, index) => (
                    <button
                      key={clipId}
                      type="button"
                      onClick={() => setActiveDetailsClipId(clipId)}
                      className={cn(
                        "shrink-0 cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        clipId === activeDetailsClipId
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Clip {index + 1}
                    </button>
                  ))}
                </div>
              )}
              <div className="rounded-lg border border-border/70 bg-muted/15 p-4">
                <p className="mb-3 text-xs font-semibold text-muted-foreground">
                  Editing {selectedClipIds.indexOf(activeDetailsClipId) + 1} of{" "}
                  {selectedClipIds.length}
                </p>
                <YouTubeWizardStepDetails
                  title={activeDetails.title}
                  description={activeDetails.description}
                  onTitleChange={(value) => updateActiveDetails("title", value)}
                  onDescriptionChange={(value) =>
                    updateActiveDetails("description", value)
                  }
                  disabled={scheduleClips.isPending}
                />
              </div>
              <section className="space-y-3 border-t border-border/60 pt-5">
                <div>
                  <p className="text-sm font-semibold">YouTube settings</p>
                  <p className="text-xs text-muted-foreground">
                    These settings apply to every selected clip.
                  </p>
                </div>
                <YouTubeWizardStepSettings
                  categoryId={createCategoryId || preferredCategoryId}
                  onCategoryChange={setCreateCategoryId}
                  categoryOptions={categoryOptions}
                  isCategoriesLoading={categoriesLoading}
                  tags={createTags}
                  onTagsChange={setCreateTags}
                  privacyStatus={
                    createPrivacy as "private" | "unlisted" | "public"
                  }
                  onPrivacyChange={setCreatePrivacy}
                  disabled={scheduleClips.isPending}
                />
              </section>
            </div>
          )}

          {createStep === 2 && (
            <div className="space-y-5">
              <section className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">Schedule</p>
                  <p className="text-xs text-muted-foreground">
                    All selected clips will use this publication time.
                  </p>
                </div>
                <ScheduleDateTimeFields
                  date={createDate}
                  time={createTime}
                  onDateChange={setCreateDate}
                  onTimeChange={setCreateTime}
                />
              </section>
            </div>
          )}
        </div>
      </AppDialog>

      <AppDialog
        open={Boolean(overflowDate)}
        onOpenChange={(open) => !open && setOverflowDate(null)}
        title="Scheduled posts"
        description={
          overflowDate
            ? `${format(overflowDate, "EEEE, MMMM d")} · ${overflowPublications.length} ${overflowPublications.length === 1 ? "post" : "posts"}`
            : undefined
        }
        size="md"
        bodyClassName="themed-scrollbar max-h-[60vh] overflow-y-auto"
      >
        <div className="space-y-2">
          {overflowPublications.map((publication) => (
            <button
              key={publication._id}
              type="button"
              onClick={() => {
                setOverflowDate(null);
                openSchedule(publication);
              }}
              className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                <YouTubeIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">
                  {publication.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {format(new Date(publication.scheduledAt!), "h:mm a")} ·{" "}
                  <span className="capitalize">
                    {publication.privacyStatus}
                  </span>
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold capitalize text-primary">
                {publication.status}
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          ))}
        </div>
      </AppDialog>

      <AppDialog
        open={Boolean(selectedPublication)}
        onOpenChange={(open) => !open && setSelectedPublication(null)}
        title="Scheduled post"
        description={selectedPublication?.title}
        footer={
          <>
            <AppButton
              variant="destructive"
              size="sm"
              className="h-9 min-w-32"
              onClick={handleCancel}
              disabled={reschedule.isPending}
              isLoading={cancel.isPending}
              icon={<Trash2Icon className="h-3.5 w-3.5" />}
            >
              Cancel post
            </AppButton>
            <AppButton
              size="sm"
              className="h-9 min-w-32"
              onClick={handleReschedule}
              disabled={cancel.isPending}
              isLoading={reschedule.isPending}
            >
              Save changes
            </AppButton>
          </>
        }
      >
        {selectedPublication && (
          <div className="space-y-4">
            <ScheduleDateTimeFields
              date={editDate}
              time={editTime}
              onDateChange={setEditDate}
              onTimeChange={setEditTime}
            />
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
              <span className="text-muted-foreground">Visibility</span>
              <span className="font-medium capitalize">
                {selectedPublication.privacyStatus}
              </span>
            </div>
          </div>
        )}
      </AppDialog>
    </DashboardLayout>
  );
}
