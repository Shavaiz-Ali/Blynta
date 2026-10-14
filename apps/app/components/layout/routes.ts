type AppRoute = {
  title: string;
  workspace?: boolean;
};

/** Match URL segments, including dynamic descendants, without substring matches. */
const sections = {
  dashboard: { title: "Home" },
  "my-clips": { title: "My Clips" },
  jobs: { title: "My Clips" },
  studio: { title: "AI Studio" },
  publications: { title: "Publications" },
  calendar: { title: "Calendar" },
  "social-accounts": { title: "Social Accounts" },
  billing: { title: "Billing" },
  profile: { title: "Profile" },
  activity: { title: "Activity" },
  notifications: { title: "Notifications" },
  settings: { title: "Settings" },
} satisfies Record<string, AppRoute>;

export function getAppRoute(pathname: string): AppRoute {
  const [section, resource] = pathname.split("/").filter(Boolean);
  const route = Object.hasOwn(sections, section)
    ? sections[section as keyof typeof sections]
    : { title: "Blynta" };
  return { ...route, workspace: section === "studio" && !!resource };
}
