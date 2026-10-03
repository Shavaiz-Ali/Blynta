import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function JobsPage() {
  redirect("/my-clips");
}
