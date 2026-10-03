import { BlyntaLogo } from "@/components/logo";
export function StudioLogo() {
  return (
    <span className="flex items-center gap-2">
      <BlyntaLogo size="sm" />
      <span className="border-l pl-2 text-xs font-medium tracking-wide text-muted-foreground">
        STUDIO
      </span>
    </span>
  );
}
