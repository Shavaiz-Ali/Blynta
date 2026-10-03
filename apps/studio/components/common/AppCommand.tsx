"use client";
import type { ReactNode } from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
export function AppCommand({
  label,
  placeholder = "Search commands…",
  items,
}: {
  label: string;
  placeholder?: string;
  items: {
    id: string;
    label: string;
    icon?: ReactNode;
    onSelect: () => void;
    disabled?: boolean;
  }[];
}) {
  return (
    <Command aria-label={label} className="rounded-md! border">
      <CommandInput aria-label={label} placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        <CommandGroup>
          {items.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.id}`}
              disabled={item.disabled}
              onSelect={item.onSelect}
            >
              {item.icon}
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
