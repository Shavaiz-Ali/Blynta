/** Cross-app navigation uses the configured Studio origin and carries no tokens. */
export function studioEditorUrl(
  projectId: string,
  configuredUrl: string | undefined,
) {
  if (!configuredUrl || !/^[a-f\d]{24}$/i.test(projectId))
    throw new Error("Studio destination unavailable");
  const base = new URL(configuredUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  )
    throw new Error("Invalid Studio destination");
  return new URL(`/editor/${projectId}`, base.origin).href;
}
