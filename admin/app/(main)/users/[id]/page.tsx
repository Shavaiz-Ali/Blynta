import { UserDetailPage } from "@/features/admin-users/components/UserDetailPage";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <UserDetailPage id={id} />; }
