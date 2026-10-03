import { signOut } from "@/auth";
import { AppButton } from "@blynta/ui";

export default function LogoutPage() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <p>Sign out of your current Blynta session across all products.</p>
      <AppButton type="submit">Sign out of Blynta</AppButton>
    </form>
  );
}
