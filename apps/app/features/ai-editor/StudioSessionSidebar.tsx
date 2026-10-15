"use client";
import { useState } from "react";
import { Plus, PanelLeftClose, MoreHorizontal } from "lucide-react";
import {
  AppButton,
  AppInput,
  AppDialog,
  AppPopover,
  AppSheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@blynta/ui";
import type { AgentSession } from "./contracts";
export function StudioSessionSidebar({
  sessions,
  selected,
  title,
  open,
  onOpenChange,
  collapsed,
  onCollapse,
  busy,
  loading,
  error,
  onRetry,
  onSelect,
  onCreate,
  onUpdate,
}: {
  sessions: AgentSession[];
  selected: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collapsed: boolean;
  onCollapse: () => void;
  busy: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onUpdate: (
    id: string,
    patch: { title?: string; status?: "active" | "archived" },
  ) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{
    session: AgentSession;
    action: "rename" | "archive";
  } | null>(null);
  const [name, setName] = useState("");
  const [failure, setFailure] = useState("");
  const content = (
    <div className="flex h-full min-h-0 flex-col gap-4 p-3">
      <div className="flex items-center justify-between gap-2">
        <p
          className="min-w-0 truncate px-1 text-xs font-medium text-muted-foreground"
          title={title}
        >
          {title}
        </p>
        <AppButton
          size="icon-sm"
          variant="ghost"
          aria-label="Collapse conversations"
          className="hidden min-[1440px]:inline-flex"
          onClick={onCollapse}
        >
          <PanelLeftClose className="size-4" />
        </AppButton>
      </div>
      <AppButton
        size="sm"
        variant="outline"
        className="justify-start"
        disabled={busy}
        onClick={onCreate}
      >
        <Plus className="size-4" />
        New chat
      </AppButton>
      {sessions.length > 5 && (
        <AppInput
          aria-label="Search conversations"
          placeholder="Search conversations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs"
        />
      )}
      <nav
        aria-label="Studio conversations"
        className="min-h-0 flex-1 space-y-1 overflow-y-auto"
      >
        {loading && (
          <p role="status" className="p-2 text-xs text-muted-foreground">
            Loading conversations…
          </p>
        )}
        {error && (
          <div role="alert" className="p-2 text-xs">
            <p>Conversations couldn’t be loaded.</p>
            <AppButton variant="link" size="sm" onClick={onRetry}>
              Retry
            </AppButton>
          </div>
        )}
        {!loading && !error && !sessions.length && (
          <p className="p-2 text-xs leading-5 text-muted-foreground">
            Start a conversation to plan your first edit.
          </p>
        )}
        {sessions
          .filter((s) =>
            (s.title || "First editing session")
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((s) => (
            <div
              key={s._id}
              className={`group flex items-center rounded-md ${selected === s._id ? "bg-accent text-accent-foreground" : "hover:bg-muted/70"}`}
            >
              <button
                type="button"
                disabled={busy}
                aria-current={selected === s._id ? "page" : undefined}
                onClick={() => {
                  onSelect(s._id);
                  onOpenChange(false);
                }}
                className="min-w-0 flex-1 truncate rounded-md px-2.5 py-3 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                title={s.title || "First editing session"}
              >
                {s.title || "First editing session"}
              </button>
              <AppPopover
                title="Conversation actions"
                trigger={
                  <AppButton
                    size="icon-xs"
                    variant="ghost"
                    disabled={busy}
                    aria-label={`Actions for ${s.title || "conversation"}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </AppButton>
                }
              >
                <div className="p-1">
                  {(["rename", "archive"] as const).map((action) => (
                    <AppButton
                      key={action}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        setEditing({ session: s, action });
                        setName(s.title || "First editing session");
                        setFailure("");
                      }}
                    >
                      {action === "rename" ? "Rename" : "Archive conversation"}
                    </AppButton>
                  ))}
                </div>
              </AppPopover>
            </div>
          ))}
      </nav>
      <p className="px-1 text-[11px] leading-5 text-muted-foreground">
        Conversations share this clip’s saved edits.
      </p>
    </div>
  );
  return (
    <>
      {!collapsed && (
        <aside
          aria-label="Studio sessions"
          className="hidden w-52 shrink-0 border-r border-border/50 bg-muted/20 min-[1440px]:block"
        >
          {content}
        </aside>
      )}
      <AppSheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-72 gap-0">
          <SheetHeader>
            <SheetTitle>Conversations</SheetTitle>
            <SheetDescription>
              Editing conversations for this clip.
            </SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </AppSheet>
      <AppDialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
        title={
          editing?.action === "rename"
            ? "Rename conversation"
            : "Archive conversation?"
        }
        description={
          editing?.action === "rename"
            ? "Choose a title that’s easy to find."
            : "The conversation will leave this list. Saved edits and conversation history are preserved."
        }
        size="sm"
        footer={
          <>
            <AppButton variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </AppButton>
            <AppButton
              disabled={busy || (editing?.action === "rename" && !name.trim())}
              onClick={async () => {
                if (!editing) return;
                try {
                  await onUpdate(
                    editing.session._id,
                    editing.action === "rename"
                      ? { title: name.trim() }
                      : { status: "archived" },
                  );
                  setEditing(null);
                } catch {
                  setFailure("Couldn’t update the conversation. Please retry.");
                }
              }}
            >
              {editing?.action === "rename" ? "Save name" : "Archive"}
            </AppButton>
          </>
        }
      >
        {editing?.action === "rename" && (
          <AppInput
            aria-label="Conversation title"
            autoFocus
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        {failure && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {failure}
          </p>
        )}
      </AppDialog>
    </>
  );
}
