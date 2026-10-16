"use client";
import { useEffect, useRef, useState } from "react";
import type { AgentSession } from "./contracts";
export function latestStudioSession(sessions: AgentSession[]) {
  return sessions
    .filter((s) => !s.status || s.status === "active")
    .reduce<AgentSession | undefined>(
      (latest, session) =>
        !latest ||
        (session.updatedAt &&
          (!latest.updatedAt || session.updatedAt > latest.updatedAt))
          ? session
          : latest,
      undefined,
    );
}
// Session storage keeps drafts private to this browser tab and scopes them to the account.
export function useStudioPreferences(
  owner: string,
  clip: string,
  sessions: AgentSession[] | undefined,
) {
  const key = owner ? `blynta:studio:${owner}:${clip}` : "";
  const loaded = useRef("");
  const [selected, setSelected] = useState("");
  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState("auto");
  const [tab, setTab] = useState("preview");
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const memory = useRef<Record<string, { prompt: string; modelId: string }>>(
    {},
  );
  function read() {
    try {
      return JSON.parse(sessionStorage.getItem(key) || "{}");
    } catch {
      return {};
    }
  }
  function save(patch: object) {
    if (!key) return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ ...read(), ...patch }));
    } catch {
      /* Editing remains available when storage is unavailable. */
    }
  }
  useEffect(() => {
    if (!key || !sessions || loaded.current === key) return;
    loaded.current = key;
    let stored: {
      selected?: string;
      tab?: string;
      collapsed?: boolean;
      drafts?: typeof memory.current;
    } = {};
    try {
      stored = JSON.parse(sessionStorage.getItem(key) || "{}");
    } catch {
      /* Use defaults. */
    }
    memory.current = stored.drafts || {};
    const id = latestStudioSession(sessions)?._id || "";
    setSelected(id);
    setPrompt(memory.current[id]?.prompt || "");
    setModelId(
      memory.current[id]?.modelId ||
        sessions.find((s) => s._id === id)?.selectedModelId ||
        "auto",
    );
    setTab(stored.tab === "chat" ? "chat" : "preview");
    setCollapsed(!!stored.collapsed);
    setReady(true);
  }, [key, sessions]);
  function select(id: string) {
    memory.current[selected] = { prompt, modelId };
    setSelected(id);
    setPrompt(memory.current[id]?.prompt || "");
    setModelId(
      memory.current[id]?.modelId ||
        sessions?.find((s) => s._id === id)?.selectedModelId ||
        "auto",
    );
    save({ selected: id, drafts: memory.current });
  }
  function changePrompt(value: string) {
    setPrompt(value);
    memory.current[selected] = { prompt: value, modelId };
    save({ drafts: memory.current });
  }
  function changeModel(value: string) {
    setModelId(value);
    memory.current[selected] = { prompt, modelId: value };
    save({ drafts: memory.current });
  }
  return {
    ready,
    selected,
    select,
    prompt,
    setPrompt: changePrompt,
    modelId,
    setModelId: changeModel,
    tab,
    setTab: (value: string) => {
      setTab(value);
      save({ tab: value });
    },
    collapsed,
    toggleCollapsed: () => {
      setCollapsed(!collapsed);
      save({ collapsed: !collapsed });
    },
  };
}
