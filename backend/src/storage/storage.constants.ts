/** Persisted object prefixes and signed URL policies. Never rename existing keys. */
export const STORAGE_POLICY = {
  SOURCE_PREFIXES: ['source-videos/', 'job-sources/'] as const,
  DOWNLOAD_TTL_SECONDS: 3600,
  PUBLIC_FALLBACK_TTL_SECONDS: 7 * 24 * 3600,
  UPLOAD_TTL_SECONDS: 300,
  VIDEO_MIME: 'video/mp4',
} as const;
