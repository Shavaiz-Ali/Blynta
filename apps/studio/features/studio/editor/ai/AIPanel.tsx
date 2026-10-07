"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  RotateCcw,
  X,
  WandSparkles,
  Scissors,
  Captions,
  Smartphone,
  Volume2,
} from "lucide-react";
import { AppButton, AppTooltip } from "@blynta/ui";
import { studioApi } from "../../api";
import { AppScrollArea } from "@blynta/ui";
import { AppTextarea } from "@blynta/ui";
import { AppSelect } from "@blynta/ui";
import { useEditor } from "../hooks/useEditor";

import { applyAIActions } from "../stores/editor-store";
import type { AIProposal, EditorDocument } from "../../types";
function AIProposalResult({
  proposal,
  onApply,
  onDiscard,
  onUndo,
  canUndo,
}: {
  proposal: AIProposal;
  onApply: () => void;
  onDiscard: () => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  return (
    <div
      className="rounded-lg bg-muted/40 p-3 ring-1 ring-border/50"
      data-ai-proposal
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <WandSparkles size={14} className="text-primary" />
        {proposal.discarded
          ? "Proposal discarded"
          : proposal.applied
            ? `${proposal.actions.length} edits applied`
            : `I’ll make ${proposal.actions.length} ${proposal.actions.length === 1 ? "change" : "changes"}`}
      </div>
      <ul className="mt-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
        {proposal.descriptions.map((d) => (
          <li key={d} className="flex gap-2">
            <Check size={12} className="text-primary shrink-0 mt-0.5" />
            {d}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {proposal.applied ? (
          <AppButton
            size="sm"
            variant="outline"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <RotateCcw />
            Undo changes
          </AppButton>
        ) : (
          !proposal.discarded && (
            <>
              <AppButton size="xs" onClick={onApply}>
                <Check />
                Apply {proposal.actions.length}{" "}
                {proposal.actions.length === 1 ? "edit" : "edits"}
              </AppButton>
              <AppButton size="xs" variant="ghost" onClick={onDiscard}>
                <X />
                Discard
              </AppButton>
            </>
          )
        )}
      </div>
    </div>
  );
}
export function AIPanel() {
  const e = useEditor();
  const { aiOpen, setAiOpen } = e;
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scope, setScope] = useState("project");
  const [history, setHistory] = useState<AIProposal[]>([]);
  const [appliedDoc, setAppliedDoc] = useState<EditorDocument | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const snapshots = useRef(new Map<string, EditorDocument>());
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  function close() {
    e.setAiOpen(false);
    requestAnimationFrame(() =>
      document.getElementById("editor-ai-launcher")?.focus(),
    );
  }
  useEffect(() => {
    if (!aiOpen) return;
    const frame = requestAnimationFrame(() =>
      input.current?.focus({ preventScroll: true }),
    );
    const escape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        document.querySelector('[role="listbox"]')
      )
        return;
      event.preventDefault();
      setAiOpen(false);
      requestAnimationFrame(() =>
        document.getElementById("editor-ai-launcher")?.focus(),
      );
    };
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", escape);
    };
  }, [aiOpen, setAiOpen]);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (e.aiOpen && (history.length || busy))
      end.current?.scrollIntoView({ block: "nearest" });
  }, [history, busy, e.aiOpen]);
  function cancel() {
    request.current?.abort();
    setBusy(false);
  }
  async function send(value = prompt) {
    if (!value.trim() || busy) return;
    if (scope === "clip" && !e.selected) {
      setError("Select a timeline clip first.");
      return;
    }
    setBusy(true);
    setError("");
    const doc = e.history.present;
    const targetId = scope === "clip" ? (e.selectedId ?? undefined) : undefined;
    request.current = new AbortController();
    try {
      const proposal = await studioApi.propose(
        e.projectId,
        value,
        doc,
        targetId,
        request.current.signal,
      );
      snapshots.current.set(proposal.id, doc);
      setHistory((h) => [...h, proposal]);
      setPrompt("");
    } catch (err) {
      if (request.current?.signal.aborted) return;
      void e.refreshMedia();
      setError(
        err instanceof Error ? err.message : "Couldn’t prepare the edit.",
      );
    }
    setBusy(false);
  }
  return (
    <aside
      id="editor-ai-chat"
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card [&[hidden]]:hidden"
      data-ai-workspace
      aria-label="Blynta AI editing agent"
      hidden={!e.aiOpen}
    >
      <div
        className="flex h-14 shrink-0 items-center justify-between gap-2 px-4"
        data-ai-header
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div>
            <h2 className="text-sm font-semibold">Blynta AI</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your editing assistant
            </p>
          </div>
        </div>
        <AppTooltip content="Close AI workspace">
          <AppButton
            size="icon"
            variant="ghost"
            aria-label="Close Blynta AI"
            onClick={close}
          >
            <X className="size-4" />
          </AppButton>
        </AppTooltip>
      </div>
      <AppScrollArea className="min-h-0 flex-1" data-ai-content>
        <div className="space-y-5 px-4 py-3">
          {!history.length && (
            <div className="space-y-3" data-ai-empty-state>
              <h3 className="text-sm font-medium">What should we edit?</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Describe a change. Blynta prepares the edits for you to review
                and apply.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1" data-ai-suggestions>
                {[
                  {
                    label: "Trim first 5s",
                    command: "Trim the first 5 seconds",
                    Icon: Scissors,
                  },
                  {
                    label: "Add captions",
                    command: "Add captions",
                    Icon: Captions,
                  },
                  {
                    label: "Make 9:16",
                    command: "Make this 9:16",
                    Icon: Smartphone,
                  },
                  {
                    label: "Lower music",
                    command: "Lower the music volume",
                    Icon: Volume2,
                  },
                ].map(({ label, command, Icon }) => (
                  <AppButton
                    key={command}
                    disabled={busy}
                    variant="ghost"
                    size="sm"
                    aria-label={command}
                    className="h-10 w-full justify-start bg-muted/50 px-2 text-xs font-normal hover:bg-accent"
                    contentClassName="w-full justify-start gap-2"
                    onClick={() => send(command)}
                  >
                    <Icon className="size-3.5 shrink-0 text-primary/80" />
                    {label}
                  </AppButton>
                ))}
              </div>
            </div>
          )}
          {history.map((proposal) => (
            <div className="space-y-2" key={proposal.id}>
              <p className="ml-6 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed [overflow-wrap:anywhere]">
                {proposal.prompt}
              </p>
              <p className="text-xs text-muted-foreground">
                {proposal.scope === "clip" ? "Selected clip" : "Entire project"}
              </p>
              <AIProposalResult
                proposal={proposal}
                canUndo={
                  appliedId === proposal.id && e.history.present === appliedDoc
                }
                onApply={() => {
                  if (
                    e.history.present !== snapshots.current.get(proposal.id)
                  ) {
                    setError(
                      "Timeline changed since this proposal. Request a fresh proposal before applying.",
                    );
                    return;
                  }
                  if (
                    proposal.targetClipId &&
                    !e.doc.clips.some((c) => c.id === proposal.targetClipId)
                  ) {
                    setError(
                      "That clip was removed. Discard this proposal and select a new clip.",
                    );
                    return;
                  }
                  let next: EditorDocument;
                  try {
                    next = applyAIActions(e.doc, proposal.actions);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Could not apply this proposal.",
                    );
                    return;
                  }
                  e.edit(() => next);
                  setAppliedDoc(next);
                  setAppliedId(proposal.id);
                  setHistory((h) =>
                    h.map((p) =>
                      p.id === proposal.id ? { ...p, applied: true } : p,
                    ),
                  );
                }}
                onDiscard={() =>
                  setHistory((h) =>
                    h.map((p) =>
                      p.id === proposal.id ? { ...p, discarded: true } : p,
                    ),
                  )
                }
                onUndo={() => {
                  e.undo();
                  setHistory((h) =>
                    h.map((p) =>
                      p.id === proposal.id ? { ...p, applied: false } : p,
                    ),
                  );
                  setAppliedDoc(null);
                  setAppliedId(null);
                }}
              />
            </div>
          ))}
          {e.mediaStatus.some((a) =>
            ["queued", "processing"].includes(a.transcriptStatus || ""),
          ) && (
            <p role="status" className="text-xs text-muted-foreground">
              Transcribing source audio. Try Add captions when processing
              completes.
            </p>
          )}
          {busy && (
            <div
              className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-3 text-xs"
              role="status"
            >
              Preparing an edit proposal…
              <AppButton variant="ghost" size="xs" onClick={cancel}>
                Cancel
              </AppButton>
            </div>
          )}
          {error && (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive leading-relaxed"
              role="alert"
            >
              {error}
            </p>
          )}
          <div ref={end} />
        </div>
      </AppScrollArea>
      <form
        className="shrink-0 px-3 pb-3 pt-2"
        data-ai-composer
        onSubmit={(v) => {
          v.preventDefault();
          send();
        }}
      >
        <div className="rounded-xl bg-muted/40 p-3 ring-1 ring-border/70 transition-shadow focus-within:ring-ring/70">
          <AppTextarea
            ref={input}
            aria-label="Describe an AI edit"
            aria-describedby="ai-composer-shortcuts"
            placeholder="Ask Blynta to edit…"
            value={prompt}
            onChange={(v) => setPrompt(v.target.value)}
            rows={2}
            className="min-h-12 resize-none border-0 bg-transparent p-0 text-sm leading-5 shadow-none focus-visible:ring-0"
            style={{
              height: Math.min(
                104,
                48 + (prompt.match(/\n/g)?.length ?? 0) * 20,
              ),
            }}
            onInput={(event) => {
              event.currentTarget.style.height = "48px";
              event.currentTarget.style.height = `${Math.max(48, Math.min(104, event.currentTarget.scrollHeight))}px`;
            }}
            onKeyDown={(v) => {
              if (
                v.key === "Enter" &&
                !v.shiftKey &&
                !v.nativeEvent.isComposing
              ) {
                v.preventDefault();
                send();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <AppSelect
              aria-label="Editing context"
              size="sm"
              wrapperClassName="w-40!"
              triggerClassName="h-7 border-0 bg-transparent px-1 text-xs shadow-none dark:bg-transparent hover:bg-muted"
              value={scope}
              onValueChange={setScope}
              options={[
                { value: "project", label: "Entire project" },
                {
                  value: "clip",
                  label: "Selected clip",
                  disabled: !e.selected,
                },
              ]}
            />
            <AppTooltip content="Enter to send · Shift + Enter for a new line">
              <AppButton
                size="icon"
                className="rounded-full"
                aria-label="Send AI command"
                type="submit"
                disabled={busy || !prompt.trim()}
              >
                <ArrowUp className="size-4" />
              </AppButton>
            </AppTooltip>
          </div>
        </div>
        <p id="ai-composer-shortcuts" className="sr-only">
          Enter to send · Shift + Enter for a new line
        </p>
      </form>
    </aside>
  );
}
