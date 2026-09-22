"use client";

import * as React from "react";
import { AppInput } from "@/components/common/AppInput";
import { AppTextarea } from "@/components/common/AppTextarea";

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 5000;

export interface YouTubeWizardStepDetailsProps {
  title: string;
  description: string;
  onTitleChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  disabled?: boolean;
  titleError?: string;
  descriptionError?: string;
}

export function YouTubeWizardStepDetails({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  disabled,
  titleError,
  descriptionError,
}: YouTubeWizardStepDetailsProps) {
  return (
    <div className="space-y-3.5 pr-1">
      <AppInput
        label="Title"
        required
        id="yt-title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value.slice(0, TITLE_MAX))}
        placeholder="Enter a catchy title..."
        maxLength={TITLE_MAX}
        size="sm"
        disabled={disabled}
        error={titleError}
        helperText={!titleError ? `${title.length}/${TITLE_MAX}` : undefined}
      />

      <AppTextarea
        label="Description"
        id="yt-description"
        value={description}
        onChange={(e) =>
          onDescriptionChange(e.target.value.slice(0, DESCRIPTION_MAX))
        }
        placeholder="Describe your Short, add #Shorts tags..."
        rows={5}
        maxLength={DESCRIPTION_MAX}
        showCount
        disabled={disabled}
        error={descriptionError}
        helperText=""
      />
    </div>
  );
}
