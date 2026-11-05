"use client";
import { useState } from "react";
import { AppTabs } from "@blynta/ui";
import { CapabilityView } from "./CapabilityView";
export function SettingsView() {
  const [section, setSection] = useState("General");
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <AppTabs
          value={section}
          onValueChange={setSection}
          tabs={[
            "General",
            "Security",
            "Authentication",
            "AI",
            "Storage",
            "Email",
            "Integrations",
          ].map((value) => ({ value, label: value }))}
        />
      </div>
      <CapabilityView
        kind="settings"
        title={`${section} settings`}
        description={`Platform ${section.toLowerCase()} configuration.`}
      />
      {section === "Security" && (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground block mb-1">Access Control Policy:</strong>
          Only the backend administrator role currently possesses console authorization. Support, auditor, and
          analyst roles require backend role-permission mapping before they can be assigned.
        </div>
      )}
    </div>
  );
}
