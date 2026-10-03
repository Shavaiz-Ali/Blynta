export interface ShareView {
  id: string;
  jobId: string;
  clipId: string;
  token?: string | null;
  isActive: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShareInput {
  jobId: string;
  clipId: string;
  expiresAt?: string | null;
}

export interface CreateShareResult extends ShareView {
  token: string;
}

export interface UpdateShareInput {
  isActive?: boolean;
  expiresAt?: string | null;
}

export interface PublicShareResponse {
  clipTitle: string | null;
  videoTitle: string | null;
  thumbnailUrl: string | null;
  durationSec: number;
  hasCaptions: boolean;
  signedUrl: string;
  expiresAt: string | null;
}
