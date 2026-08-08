"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import {
  QueryClient,
  QueryClientProvider,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

/**
 * App-wide providers.
 *
 * This is a Client Component so it can host NextAuth's SessionProvider
 * and TanStack Query's QueryClientProvider — both of which require
 * React context, which cannot be rendered from Server Components.
 *
 * Place this in your root layout.tsx as:
 *     <Providers>{children}</Providers>
 * around the {children} of <body>.
 */

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Aligned with the previous axiosClient manual 5s TTL cache,
        // but now controlled by TanStack Query (single source of truth)
        // with per-query granularity + proper invalidation semantics.
        staleTime: 1000 * 5, // 5 seconds (matches prior CACHE_TTL)
        gcTime: 1000 * 60 * 5, // keep unused data in memory 5 min
        retry: (failureCount, error: any) => {
          // Don't retry 4xx-level auth/business errors; only retry transient
          // network/server 5xx problems, up to 2 total retries.
          const status = (error as any)?.status ?? undefined;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: process.env.NODE_ENV !== "development",
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false, // mutations almost always should be user-triggered once
      },
      dehydrate: {
        // Hydrate mutations (errors + pending) together with queries when
        // using SSR streaming in the future.
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

function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const queryClient = React.useMemo(() => getQueryClient(), []);

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV !== "production" ? (
          <ReactQueryDevtools initialIsOpen={false} />
        ) : null}
      </QueryClientProvider>
    </SessionProvider>
  );
}
