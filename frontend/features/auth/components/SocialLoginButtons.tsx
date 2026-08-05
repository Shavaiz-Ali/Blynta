"use client";

import * as React from "react";
import { AppButton } from "@/components/common/AppButton";

export interface SocialLoginButtonsProps {
  onFacebookClick?: () => void;
  onGoogleClick?: () => void;
  facebookLoading?: boolean;
  googleLoading?: boolean;
  className?: string;
  /** Array of enabled provider strings from GET /auth/providers */
  enabledProviders?: string[];
}

function SocialLoginButtons({
  onFacebookClick,
  onGoogleClick,
  facebookLoading,
  googleLoading,
  className,
  enabledProviders,
}: SocialLoginButtonsProps) {
  const showFacebook =
    !enabledProviders || enabledProviders.includes("facebook");
  const showGoogle =
    !enabledProviders || enabledProviders.includes("google");

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
