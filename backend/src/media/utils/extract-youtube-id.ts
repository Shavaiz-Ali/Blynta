/**
 * Extracts the 11-character YouTube video ID from a URL.
 *
 * Handles the common URL shapes:
 *   - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *   - https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=45s
 *   - https://youtu.be/dQw4w9WgXcQ
 *   - https://youtube.com/shorts/dQw4w9WgXcQ
 *   - https://m.youtube.com/watch?v=dQw4w9WgXcQ
 *
 * Returns null if the URL doesn't match any known YouTube URL pattern.
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    // Standard watch URL (desktop + mobile): youtube.com/watch?v=X or m.youtube.com/watch?v=X
    /(?:(?:www\.|m\.)?youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    // Short URL: youtu.be/X
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Shorts: youtube.com/shorts/X
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
