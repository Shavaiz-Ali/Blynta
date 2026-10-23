"use client";

import Link from "next/link";
import {
  Coins,
  Lock,
  Unlock,
  Minus,
  Undo2,
  SlidersHorizontal,
  ArrowRight,
} from "lucide-react";
import {
  AppBadge,
  AppButton,
  AppTableRow,
  appTableRowActionClassName,
} from "@blynta/ui";
import {
  CREDIT_PRODUCT,
  CREDIT_TRANSACTION_TYPE,
  type CreditTransaction,
} from "@blynta/types";
import { APP_ROUTES } from "@blynta/types/contracts";

const presentation = {
  [CREDIT_TRANSACTION_TYPE.RESERVE]: { label: "Reserved", Icon: Lock },
  [CREDIT_TRANSACTION_TYPE.RELEASE]: { label: "Released", Icon: Unlock },
  [CREDIT_TRANSACTION_TYPE.CHARGE]: { label: "Charged", Icon: Minus },
  [CREDIT_TRANSACTION_TYPE.GRANT]: { label: "Credit grant", Icon: Coins },
  [CREDIT_TRANSACTION_TYPE.REFUND]: { label: "Refund", Icon: Undo2 },
  [CREDIT_TRANSACTION_TYPE.ADJUSTMENT]: {
    label: "Adjustment",
    Icon: SlidersHorizontal,
  },
  [CREDIT_TRANSACTION_TYPE.OPENING]: { label: "Opening balance", Icon: Coins },
};

function creditAmount(entry: CreditTransaction) {
  if (entry.type === CREDIT_TRANSACTION_TYPE.RESERVE)
    return `${entry.amount.toLocaleString()} held`;
  if (entry.type === CREDIT_TRANSACTION_TYPE.RELEASE)
    return `${entry.amount.toLocaleString()} unlocked`;
  if (entry.type === CREDIT_TRANSACTION_TYPE.CHARGE)
    return `−${entry.amount.toLocaleString()}`;
  return `${entry.availableDelta >= 0 ? "+" : "−"}${Math.abs(entry.availableDelta).toLocaleString()}`;
}

export function CreditHistoryItem({ entry }: { entry: CreditTransaction }) {
  const { label, Icon } = presentation[entry.type];
  const jobUrl =
    entry.relatedId && entry.product === CREDIT_PRODUCT.AI_CLIPS
      ? APP_ROUTES.job(entry.relatedId)
      : undefined;
  return (
    <AppTableRow
      icon={<Icon className="h-4 w-4 text-primary" />}
      iconClassName="bg-primary/10 text-primary border-primary/20"
      title={label}
      description={entry.description}
      badges={
        <>
          <AppBadge
            variant="secondary"
            className="bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold px-2 py-0.5 tabular-nums"
          >
            {creditAmount(entry)}
            {entry.type !== CREDIT_TRANSACTION_TYPE.RESERVE &&
            entry.type !== CREDIT_TRANSACTION_TYPE.RELEASE
              ? " credits"
              : ""}
          </AppBadge>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground inline-block" />
            <span>Recorded</span>
          </span>
        </>
      }
      metadata={
        entry.relatedId && !jobUrl ? (
          <span className="text-[11px] text-muted-foreground break-all">
            Reference: {entry.relatedId}
          </span>
        ) : undefined
      }
      timestamp={
        <time dateTime={entry.createdAt}>
          {new Date(entry.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
      }
      timestampTitle={new Date(entry.createdAt).toLocaleString()}
      action={
        jobUrl && (
          <Link href={jobUrl} className="shrink-0">
            <AppButton
              variant="outline"
              size="sm"
              icon={<ArrowRight className="h-3 w-3 opacity-70" />}
              iconPosition="right"
              className={appTableRowActionClassName}
            >
              View video
            </AppButton>
          </Link>
        )
      }
    />
  );
}
