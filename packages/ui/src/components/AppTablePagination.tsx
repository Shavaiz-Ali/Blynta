"use client";

import type { ComponentProps } from "react";
import { AppPagination } from "./AppPagination";

export type AppTablePaginationProps = Omit<
  ComponentProps<typeof AppPagination>,
  "variant" | "onPageSizeChange"
>;

/** One implementation of Activity's pagination, with no feature-owned state. */
export function AppTablePagination(props: AppTablePaginationProps) {
  return <AppPagination {...props} variant="activity" />;
}
