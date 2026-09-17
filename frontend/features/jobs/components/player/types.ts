export interface PlayerMenuActions {
  onDownloadTranscript?: () => void;
  onDownloadSubtitles?: () => void;
  onDeleteClip?: () => void;
  hasTranscript?: boolean;
}

export interface StudioVideoPlayerProps extends PlayerMenuActions {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
  badgeText?: string;
}

export interface ClipMediaStageProps extends PlayerMenuActions {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
  /** Small badge shown on the media area, e.g. "9:16". */
  badgeText?: string;
  /** Refetches the clip source after the video element failed to load it. */
  onRetry?: () => void;
  /** Download fallback shown when the stream cannot be played. */
  onDownload?: () => void;
  isDownloading?: boolean;
}
