export type PublicationStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "published"
  | "failed";

export type PublicationPlatform = "youtube";

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  thumbnail: string | null;
}

export interface YouTubeStatusResponse {
  connected: boolean;
  channel: YouTubeChannelInfo | null;
}

export interface YouTubeCategory {
  id: string;
  title: string;
}

export interface ClipPublication {
  _id: string;
  userId: string;
  jobId: string;
  clipId: string;
  platform: PublicationPlatform;
  status: PublicationStatus;
  title: string;
  description?: string;
  privacyStatus: "private" | "unlisted" | "public";
  tags?: string[];
  categoryId?: string;
  thumbnailKey?: string;
  externalId?: string;
  externalUrl?: string;
  publishedAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishToYouTubeInput {
  title: string;
  description?: string;
  privacyStatus: "private" | "unlisted" | "public";
  tags?: string[];
  categoryId?: string;
  thumbnailKey?: string;
}

export interface ThumbnailPresignedResponse {
  presignedUrl: string;
  thumbnailKey: string;
}

export interface ListPublicationsParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface UserPublicationsResponse {
  publications: ClipPublication[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
