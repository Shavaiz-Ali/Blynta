"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import scrollbars from "./studio-scrollbars.module.css";
import { AppButton, AppSpinner, AppSkeleton } from "@blynta/ui";
import { AI_EDIT_STAGE_LABEL } from "@blynta/types/contracts";
import { ProposalCard } from "./ProposalCard";
import { ConversationMessage } from "./StudioPanels";
import { conversationItems, followsConversation } from "./conversation";
import { describeChange } from "./presentation";
import type {
  EditingPlan,
  Proposal,
  StudioMessage,
  StudioAsset,
} from "./contracts";

export function StudioConversation({
  messages,
  proposals,
  plan,
  loading,
  generating,
  busy,
  onApprove,
  onSuggest,
  onCancelGeneration,
  children,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  assets,
}: {
  messages: StudioMessage[];
  proposals: Proposal[];
  plan?: EditingPlan;
  loading: boolean;
  generating: boolean;
  busy: boolean;
  onApprove: (id: string, action: "apply" | "reject") => void;
  onSuggest: (text: string) => void;
  onCancelGeneration?: (id: string) => void;
  children?: React.ReactNode;
  hasOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => Promise<unknown>;
  assets?: StudioAsset[];
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [unread, setUnread] = useState(false);
  const items = conversationItems(messages, proposals);
  const signature =
    items
      .map((i) => `${i.key}:${i.message?.content}:${i.proposal?.status}`)
      .join("|") + generating;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (following.current && scroll.current) {
        scroll.current.scrollTop = scroll.current.scrollHeight;
        setUnread(false);
      } else setUnread(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [signature]);
  const empty = !loading && !items.length && !generating;
  return (
    <div
      id="studio-conversation"
      className="relative order-2 flex min-h-0 flex-1 flex-col"
    >
      <div
        ref={scroll}
        role="log"
        aria-label="Editing conversation"
        aria-live="polite"
        aria-busy={loading || generating}
        className={`${scrollbars.slim} min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 ${empty ? "flex flex-col justify-center" : ""}`}
        onScroll={() => {
          const el = scroll.current;
          if (el)
            following.current = followsConversation(
              el.scrollTop,
              el.clientHeight,
              el.scrollHeight,
            );
          if (following.current) setUnread(false);
        }}
      >
        {hasOlder && (
          <AppButton
            variant="ghost"
            size="sm"
            disabled={loadingOlder}
            onClick={async () => {
              const height = scroll.current?.scrollHeight ?? 0;
              following.current = false;
              await onLoadOlder?.();
              requestAnimationFrame(() => {
                if (scroll.current)
                  scroll.current.scrollTop +=
                    scroll.current.scrollHeight - height;
              });
            }}
          >
            {loadingOlder
              ? "Loading earlier messages…"
              : "Load earlier messages"}
          </AppButton>
        )}
        {loading && !items.length ? (
          <div
            role="status"
            aria-label="Loading conversation"
            className="space-y-5"
          >
            <AppSkeleton className="ml-auto h-16 w-4/5" />
            <div className="space-y-2">
              <AppSkeleton className="h-3 w-20" />
              <AppSkeleton className="h-4 w-full" />
              <AppSkeleton className="h-4 w-4/5" />
            </div>
          </div>
        ) : empty ? (
          <div className="w-full space-y-5 py-2">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold tracking-tight">
                Make it your own.
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Describe a change. Review the suggestion before it becomes an
                edit.
              </p>
            </div>
            <div className="space-y-1">
              {[
                "Lower the original audio to 70%.",
                "Add a smooth zoom from 00:00 to 00:03.",
              ].map((text) => (
                <AppButton
                  key={text}
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => onSuggest(text)}
                  className="h-auto w-full justify-between px-0 py-3 text-left"
                  contentClassName="w-full justify-between whitespace-normal"
                >
                  <span className="text-sm">{text}</span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                </AppButton>
              ))}
            </div>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.key} className="space-y-3">
              {item.message &&
                !(
                  item.proposal &&
                  item.message.role === "assistant" &&
                  (item.proposal.status === "clarification" ||
                    item.message.content.trim() ===
                      item.proposal.summary.trim())
                ) && (
                  <ConversationMessage
                    role={item.message.role}
                    content={item.message.content}
                  />
                )}
              {item.proposal && (
                <ProposalCard
                  assets={assets}
                  proposal={item.proposal}
                  plan={plan}
                  busy={busy}
                  onApply={() => onApprove(item.proposal!._id, "apply")}
                  onReject={() => onApprove(item.proposal!._id, "reject")}
                  onRespond={() =>
                    document.getElementById("studio-prompt")?.focus()
                  }
                  onRevise={() =>
                    onSuggest(
                      `Revise this suggestion: ${
                        item
                          .proposal!.patch?.changes.map((c) => {
                            const change = describeChange(c, plan);
                            return `${change.title} (${change.detail})`;
                          })
                          .join("; ") || item.proposal!.summary
                      }. `,
                    )
                  }
                />
              )}
            </div>
          ))
        )}
        {generating && (
          <p
            role="status"
            className="flex items-center gap-2 py-3 text-sm text-muted-foreground"
          >
            <AppSpinner size="xs" />{" "}
            {AI_EDIT_STAGE_LABEL[
              proposals.findLast((p) => p.status === "generating")?.stage ?? ""
            ] ?? "Submitting your request…"}
            {onCancelGeneration &&
              proposals.some((p) => p.status === "generating") && (
                <AppButton
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onCancelGeneration(
                      proposals.findLast((p) => p.status === "generating")!._id,
                    )
                  }
                >
                  Cancel
                </AppButton>
              )}
          </p>
        )}
        {children}
      </div>
      {unread && (
        <AppButton
          variant="secondary"
          size="sm"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md"
          onClick={() => {
            if (scroll.current)
              scroll.current.scrollTop = scroll.current.scrollHeight;
            following.current = true;
            setUnread(false);
          }}
        >
          <ArrowDown className="size-4" /> New messages
        </AppButton>
      )}
    </div>
  );
}
