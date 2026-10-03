"use client";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  ArrowUp,
  Check,
  RotateCcw,
  X,
  WandSparkles,
} from "lucide-react";
import { AppButton } from "@blynta/ui";
import { studioApi } from "../../api";
import { AppScrollArea } from "@/components/common/AppScrollArea";
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
    <div className="ai-proposal">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <WandSparkles size={14} className="text-primary" />
        {proposal.discarded
          ? "Proposal discarded"
          : proposal.applied
            ? `${proposal.actions.length} edits applied`
            : "Proposed edits"}
      </div>
      <ul className="mt-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
        {proposal.descriptions.map((d) => (
          <li key={d} className="flex gap-2">
            <Check size={12} className="text-primary shrink-0 mt-0.5" />
            {d}
          </li>
        ))}
      </ul>
      <div className="flex gap-2 mt-4">
        {proposal.applied ? (
          <AppButton
            size="xs"
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
      className="ai-panel ai-chat"
      aria-label="Blynta AI editing agent"
      hidden={!e.aiOpen}
    >
      <div className="ai-chat-heading">
        <div className="ai-chat-identity">
          <Sparkles size={20} />
          <div>
            <h2>Blynta AI</h2>
            <p>Your editing assistant</p>
          </div>
        </div>
        <AppButton
          size="icon-sm"
          variant="ghost"
          aria-label="Close Blynta AI"
          onClick={close}
        >
          <X />
        </AppButton>
      </div>
      <AppScrollArea className="flex-1">
        <div className="ai-history">
          {!history.length && (
            <div className="ai-welcome">
              <h3>What should we edit?</h3>
              <p>Describe an edit. Review changes before applying them.</p>
              <div className="ai-suggestions">
                {[
                  "Trim the first 5 seconds",
                  "Add captions",
                  "Make this 9:16",
                  "Lower the music volume",
                ].map((command) => (
                  <AppButton
                    key={command}
                    disabled={busy}
                    variant="outline"
                    size="sm"
                    className="suggestion-chip"
                    onClick={() => send(command)}
                  >
                    {command}
                  </AppButton>
                ))}
              </div>
            </div>
          )}
          {history.map((proposal) => (
            <div className="ai-command" key={proposal.id}>
              <p className="ai-prompt">{proposal.prompt}</p>
              <p className="mb-2 text-[10px] text-muted-foreground">
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
              className="ai-proposal text-xs flex items-center justify-between"
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
        className="ai-composer"
        onSubmit={(v) => {
          v.preventDefault();
          send();
        }}
      >
        <div className="ai-composer-box">
          <AppTextarea
            ref={input}
            aria-label="Describe an AI edit"
            placeholder="Ask Blynta to edit…"
            value={prompt}
            onChange={(v) => setPrompt(v.target.value)}
            rows={2}
            className="ai-prompt-input"
            style={{
              height: Math.min(
                112,
                64 + (prompt.match(/\n/g)?.length ?? 0) * 20,
              ),
            }}
            onInput={(event) => {
              event.currentTarget.style.height = "64px";
              event.currentTarget.style.height = `${Math.max(64, Math.min(112, event.currentTarget.scrollHeight))}px`;
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
          <div className="ai-composer-actions">
            <AppSelect
              aria-label="Editing context"
              size="sm"
              wrapperClassName="ai-context-select"
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
            <AppButton
              size="icon-sm"
              aria-label="Send AI command"
              type="submit"
              disabled={busy || !prompt.trim()}
            >
              <ArrowUp />
            </AppButton>
          </div>
        </div>
        <p className="ai-composer-hint">
          Enter to send · Shift + Enter for a new line
        </p>
      </form>
    </aside>
  );
}
