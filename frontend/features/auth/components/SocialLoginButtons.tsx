"use client";

import * as React from "react";
import { AppButton } from "@/components/common/AppButton";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuthProvider } from "@/features/auth/types";
import { useEnabledProviders } from "@/features/auth/queries";

export interface SocialLoginButtonsProps {
  onFacebookClick?: () => void;
  onGoogleClick?: () => void;
  facebookLoading?: boolean;
  googleLoading?: boolean;
  className?: string;
  /** Initial providers from SSR */
  initialProviders?: AuthProvider[];
  /** Controlled enabled providers if explicitly provided */
  enabledProviders?: AuthProvider[];
  /** Loading state override */
  isLoading?: boolean;
}

export function SocialLoginButtonsSkeleton({ className }: { className?: string }) {
  return (
    <div className={className ? className : "grid grid-cols-2 gap-3"}>
      <div className="h-10 w-full rounded-xl bg-card/60 border border-border/80 flex items-center justify-center gap-2 shadow-xs animate-pulse">
        <Skeleton className="h-4 w-4 rounded-full bg-muted-foreground/20" />
        <Skeleton className="h-3.5 w-16 rounded-md bg-muted-foreground/20" />
      </div>
      <div className="h-10 w-full rounded-xl bg-card/60 border border-border/80 flex items-center justify-center gap-2 shadow-xs animate-pulse">
        <Skeleton className="h-4 w-4 rounded-full bg-muted-foreground/20" />
        <Skeleton className="h-3.5 w-14 rounded-md bg-muted-foreground/20" />
      </div>
    </div>
  );
}

function SocialLoginButtons({
  onFacebookClick,
  onGoogleClick,
  facebookLoading,
  googleLoading,
  className,
  initialProviders,
  enabledProviders: controlledProviders,
  isLoading: forcedLoading,
}: SocialLoginButtonsProps) {
  const { data: fetchedProviders, isLoading: queryLoading } = useEnabledProviders({
    initialData: initialProviders,
  });

  const isLoading = forcedLoading ?? (queryLoading && !initialProviders && !controlledProviders);

  if (isLoading) {
    return <SocialLoginButtonsSkeleton className={className} />;
  }

  const effectiveProviders = controlledProviders ?? fetchedProviders ?? ["google", "facebook"];
  const showFacebook = effectiveProviders.includes("facebook");
  const showGoogle = effectiveProviders.includes("google");

  // If no social providers are enabled, render nothing
  if (!showFacebook && !showGoogle) return null;

  return (
    <div className={className ? className : "grid grid-cols-2 gap-3"}>
      {showFacebook && (
        <AppButton
          variant="social"
          socialProvider="facebook"
          type="button"
          isLoading={facebookLoading}
          onClick={onFacebookClick}
        >
          Facebook
        </AppButton>
      )}
      {showGoogle && (
        <AppButton
          variant="social"
          socialProvider="google"
          type="button"
          isLoading={googleLoading}
          onClick={onGoogleClick}
        >
          Google
        </AppButton>
      )}
    </div>
  );
}

export { SocialLoginButtons };

