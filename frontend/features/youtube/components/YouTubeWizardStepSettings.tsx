"use client";

import * as React from "react";
import { AppSelect, AppSelectOption } from "@/components/common/AppSelect";
import { AppSpinner } from "@/components/common/AppSpinner";
import { TagInput } from "./TagInput";

export const PRIVACY_OPTIONS: AppSelectOption[] = [
  {
    value: "private",
    label: "Private",
    description: "Only you and people you choose can watch",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description: "Anyone with the video link can watch",
  },
  {
    value: "public",
    label: "Public",
    description: "Everyone can see and find your video",
  },
];

export interface YouTubeWizardStepSettingsProps {
  categoryId: string;
  onCategoryChange: (val: string) => void;
  categoryOptions: AppSelectOption[];
  isCategoriesLoading: boolean;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  privacyStatus: "private" | "unlisted" | "public";
  onPrivacyChange: (val: "private" | "unlisted" | "public") => void;
  disabled?: boolean;
  tagsError?: string;
}

export function YouTubeWizardStepSettings({
  categoryId,
  onCategoryChange,
  categoryOptions,
  isCategoriesLoading,
  tags,
  onTagsChange,
  privacyStatus,
  onPrivacyChange,
  disabled,
  tagsError,
}: YouTubeWizardStepSettingsProps) {
  return (
    <div className="space-y-3.5 pr-1">
      {/* Category */}
      <div>
        {isCategoriesLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground h-[36px]">
            <AppSpinner size="xs" />
            <span>Loading categories...</span>
          </div>
        ) : (
          <AppSelect
            label="Category"
            id="yt-category"
            options={categoryOptions}
            value={categoryId}
            onValueChange={onCategoryChange}
            placeholder="Select a category"
            size="sm"
            disabled={disabled}
          />
        )}
      </div>

      {/* Tags */}
      <TagInput
        label="Tags (SEO Keywords)"
        id="yt-tags"
        tags={tags}
        onTagsChange={onTagsChange}
        placeholder="Add a tag and press Enter..."
        maxTags={30}
        maxTagLength={100}
        disabled={disabled}
        helperText="Auto-populated from AI keywords · Press Enter to add · Backspace to remove"
        error={tagsError}
      />

      {/* Visibility */}
      <AppSelect
        label="Visibility"
        id="yt-visibility"
        options={PRIVACY_OPTIONS}
        value={privacyStatus}
        onValueChange={(val) =>
          onPrivacyChange(val as "private" | "unlisted" | "public")
        }
        size="sm"
        disabled={disabled}
      />
    </div>
  );
}
