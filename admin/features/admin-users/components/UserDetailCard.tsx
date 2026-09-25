"use client";

import * as React from "react";
import { UserDetailResponse } from "../types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Mail,
  Shield,
  Coins,
  Calendar,
  CreditCard,
  Activity,
  Briefcase,
  Hash,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "cn";

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
        <div className="text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

const subStatusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  trialing: "secondary",
  past_due: "destructive",
  canceled: "destructive",
  paused: "outline",
};

interface UserDetailCardProps {
  detail: UserDetailResponse;
}

export function UserDetailCard({ detail }: UserDetailCardProps) {
  const { user, customer, recentActivities = [], stats, jobsCount } = detail;

  const statItems = [
    { label: "Total Jobs", value: stats?.totalJobs ?? jobsCount ?? 0, icon: <Briefcase className="size-4 text-primary" /> },
    { label: "Completed", value: stats?.completedJobs ?? 0, icon: <CheckCircle2 className="size-4 text-emerald-500" /> },
    { label: "Failed", value: stats?.failedJobs ?? 0, icon: <XCircle className="size-4 text-destructive" /> },
    { label: "Events", value: stats?.totalEvents ?? recentActivities.length, icon: <BarChart3 className="size-4 text-amber-500" /> },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ─── Left: User info ─── */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xl select-none">
              {(user.name || user.email)[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base truncate">{user.name || "No name"}</CardTitle>
              <p className="text-sm text-muted-foreground truncate mt-0.5">{user.email}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Badge variant={user.isActive ? "default" : "destructive"} className="text-xs">
                  {user.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge variant={user.emailVerified ? "default" : "outline"} className="text-xs">
                  {user.emailVerified ? "Verified" : "Unverified"}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs capitalize border-primary/30 bg-primary/10 text-primary"
                >
                  {user.plan === "pro" && <Zap className="size-3 mr-1" />}
                  {user.plan === "business" && <Briefcase className="size-3 mr-1" />}
                  {user.plan}
                </Badge>
                <Badge variant={user.role === "admin" ? "secondary" : "outline"} className="text-xs capitalize">
                  {user.role}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Separator className="mb-1" />
          <div className="divide-y divide-border">
            <InfoRow
              icon={<Hash className="size-4" />}
              label="User ID"
              value={<span className="font-mono text-xs text-muted-foreground break-all">{user._id}</span>}
            />
            <InfoRow icon={<Mail className="size-4" />} label="Email" value={user.email} />
            <InfoRow
              icon={<Shield className="size-4" />}
              label="Plan"
              value={<span className="capitalize">{user.plan}</span>}
            />
            <InfoRow
              icon={<Coins className="size-4" />}
              label="Credits"
              value={
                <span>
                  <span className="text-foreground">{user.creditsBalance.toLocaleString()} remaining</span>
                  <span className="text-muted-foreground text-xs ml-2">({user.totalCreditsUsed.toLocaleString()} used total)</span>
                </span>
              }
            />
            {user.referralCode && (
              <InfoRow
                icon={<Hash className="size-4" />}
                label="Referral Code"
                value={<span className="font-mono">{user.referralCode}</span>}
              />
            )}
            <InfoRow
              icon={<Calendar className="size-4" />}
              label="Joined"
              value={format(new Date(user.createdAt), "MMM d, yyyy 'at' h:mm a")}
            />
            <InfoRow
              icon={<Clock className="size-4" />}
              label="Last Updated"
              value={format(new Date(user.updatedAt), "MMM d, yyyy 'at' h:mm a")}
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Right column ─── */}
      <div className="flex flex-col gap-4">
        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="size-4 text-muted-foreground" />
              Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {statItems.map(({ label, value, icon }) => (
                <div key={label} className="rounded-lg border border-border bg-muted/30 p-3 text-center flex flex-col items-center gap-1">
                  {icon}
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground leading-none">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Billing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              Billing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customer ? (
              <div className="divide-y divide-border">
                <InfoRow
                  icon={<CreditCard className="size-3.5" />}
                  label="Paddle Customer"
                  value={<span className="font-mono text-xs break-all">{customer.paddleCustomerId}</span>}
                />
                {customer.paddleSubscriptionStatus && (
                  <InfoRow
                    icon={<Activity className="size-3.5" />}
                    label="Sub Status"
                    value={
                      <Badge
                        variant={subStatusVariant[customer.paddleSubscriptionStatus] ?? "outline"}
                        className="text-xs capitalize"
                      >
                        {customer.paddleSubscriptionStatus}
                      </Badge>
                    }
                  />
                )}
                {customer.currentBillingPeriodEndsAt && (
                  <InfoRow
                    icon={<Calendar className="size-3.5" />}
                    label="Period Ends"
                    value={format(new Date(customer.currentBillingPeriodEndsAt), "MMM d, yyyy")}
                  />
                )}
                {customer.paddleScheduledChangeAction && (
                  <InfoRow
                    icon={<Clock className="size-3.5" />}
                    label="Scheduled"
                    value={
                      <Badge variant="outline" className="text-xs capitalize">
                        {customer.paddleScheduledChangeAction}
                      </Badge>
                    }
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No billing record</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Recent Activity ─── */}
      {recentActivities.length > 0 && (
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {recentActivities.slice(0, 8).map((act) => (
                <div key={act._id} className="flex items-start gap-3 py-3">
                  <div className="mt-0.5 shrink-0">
                    {act.status === "completed" || act.status === "success" ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : act.status === "failed" || act.status === "error" ? (
                      <XCircle className="size-4 text-destructive" />
                    ) : (
                      <Clock className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{act.title}</p>
                    {act.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{act.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="outline" className="text-xs capitalize">{act.category}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(act.createdAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
