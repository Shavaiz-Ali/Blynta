"use client";
import { AppButton as Button } from "@blynta/ui";
import { RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StudioLibrary } from "./StudioPanels";
import { studioError, useEditingVersions, useEditingAssets } from "./queries";
import { editTime } from "./presentation";
import type { StudioAsset } from "./contracts";
export function StudioLibraryPanel({
  versions,
  assets,
  page,
  setPage,
  versionId,
  onVersionSelect,
  onAttach,
  generating,
  unresolvedSubmission,
}: {
  versions: ReturnType<typeof useEditingVersions>;
  assets: ReturnType<typeof useEditingAssets>;
  page: number;
  setPage: (fn: (p: number) => number) => void;
  versionId: string;
  onVersionSelect: (id: string) => void;
  onAttach: (a: StudioAsset) => void;
  generating: boolean;
  unresolvedSubmission: boolean;
}) {
  return (
    <StudioLibrary
      history={
        <div className="min-w-0">
          <p className="mt-2 text-xs text-muted-foreground">
            Watch previous renders. Your saved edits stay current.
          </p>
          <div className="mt-3 space-y-2">
            {versions.isPending ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : versions.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {studioError(versions.error)}
              </p>
            ) : !versions.data?.items.length ? (
              <p className="py-4 text-sm text-muted-foreground">
                Your rendered previews will appear here.
              </p>
            ) : (
              versions.data.items.map((v) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  key={v._id}
                  onClick={() => {
                    onVersionSelect(v._id);
                  }}
                  aria-pressed={versionId === v._id}
                  contentClassName="w-full items-center justify-between whitespace-normal"
                  className={`flex h-auto w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-xs focus-visible:ring-2 focus-visible:ring-primary ${versionId === v._id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                >
                  <div>
                    <p className="font-medium">Revision {v.revision}</p>
                    <p className="mt-1 text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="capitalize text-muted-foreground">
                    {v.status}
                  </span>
                </Button>
              ))
            )}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={(versions.data?.items.length ?? 0) < 25}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      }
      assets={
        <div className="min-w-0">
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Ready media from your library. Select a file to attach it to your
            next instruction.
          </p>
          {assets.isPending ? (
            <Skeleton className="mt-3 h-10 w-full" />
          ) : assets.isError ? (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {studioError(assets.error)}
            </p>
          ) : !assets.data?.items.length ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No ready media yet. Use Attach in the composer to upload a PNG
              image or audio file.
            </p>
          ) : (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {assets.data.items.map((asset) => (
                <li key={asset._id}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"

                    disabled={generating || unresolvedSubmission}
                    onClick={() => onAttach(asset)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="truncate">{asset.name}</span>
                    <span className="ml-3 text-muted-foreground">
                      Ready · {asset.kind}
                      {asset.duration ? ` · ${editTime(asset.duration)}` : ""}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"

            className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            onClick={() => void assets.refetch()}
          >
            <RefreshCw className="size-3" /> Refresh assets
          </Button>
        </div>
      }
    />
  );
}
