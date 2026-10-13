"use client";
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
      className={user ? "ml-5 rounded-xl bg-muted/70 px-4 py-3" : "pr-2 py-1"}
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
