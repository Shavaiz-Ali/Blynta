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
      <p>Sign out of Blynta Auth, App and Studio.</p>
      <AppButton type="submit">Sign out of all consumer apps</AppButton>
    </form>
  );
}
