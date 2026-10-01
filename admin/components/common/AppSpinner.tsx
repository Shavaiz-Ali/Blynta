import { Loader2 } from "lucide-react";
export function AppSpinner({ size = "sm" }: { size?: "sm" | "md" | "lg" }) { return <Loader2 role="status" aria-label="Loading" className={`${size === "lg" ? "size-8" : "size-4"} animate-spin text-muted-foreground`} />; }
