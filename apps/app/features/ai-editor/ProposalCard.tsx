"use client";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import type { EditingPlan, Proposal } from "./contracts";
import { describeChange } from "./presentation";
export function ProposalCard({
  proposal,
  plan,
  busy,
  onApply,
  onReject,
}: {
  proposal: Proposal;
  plan?: EditingPlan;
  busy: boolean;
  onApply: () => void;
  onReject: () => void;
}) {
  const stale = !!plan && proposal.baseRevision !== plan.revision;
  return (
    <article
      className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4"
      aria-label="Editing proposal"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />{" "}
          {proposal.status === "pending"
            ? "Proposed changes"
            : proposal.status === "applied"
              ? "Changes applied"
              : proposal.status.replaceAll("_", " ")}
        </h3>
        <span className="text-[11px] text-muted-foreground">
          Revision {proposal.baseRevision}
        </span>
      </div>
      <p className="mb-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {proposal.summary}
      </p>
      {proposal.patch && (
        <ol className="space-y-2">
          {proposal.patch.changes.map((change, index) => {
            const text = describeChange(change, plan);
            return (
              <li key={index} className="rounded-lg border bg-background p-3">
                <p className="text-sm font-medium capitalize">
                  {index + 1}. {text.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {text.detail}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      {(proposal.status === "pending" || proposal.status === "applying") && (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            {stale
              ? "This suggestion is based on an older revision. Generate a new suggestion from the latest plan."
              : "Applying saves these changes. Rendering a preview is a separate action."}
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
          </div>
        </>
      )}
    </article>
  );
}
