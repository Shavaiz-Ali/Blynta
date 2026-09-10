"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Job, JobStatus, useDeleteJob, useRetryJob } from "@/features/jobs";
import { AppDialog } from "@/components/common/AppDialog";
import { AppButton } from "@/components/common/AppButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  MoreVerticalIcon,
  ArrowRightIcon,
  RefreshCwIcon,
  TrashIcon,
} from "../icons";

export interface JobActionsMenuProps {
  job: Job;
  menuPlacement?: "top" | "bottom";
  className?: string;
}

export function JobActionsMenu({
  job,
  menuPlacement = "bottom",
  className,
}: JobActionsMenuProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const deleteJob = useDeleteJob();
  const retryJob = useRetryJob();

  const jobId = (job as any)._id || job.id;
  const isFailed = job.status === JobStatus.FAILED;

  const handleDelete = () => {
    deleteJob.mutate(jobId, {
      onSuccess: () => {
        toast.success("Job deleted.");
        setDeleteOpen(false);
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to delete job.");
      },
    });
  };

  const handleRetry = () => {
    retryJob.mutate(jobId, {
      onSuccess: () => {
        toast.success("Job re-queued for processing");
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to retry job");
      },
    });
  };

  return (
    <div
      className={cn("relative", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <AppButton
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer"
              aria-label="More options"
            >
              <MoreVerticalIcon className="h-4 w-4" />
            </AppButton>
          }
        />

        <DropdownMenuContent
          align="end"
          side={menuPlacement}
          sideOffset={4}
          className="w-40 rounded-xl p-1.5"
        >
          <DropdownMenuItem
            className="rounded-lg text-xs font-medium cursor-pointer"
            onClick={() => router.push(`/jobs/${jobId}`)}
          >
            <ArrowRightIcon className="h-3.5 w-3.5 text-primary" />
            <span>View Clips</span>
          </DropdownMenuItem>

          {isFailed && (
            <DropdownMenuItem
              className="rounded-lg text-xs font-medium text-chart-2 focus:text-chart-2 cursor-pointer"
              disabled={retryJob.isPending}
              onClick={handleRetry}
            >
              <RefreshCwIcon
                className={cn(
                  "h-3.5 w-3.5",
                  retryJob.isPending && "animate-spin"
                )}
              />
              <span>Retry Job</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            variant="destructive"
            className="rounded-lg text-xs font-medium cursor-pointer"
            onClick={() => setDeleteOpen(true)}
          >
            <TrashIcon className="h-3.5 w-3.5 text-destructive" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AppDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        size="sm"
        title="Delete this job?"
        description="This will permanently delete this job and all its clips. This cannot be undone."
        footer={
          <div className="flex w-full gap-2 justify-end">
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteJob.isPending}
            >
              Cancel
            </AppButton>
            <AppButton
              variant="destructive"
              size="sm"
              isLoading={deleteJob.isPending}
              onClick={handleDelete}
            >
              Delete
            </AppButton>
          </div>
        }
      />
    </div>
  );
}
