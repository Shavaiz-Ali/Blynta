"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AdminUserItem, UpdateUserPayload, UserRole } from "../types";
import { useUpdateAdminUserMutation } from "../queries";
import { AlertTriangle, Loader2 } from "lucide-react";

interface EditUserDialogProps {
  user: AdminUserItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("user");
  const [isActive, setIsActive] = React.useState(true);
  const [emailVerified, setEmailVerified] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const mutation = useUpdateAdminUserMutation(user?._id ?? "");

  React.useEffect(() => {
    if (user) {
      setName(user.name || "");
      setRole(user.role);
      setIsActive(user.isActive);
      setEmailVerified(user.emailVerified);
      setReason("");
    }
  }, [user]);

  const isDirty =
    name !== (user?.name || "") ||
    role !== user?.role ||
    isActive !== user?.isActive ||
    emailVerified !== user?.emailVerified;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    const payload: UpdateUserPayload = {
      reason,
      ...(name !== user?.name && { name }),
      ...(role !== user?.role && { role }),
      ...(isActive !== user?.isActive && { isActive }),
      ...(emailVerified !== user?.emailVerified && { emailVerified }),
    };

    mutation.mutate(payload, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription className="truncate">
            {user?.email} — only changed fields are updated.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Display Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Display Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              disabled={mutation.isPending}
            />
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-role">Role</Label>
            <Select
              value={role}
              onValueChange={(val) => setRole(val as UserRole)}
              disabled={mutation.isPending}
            >
              <SelectTrigger id="edit-role" className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Toggles */}
          <div className="flex flex-col gap-3">
            <Label className="text-sm font-medium">Account Flags</Label>
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Account Active</p>
                  <p className="text-xs text-muted-foreground">User can log in and use the app</p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={mutation.isPending}
                />
              </div>
              <Separator className="my-0" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Email Verified</p>
                  <p className="text-xs text-muted-foreground">Mark email as verified manually</p>
                </div>
                <Switch
                  checked={emailVerified}
                  onCheckedChange={setEmailVerified}
                  disabled={mutation.isPending}
                />
              </div>
            </div>
          </div>

          {/* Audit reason — required when dirty */}
          {isDirty && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-reason" className="flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-amber-500" />
                Reason for change <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="edit-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you're making this change..."
                rows={3}
                required
                disabled={mutation.isPending}
                className="resize-none"
              />
            </div>
          )}

          <DialogFooter>
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
              disabled={!isDirty || !reason.trim() || mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
