"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
export function AppAvatar({ name, src }: { name: string; src?: string }) {
  return (
    <Avatar size="sm" aria-label={name}>
      <AvatarImage src={src} alt={name} />
      <AvatarFallback className="text-[10px] font-medium bg-muted">
        {name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}
