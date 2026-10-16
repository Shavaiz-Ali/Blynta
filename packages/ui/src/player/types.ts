export interface PlayerMenuActions {
  onDownloadTranscript?: () => void;
  onDownloadSubtitles?: () => void;
  onDeleteClip?: () => void;
  hasTranscript?: boolean;
}

export interface StudioVideoPlayerProps extends PlayerMenuActions {
  /** Called when a signed source fails; the owner may refresh it. */
  onError?: () => void;
  ariaLabel?: string;
  src: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
  badgeText?: string;
  /** Fit natural media dimensions to the surrounding stage, with controls below the image. */
  dockedControls?: boolean;
  showTopBar?: boolean;
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
