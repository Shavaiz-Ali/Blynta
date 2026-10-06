"use client";
import { Avatar, AvatarImage, AvatarFallback } from "../primitives/avatar";
export function AppIdentityAvatar({
  name,
  src,
}: {
  name: string;
  src?: string | null;
}) {
  const initials = (name || "?")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Avatar className="h-8 w-8 rounded-lg overflow-hidden" aria-label={name}>
      {src && <AvatarImage src={src} alt={name} className="object-cover" />}
      <AvatarFallback className="rounded-lg bg-primary/15 text-primary text-xs font-bold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
