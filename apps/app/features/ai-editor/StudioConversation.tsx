"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Sparkles } from "lucide-react";
import { AppButton, AppSpinner } from "@blynta/ui";
import { ProposalCard } from "./ProposalCard";
import { ConversationMessage } from "./StudioPanels";
import { conversationItems, followsConversation } from "./conversation";
import type { EditingPlan, Proposal, StudioMessage } from "./contracts";

export function StudioConversation({
  messages,
  proposals,
  plan,
  loading,
  generating,
  busy,
  onApprove,
  onSuggest,
  children,
}: {
  messages: StudioMessage[];
  proposals: Proposal[];
  plan?: EditingPlan;
  loading: boolean;
  generating: boolean;
  busy: boolean;
  onApprove: (id: string, action: "apply" | "reject") => void;
  onSuggest: (text: string) => void;
  children?: React.ReactNode;
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
      className="relative order-3 flex min-h-0 flex-1 flex-col lg:order-2"
    >
      <div
        ref={scroll}
        role="log"
        aria-label="Editing conversation"
        aria-live="polite"
        aria-busy={loading || generating}
        className={`themed-scrollbar min-h-60 max-h-[56dvh] flex-1 space-y-5 overflow-y-auto px-5 py-6 lg:max-h-none lg:min-h-0 ${empty ? "lg:flex lg:flex-col lg:justify-center" : ""}`}
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
        {loading ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <AppSpinner size="xs" /> Loading your conversation…
          </p>
        ) : empty ? (
          <div className="w-full space-y-5 py-2">
            <Sparkles className="size-6 text-primary" />
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
              {item.message && (
                <ConversationMessage
                  role={item.message.role}
                  content={item.message.content}
                />
              )}
              {item.proposal && (
                <ProposalCard
                  proposal={item.proposal}
                  plan={plan}
                  busy={busy}
                  onApply={() => onApprove(item.proposal!._id, "apply")}
                  onReject={() => onApprove(item.proposal!._id, "reject")}
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
            <AppSpinner size="xs" /> Preparing your suggestion…
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
