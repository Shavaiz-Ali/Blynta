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
