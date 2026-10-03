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
        <p className="text-sm text-muted-foreground">
          Only the backend admin role currently has console access. Support and
          analyst roles require backend permission enforcement before they can
          be enabled.
        </p>
      )}
    </div>
  );
}
