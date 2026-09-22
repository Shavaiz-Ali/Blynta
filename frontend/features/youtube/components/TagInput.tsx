"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface TagInputProps {
  id?: string;
  label?: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  maxTagLength?: number;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  wrapperClassName?: string;
}

/**
 * TagInput — chip-style tag input for YouTube tags.
 *
 * - Press Enter or comma to add a tag
 * - Press Backspace on empty input to remove the last tag
 * - Duplicate tags are silently ignored
 * - Max tag length and max tag count enforced
 * - Accessible: label association, role="list" on chips, keyboard-friendly
 */
export function TagInput({
  id: idProp,
  label,
  tags,
  onTagsChange,
  placeholder = "Add a tag...",
  maxTags = 30,
  maxTagLength = 100,
  error,
  helperText,
  disabled = false,
  required,
  className,
  wrapperClassName,
}: TagInputProps) {
  const autoId = React.useId();
  const inputId = idProp ?? autoId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    if (value.length > maxTagLength) return;
    if (tags.length >= maxTags) return;
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    onTagsChange([...tags, value]);
    setInputValue("");
  };

  const removeTag = (index: number) => {
    onTagsChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleBlur = () => {
    // Add the current value when the field loses focus (UX convenience)
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  };

  const isAtMax = tags.length >= maxTags;

  return (
    <div className={cn("flex w-full flex-col gap-1.5", wrapperClassName)}>
      {label && (
        <Label
          htmlFor={inputId}
          className={cn(
            "text-xs font-medium text-foreground",
            error && "text-destructive"
          )}
        >
          {label}
          {required && (
            <span className="text-destructive ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}

      {/* Tag chip container + text input */}
      <div
        className={cn(
          "min-h-[36px] w-full flex flex-wrap gap-1.5 items-center rounded-md border border-input bg-background/50 dark:bg-muted/30 px-2.5 py-1.5 transition-colors cursor-text",
          error && "border-destructive focus-within:ring-destructive",
          !error && "focus-within:ring-1 focus-within:ring-ring focus-within:border-ring",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        onClick={() => {
          if (!disabled) inputRef.current?.focus();
        }}
      >
        {/* Existing tags as chips */}
        {tags.length > 0 && (
          <ul role="list" className="contents" aria-label="Tags">
            {tags.map((tag, index) => (
              <li key={`${tag}-${index}`} className="contents">
                <span className="inline-flex items-center gap-1 rounded bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[11px] font-medium max-w-[160px]">
                  <span className="truncate">{tag}</span>
                  {!disabled && (
                    <button
                      type="button"
                      aria-label={`Remove tag "${tag}"`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTag(index);
                      }}
                      className="shrink-0 rounded hover:text-destructive focus:outline-none focus:text-destructive transition-colors"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Text input */}
        {!isAtMax && !disabled && (
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.slice(0, maxTagLength))}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={tags.length === 0 ? placeholder : ""}
            aria-label={label ? undefined : "Tag input"}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            aria-invalid={!!error}
            disabled={disabled}
            className="flex-1 min-w-[80px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none border-none p-0"
          />
        )}

        {isAtMax && (
          <span className="text-[11px] text-muted-foreground/60 italic">
            Max {maxTags} tags
          </span>
        )}
      </div>

      {/* Tag count helper */}
      <div className="flex items-center justify-between">
        {error ? (
          <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-muted-foreground">
            {helperText}
          </p>
        ) : (
          <span />
        )}
        {tags.length > 0 && (
          <span className="text-[11px] text-muted-foreground shrink-0 ml-auto">
            {tags.length}/{maxTags}
          </span>
        )}
      </div>
    </div>
  );
}
