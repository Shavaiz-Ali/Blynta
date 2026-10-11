const hosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "vimeo.com",
  "www.vimeo.com",
  "player.vimeo.com",
]);
export function generationSourceUrl(value: string) {
  const trimmed = value.trim();
  let url: URL;
  try {
    url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed,
    );
  } catch {
    throw Error("Paste a valid YouTube or Vimeo video link.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !hosts.has(url.hostname) ||
    url.href.length > 2048
  )
    throw Error("Use a YouTube or Vimeo HTTPS video link.");
  return url.href;
}
