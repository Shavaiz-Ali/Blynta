import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
export function AppSeparator({
  vertical = false,
  className,
}: {
  vertical?: boolean;
  className?: string;
}) {
  return (
    <Separator
      orientation={vertical ? "vertical" : "horizontal"}
      aria-hidden="true"
      className={cn(vertical ? "mx-1 h-5 self-center" : "my-4", className)}
    />
  );
}
