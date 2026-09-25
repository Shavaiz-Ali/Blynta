"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AppCardProps extends Omit<React.ComponentProps<typeof Card>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  headerClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  useDefaultClasses?: boolean;
}

export function AppCard({
  title,
  description,
  headerAction,
  footer,
  children,
  className,
  headerClassName,
  titleClassName,
  descriptionClassName,
  contentClassName,
  footerClassName,
  size = "default",
  useDefaultClasses = true,
  ...props
}: AppCardProps) {
  const hasHeader = Boolean(title || description || headerAction);

  return (
    <Card
      size={size}
      className={cn(
        "border-border/80 bg-card text-card-foreground shadow-xs transition-colors rounded-lg flex justify-between",
        className
      )}
      {...props}
    >
      {hasHeader && (
        <CardHeader className={headerClassName}>
          {headerAction && <CardAction>{headerAction}</CardAction>}
          {title && (
            <CardTitle
              className={cn("text-base font-bold text-foreground", titleClassName)}
            >
              {title}
            </CardTitle>
          )}
          {description && (
            <CardDescription
              className={cn("text-xs text-muted-foreground pt-0.5", descriptionClassName)}
            >
              {description}
            </CardDescription>
          )}
        </CardHeader>
      )}

      {children && <CardContent className={cn(contentClassName, "!p-3!", useDefaultClasses && "flex justify-between w-full")}>{children}</CardContent>}

      {footer && <CardFooter className={footerClassName}>{footer}</CardFooter>}
    </Card>
  );
}

export {
  Card as AppCardRoot,
  CardHeader as AppCardHeader,
  CardTitle as AppCardTitle,
  CardDescription as AppCardDescription,
  CardAction as AppCardAction,
  CardContent as AppCardContent,
  CardFooter as AppCardFooter,
};
