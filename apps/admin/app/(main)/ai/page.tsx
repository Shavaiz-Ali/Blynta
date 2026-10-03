import { CapabilityView } from "@/features/admin-system/CapabilityView";
export default function Page() {
  return (
    <CapabilityView
      kind="aiUsage"
      title="AI & usage"
      description="Usage by provider, model, and feature."
    />
  );
}
