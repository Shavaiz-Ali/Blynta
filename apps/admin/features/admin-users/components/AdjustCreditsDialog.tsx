"use client";

import * as React from "react";
import {
  AppDialog as Dialog,
  AppDialogContent as DialogContent,
  AppDialogHeader as DialogHeader,
  AppDialogTitle as DialogTitle,
  AppDialogDescription as DialogDescription,
  AppDialogFooter as DialogFooter,
} from "@/components/common/primitives";
import { AppButton as Button } from "@/components/common/primitives";
import { AppInput as Input } from "@/components/common/primitives";
import { AppLabel as Label } from "@/components/common/primitives";
import { AppTextarea as Textarea } from "@/components/common/primitives";
import { useAdjustCreditsMutation } from "@/features/admin-billing/queries";
import { Coins, Loader2, Plus, Minus } from "lucide-react";

interface AdjustCreditsDialogProps {
  userId: string | null;
  userEmail?: string;
  currentBalance?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdjustCreditsDialog({
  userId,
  userEmail,
  currentBalance = 0,
  open,
  onOpenChange,
}: AdjustCreditsDialogProps) {
  const [type, setType] = React.useState<"add" | "deduct">("add");
  const [amount, setAmount] = React.useState<number>(10);
  const [reason, setReason] = React.useState("");

  const mutation = useAdjustCreditsMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !amount || !reason.trim()) return;

    const delta = type === "add" ? Math.abs(amount) : -Math.abs(amount);

    mutation.mutate(
      {
        userId,
        payload: {
          amount: delta,
          reason,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setReason("");
          setAmount(10);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="size-5 text-primary" />
            Adjust User Credits
          </DialogTitle>
          <DialogDescription className="text-xs">
            Modify available video rendering minutes for{" "}
            <strong>{userEmail || userId}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          {/* Current balance card */}
          <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Current Credit Balance:
            </span>
            <span className="font-mono font-bold text-foreground text-sm">
              {currentBalance.toLocaleString()} minutes
            </span>
          </div>

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={type === "add" ? "default" : "outline"}
              onClick={() => setType("add")}
              className="gap-1.5 text-xs h-9"
            >
              <Plus className="size-3.5" /> Grant Credits
            </Button>
            <Button
              type="button"
              variant={type === "deduct" ? "destructive" : "outline"}
              onClick={() => setType("deduct")}
              className="gap-1.5 text-xs h-9"
            >
              <Minus className="size-3.5" /> Deduct Credits
            </Button>
          </div>

          {/* Amount input */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="credit-amount">Amount (Minutes)</Label>
            <Input
              id="credit-amount"
              type="number"
              min={1}
              max={10000}
              value={amount}
              onChange={(e) =>
                setAmount(Math.max(1, parseInt(e.target.value) || 0))
              }
              required
              disabled={mutation.isPending}
            />
          </div>

          {/* Reason */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="credit-reason">
              Audit Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="credit-reason"
              placeholder="e.g. Promotional grant, support compensation, manual refund adjustment..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={2}
              className="resize-none text-xs"
              disabled={mutation.isPending}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!amount || !reason.trim() || mutation.isPending}
              variant={type === "deduct" ? "destructive" : "default"}
            >
              {mutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {type === "add"
                ? `Grant +${amount} Minutes`
                : `Deduct -${amount} Minutes`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
