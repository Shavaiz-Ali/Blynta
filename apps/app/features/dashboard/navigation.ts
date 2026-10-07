export interface NavRoute {
  href: string;
  disabled?: boolean;
}

/** Match a section and its descendants without matching similarly named routes. */
export function isNavItemActive(pathname: string, item: NavRoute): boolean {
  if (item.disabled) return false;

  return (
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(`${item.href}/`))
  );
}
