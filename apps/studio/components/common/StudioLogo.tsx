import { BlyntaLogo } from "@/components/logo";
export function StudioLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <BlyntaLogo size="sm" variant={collapsed ? "icon" : "full"} />
      {!collapsed && (
        <span className="border-l pl-2 text-xs font-medium tracking-wide text-muted-foreground">
          STUDIO
        </span>
      )}
    </span>
  );
}
