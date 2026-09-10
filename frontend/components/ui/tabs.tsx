"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-md p-1 text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default:
          "bg-muted/80 dark:bg-muted/50 border border-border/80 shadow-2xs backdrop-blur-sm gap-1",
        primary:
          "bg-muted/80 dark:bg-muted/50 border border-border/80 shadow-2xs backdrop-blur-sm gap-1",
        line:
          "gap-4 bg-transparent border-b border-border/60 rounded-none p-0",
        pills:
          "bg-muted/60 dark:bg-muted/40 border border-border/60 p-1 rounded-md gap-1",
      },
      size: {
        xs: "group-data-horizontal/tabs:h-7 p-0.5",
        sm: "group-data-horizontal/tabs:h-8 p-1",
        default: "group-data-horizontal/tabs:h-9 p-1",
        lg: "group-data-horizontal/tabs:h-10 p-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  size = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      data-size={size}
      className={cn(tabsListVariants({ variant, size }), className)}
      {...props}
    />
  )
}

const tabsTriggerVariants = cva(
  "relative inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent font-medium whitespace-nowrap text-muted-foreground transition-all duration-200 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground hover:bg-background/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 cursor-pointer select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "data-selected:bg-background data-selected:text-foreground data-selected:border-border/80 data-selected:shadow-xs data-selected:font-semibold data-active:bg-background data-active:text-foreground data-active:border-border/80 data-active:shadow-xs data-active:font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:border-border/80 data-[state=active]:shadow-xs data-[state=active]:font-semibold aria-selected:bg-background aria-selected:text-foreground aria-selected:border-border/80 aria-selected:shadow-xs aria-selected:font-semibold",
        primary:
          "data-selected:bg-primary data-selected:text-primary-foreground data-selected:border-primary data-selected:shadow-xs data-selected:font-semibold data-active:bg-primary data-active:text-primary-foreground data-active:border-primary data-active:shadow-xs data-active:font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-xs data-[state=active]:font-semibold aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:border-primary aria-selected:shadow-xs aria-selected:font-semibold",
        line:
          "data-selected:bg-transparent data-selected:text-primary data-selected:border-transparent data-selected:border-b-2 data-selected:border-primary data-selected:rounded-none data-selected:shadow-none data-active:bg-transparent data-active:text-primary data-active:border-transparent data-active:border-b-2 data-active:border-primary data-active:rounded-none data-active:shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none data-[state=active]:shadow-none aria-selected:bg-transparent aria-selected:text-primary aria-selected:border-transparent aria-selected:border-b-2 aria-selected:border-primary aria-selected:rounded-none aria-selected:shadow-none",
        pills:
          "data-selected:bg-primary data-selected:text-primary-foreground data-selected:border-primary data-selected:shadow-xs data-selected:font-semibold data-active:bg-primary data-active:text-primary-foreground data-active:border-primary data-active:shadow-xs data-active:font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-xs data-[state=active]:font-semibold aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:border-primary aria-selected:shadow-xs aria-selected:font-semibold",
      },
      size: {
        xs: "px-2 py-0.5 text-[11px] h-6",
        sm: "px-2.5 py-0.5 text-xs h-6",
        default: "px-3 py-1 text-xs h-7",
        lg: "px-4 py-1.5 text-sm h-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function TabsTrigger({
  className,
  variant,
  size,
  ...props
}: TabsPrimitive.Tab.Props & VariantProps<typeof tabsTriggerVariants>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant, size }), className)}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
  tabsTriggerVariants,
}
