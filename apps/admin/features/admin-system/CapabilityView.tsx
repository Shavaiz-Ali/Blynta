"use client";
import { useQuery } from "@tanstack/react-query";
import { configurationService, type Capability } from "./capabilities";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { AppStatusBadge } from "@/components/common/AppStatusBadge";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { AppSpinner } from "@blynta/ui";
export function CapabilityView({
  kind,
  title,
  description,
}: {
  kind: keyof typeof configurationService;
  title: string;
  description: string;
}) {
  const query = useQuery<Capability<unknown>>({
    queryKey: ["admin-capabilities", kind],
    queryFn: () => configurationService[kind](),
  });
  return (
    <div className="space-y-6">
      <AppPageHeader title={title} description={description} />
      {query.isLoading ? (
        <AppSpinner />
      ) : query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} />
      ) : query.data && !query.data.available ? (
        <section className="space-y-3 rounded-xl border border-border/70 bg-card p-6 shadow-xs">
          <AppStatusBadge status="unavailable" />
          <h2 className="text-base font-bold text-foreground">Not connected</h2>
          <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {query.data.reason}
          </p>
        </section>
      ) : null}
    </div>
  );
}
