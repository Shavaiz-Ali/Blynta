"use client";

import * as React from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { AppButton } from "@/components/common/AppButton";
import { AppInput } from "@/components/common/AppInput";
import { AppTextarea } from "@/components/common/AppTextarea";
import { AppSelect, AppSelectOption } from "@/components/common/AppSelect";
import { AppSpinner } from "@/components/common/AppSpinner";
import { YouTubeIcon } from "@/features/dashboard/icons";
import {
  useYouTubeStatus,
  usePublications,
  usePublishToYouTube,
  useRetryPublication,
  useConnectYouTube,
  useDisconnectYouTube,
} from "../queries";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RotateCw,
  LogOut,
  UploadCloud,
} from "lucide-react";

interface PublishToYouTubeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  clipId: string;
  clipTitle?: string;
  defaultDescription?: string;
}

const PRIVACY_OPTIONS: AppSelectOption[] = [
  {
    value: "private",
    label: "Private",
    description: "Only you and people you choose can watch",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description: "Anyone with the video link can watch",
  },
  {
    value: "public",
    label: "Public",
    description: "Everyone can see and find your video",
  },
];

export function PublishToYouTubeDialog({
  open,
  onOpenChange,
  jobId,
  clipId,
  clipTitle = "",
  defaultDescription = "",
}: PublishToYouTubeDialogProps) {
  const [title, setTitle] = React.useState(clipTitle);
  const [description, setDescription] = React.useState(defaultDescription);
  const [privacyStatus, setPrivacyStatus] = React.useState<
    "private" | "unlisted" | "public"
  >("private");

  React.useEffect(() => {
    if (clipTitle) {
      setTitle(clipTitle.slice(0, 100));
    }
  }, [clipTitle]);

  React.useEffect(() => {
    if (defaultDescription) {
      setDescription(defaultDescription);
    }
  }, [defaultDescription]);

  const { data: ytStatus, isLoading: isStatusLoading } = useYouTubeStatus({
    enabled: open,
  });

  const { data: publications, isLoading: isPubsLoading } = usePublications(
    jobId,
    clipId,
    { enabled: open }
  );

  const connectMutation = useConnectYouTube({
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to start YouTube connection");
    },
  });

  const disconnectMutation = useDisconnectYouTube({
    onSuccess: () => {
      toast.success("YouTube channel disconnected");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to disconnect channel");
    },
  });

  const publishMutation = usePublishToYouTube(jobId, clipId, {
    onSuccess: () => {
      toast.success("Publication queued! Video is uploading in background.");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to start publication");
    },
  });

  const retryMutation = useRetryPublication(jobId, clipId, {
    onSuccess: () => {
      toast.success("Retrying YouTube upload...");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to retry upload");
    },
  });

  const latestPub =
    publications && publications.length > 0 ? publications[0] : undefined;
  const isUploading =
    latestPub?.status === "queued" ||
    latestPub?.status === "uploading" ||
    latestPub?.status === "processing";

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a video title");
      return;
    }
    publishMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      privacyStatus,
    });
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Publish to YouTube Shorts"
      description="Upload this clip directly to your YouTube channel without manual downloading."
      size="md"
    >
      <div className="space-y-4 pt-1">
        {/* Loading state */}
        {isStatusLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <AppSpinner size="sm" />
            <span className="text-xs">Checking YouTube connection...</span>
          </div>
        ) : !ytStatus?.connected ? (
          /* Not Connected state */
          <div className="rounded-xl border border-border/70 bg-muted/40 p-5 text-center space-y-4">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <YouTubeIcon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                Connect Your YouTube Channel
              </h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                Authorize Blynta to upload clips directly to your channel. You
                can disconnect at any time.
              </p>
            </div>
            <AppButton
              className="w-full"
              icon={<YouTubeIcon className="h-4 w-4" />}
              onClick={() => connectMutation.mutate()}
              isLoading={connectMutation.isPending}
            >
              Connect YouTube Channel
            </AppButton>
          </div>
        ) : (
          /* Connected State */
          <div className="space-y-4">
            {/* Channel header info */}
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {ytStatus.channel?.thumbnail ? (
                  <img
                    src={ytStatus.channel.thumbnail}
                    alt={ytStatus.channel.title}
                    className="h-8 w-8 rounded-full object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                    <YouTubeIcon className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">
                    Connected Channel
                  </p>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {ytStatus.channel?.title || "Connected YouTube Channel"}
                  </p>
                </div>
              </div>

              <AppButton
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2"
                onClick={() => disconnectMutation.mutate()}
                isLoading={disconnectMutation.isPending}
                disabled={isUploading}
                icon={<LogOut className="h-3.5 w-3.5" />}
              >
                Disconnect
              </AppButton>
            </div>

            {/* Publication Status Card */}
            {latestPub && (
              <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5 space-y-2">
                {isUploading ? (
                  <div className="flex items-center gap-3">
                    <AppSpinner size="sm" className="text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">
                        {latestPub.status === "queued"
                          ? "Upload queued..."
                          : "Uploading to YouTube..."}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        Processing in background. You can safely close this dialog.
                      </p>
                    </div>
                  </div>
                ) : latestPub.status === "published" ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 min-w-0">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">
                          Published to YouTube
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {latestPub.publishedAt
                            ? new Date(latestPub.publishedAt).toLocaleString()
                            : "Recently published"}
                        </p>
                      </div>
                    </div>
                    {latestPub.externalUrl && (
                      <a
                        href={latestPub.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Watch
                      </a>
                    )}
                  </div>
                ) : latestPub.status === "failed" ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">Upload failed</p>
                        <p className="text-[11px] text-destructive/80 mt-0.5 leading-relaxed">
                          {latestPub.error || "An error occurred during upload."}
                        </p>
                      </div>
                    </div>
                    <AppButton
                      variant="outline"
                      size="sm"
                      onClick={() => retryMutation.mutate(latestPub._id)}
                      isLoading={retryMutation.isPending}
                      icon={<RotateCw className="h-3.5 w-3.5" />}
                      className="text-xs h-7"
                    >
                      Retry Upload
                    </AppButton>
                  </div>
                ) : null}
              </div>
            )}

            {/* Publishing Form */}
            {!isUploading && (
              <form onSubmit={handlePublish} className="space-y-3.5">
                <AppInput
                  label="Title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                  placeholder="Enter short title..."
                  maxLength={100}
                  size="sm"
                  disabled={publishMutation.isPending}
                  helperText={`${title.length}/100`}
                />

                <AppTextarea
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
                  placeholder="Add description and #Shorts tags..."
                  rows={3}
                  maxLength={5000}
                  showCount
                  disabled={publishMutation.isPending}
                />

                <AppSelect
                  label="Visibility"
                  options={PRIVACY_OPTIONS}
                  value={privacyStatus}
                  onValueChange={(val) =>
                    setPrivacyStatus(val as "private" | "unlisted" | "public")
                  }
                  size="sm"
                  disabled={publishMutation.isPending}
                />

                <div className="pt-2 flex justify-end gap-2">
                  <AppButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    disabled={publishMutation.isPending}
                  >
                    Cancel
                  </AppButton>
                  <AppButton
                    type="submit"
                    size="sm"
                    icon={<UploadCloud className="h-4 w-4" />}
                    isLoading={publishMutation.isPending}
                  >
                    Publish Short
                  </AppButton>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </AppDialog>
  );
}
