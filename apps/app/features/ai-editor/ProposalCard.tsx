"use client";
import { AppButton as Button } from "@blynta/ui";
import { Check } from "lucide-react";
import type { EditingPlan, Proposal, StudioAsset } from "./contracts";
import { describeChange } from "./presentation";
export function ProposalCard({
  proposal,
  plan,
  busy,
  onApply,
  onReject,
  onRevise,
  onRespond,
  assets = [],
}: {
  proposal: Proposal;
  plan?: EditingPlan;
  busy: boolean;
  onApply: () => void;
  onReject: () => void;
  onRevise?: () => void;
  onRespond?: () => void;
  assets?: StudioAsset[];
}) {
  const stale = !!plan && proposal.baseRevision !== plan.revision;
  if (proposal.status === "clarification")
    return (
      <article
        aria-label="Clarification request"
        className="space-y-2 border-l-2 border-primary/40 pl-3"
      >
        <h3 className="text-sm font-semibold">A quick question</h3>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
          {proposal.summary}
        </p>
        {onRespond && (
          <Button variant="link" size="sm" className="px-0" onClick={onRespond}>
            Answer in chat
          </Button>
        )}
      </article>
    );
  if (
    proposal.status === "applied" ||
    proposal.status === "rejected" ||
    proposal.status === "cancelled"
  )
    return (
      <article aria-label="Editing proposal" className="space-y-2 py-1">
        <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          {proposal.status === "applied" && (
            <Check className="size-3.5 text-primary" />
          )}
          {proposal.status === "applied"
            ? proposal.noChanges
              ? "No changes needed"
              : "Changes saved"
            : proposal.status === "rejected"
              ? "Suggestion rejected"
              : "Suggestion canceled"}
        </p>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            View suggestion
          </summary>
          <p className="mt-2 whitespace-pre-wrap break-words leading-6">
            {proposal.summary}
          </p>
        </details>
      </article>
    );
  return (
    <article
      className={
        proposal.status === "pending" || proposal.status === "applying"
          ? "rounded-lg border border-border/70 bg-card p-3.5"
          : "space-y-2 border-l-2 border-border py-1 pl-3"
      }
      aria-label="Editing proposal"
      role={proposal.status === "failed" ? "alert" : undefined}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {proposal.status === "pending"
            ? "Suggested edit"
            : proposal.status === "unsupported"
              ? "Edit unavailable"
              : proposal.status === "failed"
                ? "Suggestion failed"
                : proposal.status === "applying"
                  ? "Saving changes"
                  : "Preparing your suggestion"}
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {proposal.patch
            ? `${proposal.patch.changes.length} change${proposal.patch.changes.length === 1 ? "" : "s"}`
            : ""}
        </span>
      </div>
      <p className="mb-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {proposal.summary}
      </p>
      {(proposal.status === "failed" || proposal.status === "unsupported") &&
        onRespond && (
          <Button variant="link" size="sm" className="px-0" onClick={onRespond}>
            Continue in chat
          </Button>
        )}
      {proposal.patch && (
        <ol className="space-y-2">
          {proposal.patch.changes.map((change, index) => {
            const text = describeChange(change, plan);
            return (
              <li
                key={index}
                className="border-l-2 border-primary/30 py-1 pl-3"
              >
                <p className="text-sm font-medium capitalize">{text.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {text.detail}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      {proposal.patch?.changes.some(
        (c) =>
          "operation" in c &&
          assets.some(
            (a) =>
              a.assetId === c.operation.params.assetId &&
              a.sourceGroup === "generated",
          ),
      ) && (
        <p className="mt-2 text-xs text-muted-foreground">
          Includes a generated image asset.
        </p>
      )}
      {(proposal.status === "pending" || proposal.status === "applying") && (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            {stale
              ? "This suggestion uses an older revision. Reject it, then ask again to use your newer edits."
              : "Apply to save these changes and create a preview."}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              disabled={busy || (stale && proposal.status !== "applying")}
              onClick={onApply}
            >
              <Check className="size-3.5" />{" "}
              {proposal.status === "applying"
                ? "Resume approval"
                : "Apply changes"}
            </Button>
            {proposal.status === "pending" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={onReject}
              >
                Reject
              </Button>
            )}
            {proposal.status === "pending" && onRevise && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={onRevise}
              >
                Revise
              </Button>
            )}
          </div>
        </>
      )}
    </article>
  );
}
