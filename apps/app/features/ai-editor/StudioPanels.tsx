"use client";
import type { ReactNode } from "react";
import { AppTabs } from "@blynta/ui";
import { History, Paperclip } from "lucide-react";

export function StudioLibrary({
  history,
  assets,
}: {
  history: ReactNode;
  assets: ReactNode;
}) {
  return (
    <section
      aria-label="Editing library"
      className="min-w-0 rounded-lg border bg-card p-4"
    >
      <AppTabs
        defaultValue="history"
        variant="default"
        size="sm"
        listClassName="w-full justify-start"
        contentClassName="mt-4"
        tabs={[
          {
            value: "history",
            label: "Preview history",
            icon: <History className="size-4" />,
            content: history,
          },
          {
            value: "assets",
            label: "Your assets",
            icon: <Paperclip className="size-4" />,
            content: assets,
          },
        ]}
      />
    </section>
  );
}

export function ConversationMessage({
  role,
  content,
}: {
  role: string;
  content: string;
}) {
  const user = role === "user";
  return (
    <div
      className={
        user
          ? "ml-6 rounded-lg bg-primary/10 px-4 py-3"
          : "border-l-2 border-primary/30 pl-4 pr-2 py-1"
      }
    >
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {user ? "You" : "Blynta"}
      </p>
      <p className="whitespace-pre-wrap break-words text-sm leading-6">
        {content}
      </p>
    </div>
  );
}
