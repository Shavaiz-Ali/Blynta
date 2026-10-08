"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "@blynta/auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppButton, AppCard, AppSkeleton } from "@blynta/ui";
import { Film, ImageIcon, Music } from "lucide-react";
import { toast } from "sonner";
import { studioRequest } from "../../api";
import { blyntaUrl } from "@/config/env";
import {
  useWorkspaceQuery,
  workspaceRequest,
  type AccountProfile,
  type NotificationPage,
} from "../workspace-api";

function DataError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 p-4 text-sm"
    >
      <p>{message}</p>
      <AppButton variant="outline" size="sm" className="mt-3" onClick={retry}>
        Try again
      </AppButton>
    </div>
  );
}
function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total < 2) return null;
  return (
    <div className="flex items-center justify-end gap-3 text-xs">
      <AppButton
        size="sm"
        variant="outline"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </AppButton>
      <span>
        Page {page} of {total}
      </span>
      <AppButton
        size="sm"
        variant="outline"
        disabled={page >= total}
        onClick={() => onChange(page + 1)}
      >
        Next
      </AppButton>
    </div>
  );
}
interface LibraryItem {
  id: string;
  projectId: string;
  name: string;
  kind: string;
  duration: number;
  status: string;
  sourceGroup?: string;
  thumbnail?: string;
  createdAt?: string;
}
export function MediaLibrary({
  fromBlynta = false,
  onUpload,
}: {
  fromBlynta?: boolean;
  onUpload: () => void;
}) {
  const [source, setSource] = useState(fromBlynta ? "blynta" : "all");
  const [page, setPage] = useState(1);
  const { data: session } = useSession();
  const query = useQuery({
    queryKey: ["studio", session?.user.id, "library", source, page],
    enabled: !!session?.user.id,
    queryFn: () =>
      studioRequest<{
        items: LibraryItem[];
        totalPages: number;
        total: number;
      }>(`media?source=${source}&page=${page}`),
    refetchInterval: 60000,
  });
  return (
    <section className="workspace-section space-y-4">
      {fromBlynta ? (
        <div className="blynta-import-guide">
          <Film size={24} className="shrink-0 text-primary" />
          <p>
            Open a generated clip in Blynta and choose{" "}
            <strong>Edit in Studio</strong>. Its clip and supported source media
            stay linked to existing storage.
          </p>
          {blyntaUrl && (
            <AppButton
              size="sm"
              nativeButton={false}
              render={<a href={`${blyntaUrl.replace(/\/$/, "")}/my-clips`} />}
            >
              Browse clips
            </AppButton>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "All"],
            ["uploads", "Uploads"],
            ["blynta", "From Blynta"],
          ].map(([value, label]) => (
            <AppButton
              key={value}
              size="sm"
              variant={source === value ? "default" : "outline"}
              aria-pressed={source === value}
              onClick={() => {
                setSource(value);
                setPage(1);
              }}
            >
              {label}
            </AppButton>
          ))}
          <AppButton size="sm" variant="outline" onClick={onUpload}>
            Upload video
          </AppButton>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Media from your Studio projects. Open its project to use it in the
        editor.
      </p>
      {query.isPending && <AppSkeleton className="h-40 w-full" />}
      {query.error && (
        <DataError
          message={query.error.message}
          retry={() => void query.refetch()}
        />
      )}
      {query.data?.items.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {fromBlynta
            ? "Your imported Blynta media will appear here."
            : "No media in this category yet. Upload footage to a project to get started."}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {query.data?.items.map((item) => {
          const Icon =
            item.kind === "audio"
              ? Music
              : item.kind === "image"
                ? ImageIcon
                : Film;
          return (
            <AppCard
              key={item.id}
              className="p-0 overflow-hidden"
              contentClassName="p-0"
            >
              <Link
                href={`/editor/${item.projectId}`}
                className="block hover:bg-muted/30"
              >
                <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                  {item.thumbnail ? (
                    /* Signed thumbnail is response-only, never persisted. */ <Image
                      src={item.thumbnail}
                      unoptimized
                      width={640}
                      height={360}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <Icon size={28} className="text-muted-foreground" />
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="truncate text-sm font-medium" title={item.name}>
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.kind} ·{" "}
                    {item.duration
                      ? `${Math.round(item.duration)}s`
                      : "Duration pending"}{" "}
                    · {item.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.sourceGroup || "Blynta"}
                    {item.createdAt &&
                      ` · ${new Date(item.createdAt).toLocaleDateString()}`}
                  </p>
                  <p className="text-xs text-primary">Open project →</p>
                </div>
              </Link>
            </AppCard>
          );
        })}
      </div>
      {query.data && (
        <Pagination
          page={page}
          total={query.data.totalPages}
          onChange={setPage}
        />
      )}
    </section>
  );
}
export function UsagePage() {
  const profile = useWorkspaceQuery<AccountProfile>("users/me");
  const [page, setPage] = useState(1);
  const activity = useWorkspaceQuery<{
    activities: {
      _id: string;
      title: string;
      description?: string;
      createdAt: string;
    }[];
    totalPages: number;
  }>(`activities?category=credit&limit=20&page=${page}`);
  return (
    <div className="space-y-6">
      {profile.isPending && <AppSkeleton className="h-28" />}
      {profile.error && (
        <DataError
          message={profile.error.message}
          retry={() => void profile.refetch()}
        />
      )}
      {profile.data && (
        <AppCard>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Current account plan
              </p>
              <p className="mt-2 text-lg font-semibold capitalize">
                {profile.data.plan}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Credits remaining</p>
              <p className="mt-2 text-lg font-semibold">
                {profile.data.creditsBalance}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Account credit reset date
              </p>
              <p className="mt-2 text-sm font-medium">
                {profile.data.creditsResetAt
                  ? new Date(profile.data.creditsResetAt).toLocaleDateString()
                  : "Not available"}
              </p>
            </div>
          </div>
        </AppCard>
      )}
      <p className="text-sm text-muted-foreground">
        Studio shares your Blynta account and plan. Studio-specific credit
        charges and operation history are not yet recorded.
      </p>
      {blyntaUrl && (
        <AppButton
          variant="outline"
          nativeButton={false}
          render={<a href={`${blyntaUrl.replace(/\/$/, "")}/billing`} />}
        >
          Manage plan in Blynta
        </AppButton>
      )}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Recent account credit activity
        </h2>
        {activity.isPending && <AppSkeleton className="h-24" />}
        {activity.error && (
          <DataError
            message={activity.error.message}
            retry={() => void activity.refetch()}
          />
        )}
        {activity.data?.activities.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No recorded credit activity.
          </p>
        )}
        {activity.data?.activities.map((item) => (
          <div key={item._id} className="border-b pb-3 text-sm">
            <p className="font-medium">{item.title}</p>
            <p className="text-muted-foreground text-xs mt-1">
              {item.description}
            </p>
            <time
              dateTime={item.createdAt}
              className="text-xs text-muted-foreground"
            >
              {new Date(item.createdAt).toLocaleString()}
            </time>
          </div>
        ))}
        {activity.data && (
          <Pagination
            page={page}
            total={activity.data.totalPages}
            onChange={setPage}
          />
        )}
      </section>
    </div>
  );
}
export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const query = useWorkspaceQuery<NotificationPage>(
    `notifications?page=${page}&limit=20${unread ? "&status=unread" : ""}`,
  );
  async function mark(path: string) {
    setBusy(true);
    try {
      await workspaceRequest(path, "PATCH");
      setPage(1);
      await client.invalidateQueries({ queryKey: ["workspace"] });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update notifications",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Notifications from your shared Blynta account.
      </p>
      <div className="flex flex-wrap gap-2">
        <AppButton
          size="sm"
          variant={!unread ? "default" : "outline"}
          aria-pressed={!unread}
          onClick={() => {
            setUnread(false);
            setPage(1);
          }}
        >
          All
        </AppButton>
        <AppButton
          size="sm"
          variant={unread ? "default" : "outline"}
          aria-pressed={unread}
          onClick={() => {
            setUnread(true);
            setPage(1);
          }}
        >
          Unread
        </AppButton>
        <AppButton
          size="sm"
          variant="outline"
          disabled={busy || !query.data?.notifications.length}
          onClick={() => void mark("notifications/read-all")}
        >
          Mark all as read
        </AppButton>
      </div>
      {query.isPending && <AppSkeleton className="h-32" />}
      {query.error && (
        <DataError
          message={query.error.message}
          retry={() => void query.refetch()}
        />
      )}
      {query.data?.notifications.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          You’re all caught up.
        </p>
      )}
      {query.data?.notifications.map((n) => (
        <AppCard key={n._id}>
          <div className="flex justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">
                {n.status === "unread" && (
                  <span className="text-primary">● </span>
                )}
                {n.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
              <time
                className="text-xs text-muted-foreground"
                dateTime={n.createdAt}
              >
                {new Date(n.createdAt).toLocaleString()}
              </time>
              {blyntaUrl &&
                n.actionUrl?.startsWith("/") &&
                !n.actionUrl.startsWith("//") &&
                !n.actionUrl.includes("\\") && (
                  <a
                    className="block text-xs text-primary mt-2"
                    href={`${blyntaUrl.replace(/\/$/, "")}${n.actionUrl}`}
                  >
                    {n.actionLabel || "Open in Blynta"}
                  </a>
                )}
            </div>
            {n.status === "unread" && (
              <AppButton
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void mark(`notifications/${n._id}/read`)}
              >
                Mark read
              </AppButton>
            )}
          </div>
        </AppCard>
      ))}
      {query.data && (
        <Pagination
          page={page}
          total={query.data.totalPages}
          onChange={setPage}
        />
      )}
    </section>
  );
}
