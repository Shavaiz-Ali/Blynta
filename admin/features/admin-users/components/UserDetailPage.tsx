"use client";
import { useState } from "react";
import { useAdminUserDetailQuery } from "../queries";
import { UserDetailCard } from "./UserDetailCard";
import { EditUserDialog } from "./EditUserDialog";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { AppSpinner } from "@/components/common/AppSpinner";
import { AppButton } from "@/components/common/AppButton";
import { QueryErrorState } from "@/components/common/QueryErrorState";
export function UserDetailPage({ id }: { id: string }) { const query = useAdminUserDetailQuery(id); const [edit, setEdit] = useState(false); return <div className="space-y-6"><AppPageHeader title={query.data?.user.name || "Account details"} description={query.data?.user.email || "Account, subscription, usage, and activity."} action={<AppButton disabled={!query.data} onClick={() => setEdit(true)}>Edit account</AppButton>} />{query.isError ? <QueryErrorState onRetry={() => void query.refetch()} /> : query.isLoading ? <AppSpinner /> : query.data ? <UserDetailCard detail={query.data} /> : <p>Account not found.</p>}<EditUserDialog key={query.data?.user._id || "loading"} user={query.data?.user || null} open={edit} onOpenChange={setEdit} /></div>; }

