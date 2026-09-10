"use client";

import * as React from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { AppButton } from "@/components/common/AppButton";
import { AppInput } from "@/components/common/AppInput";
import { AppSelect } from "@/components/common/AppSelect";
import { ClockIcon, SparklesIcon } from "@/features/dashboard/icons";
import { toast } from "sonner";

export interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clipTitle: string;
  clipDescription?: string;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  clipTitle,
  clipDescription = "",
}: ScheduleDialogProps) {
  const [platform, setPlatform] = React.useState("youtube");
  const [date, setDate] = React.useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [time, setTime] = React.useState("18:00");
  const [caption, setCaption] = React.useState(clipTitle);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCaption(clipTitle);
    }
  }, [open, clipTitle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      onOpenChange(false);
      toast.success(
        `Clip scheduled for ${platform === "youtube" ? "YouTube Shorts" : platform === "tiktok" ? "TikTok" : "Instagram Reels"} on ${date} at ${time}`
      );
    }, 600);
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Schedule Post"
      description="Select target platform, publication date and caption for your short video."
      footer={
        <>
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </AppButton>
          <AppButton
            variant="default"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            icon={<ClockIcon className="h-3.5 w-3.5" />}
          >
            Schedule Post
          </AppButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Platform Selection */}
        <AppSelect
          label="Target Platform"
          value={platform}
          onValueChange={setPlatform}
          options={[
            {
              value: "youtube",
              label: "YouTube Shorts",
              description: "Auto-publish as vertical short",
            },
            {
              value: "tiktok",
              label: "TikTok",
              description: "Direct feed publication",
            },
            {
              value: "instagram",
              label: "Instagram Reels",
              description: "Reel stream post",
            },
          ]}
        />

        {/* Date & Time Grid */}
        <div className="grid grid-cols-2 gap-3">
          <AppInput
            type="date"
            label="Publication Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <AppInput
            type="time"
            label="Publication Time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>

        {/* Caption Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground block">
            Post Caption
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background/50 dark:bg-muted/30 p-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all"
            placeholder="Write post caption or hashtags..."
          />
        </div>

        <div className="p-3 rounded-md bg-muted/40 border border-border/60 text-[11px] text-muted-foreground flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-primary shrink-0" />
          <span>
            Scheduled posts will be processed automatically using your connected channel credentials.
          </span>
        </div>
      </form>
    </AppDialog>
  );
}
