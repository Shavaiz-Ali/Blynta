"use client";
import { useCallback, useSyncExternalStore } from "react";
import type { ViewMode } from "./components/ViewModeToggle";
const preferences = new Map<string, ViewMode>();
const eventName = "blynta-view-mode";
const serverSnapshot = () => null;
function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key) preferences.delete(event.key);
    else preferences.clear();
    listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(eventName, listener);
  };
}
// SSR and hydration leave geometry unknown; the client resolves storage before selecting a layout.
export function useViewMode(key: string) {
  const snapshot = useCallback((): ViewMode => {
    const current = preferences.get(key);
    if (current) return current;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === "grid" || stored === "list") return stored;
    } catch {
      /* Storage can be disabled. */
    }
    return preferences.get(key) ?? "grid";
  }, [key]);
  const mode = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const setMode = useCallback(
    (value: ViewMode) => {
      preferences.set(key, value);
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* Session fallback. */
      }
      window.dispatchEvent(new Event(eventName));
    },
    [key],
  );
  return [mode, setMode] as const;
}
