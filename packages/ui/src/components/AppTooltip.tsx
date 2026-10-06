"use client";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "../primitives/tooltip";
/** Shared trigger/content composition, while retaining the primitive composition API. */
export function AppTooltip({
  content,
  children,
  ...props
}: ComponentProps<typeof Tooltip> & { content?: ReactNode }) {
  if (content === undefined || !isValidElement(children))
    return <Tooltip {...props}>{children}</Tooltip>;
  return (
    <TooltipProvider delay={350}>
      <Tooltip {...props}>
        <TooltipTrigger render={children} />
        <TooltipContent>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
