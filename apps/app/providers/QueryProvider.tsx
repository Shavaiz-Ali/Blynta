"use client";

import * as React from "react";
import { useSession } from "@blynta/auth/react";
import {
  QueryClient,
  QueryClientProvider,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 5, // 5 seconds
        gcTime: 1000 * 60 * 5, // 5 minutes
        retry: (failureCount, error) => {
          const status =
            (
              error as Error & {
                status?: number;
                response?: { status?: number };
              }
            )?.status ??
            (error as Error & { response?: { status?: number } })?.response
              ?.status ??
            undefined;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: process.env.NODE_ENV !== "development",
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        shouldDehydrateMutation: (mutation) => {
          return mutation.state.status === "pending";
        },
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;
let browserQueryOwner: string | undefined;

function getQueryClient(owner: string): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient || browserQueryOwner !== owner) {
    browserQueryClient = makeQueryClient();
    browserQueryOwner = owner;
  }
  return browserQueryClient;
}

export interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const { data: session, status } = useSession();
  const owner =
    status === "authenticated"
      ? (session?.user?.id ?? "anonymous")
      : "anonymous";
  const queryClient = React.useMemo(() => getQueryClient(owner), [owner]);
  React.useEffect(() => () => queryClient.clear(), [queryClient]);

  return (
    <QueryClientProvider key={owner} client={queryClient}>
      {children}
      {process.env.NODE_ENV !== "production" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
}
