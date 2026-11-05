import React from "react";

export function PlatformBar() {
  return (
    <section className="w-full border-y border-border bg-muted/30 py-5">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 sm:gap-10 px-4 text-center">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
          Works with
        </span>

        {/* YouTube */}
        <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
          <svg className="h-4 w-5 fill-red-600" viewBox="0 0 24 17">
            <path d="M23.5 2.6C23.2 1.6 22.4.8 21.4.5 19.5 0 12 0 12 0S4.5 0 2.6.5C1.6.8.8 1.6.5 2.6 0 4.5 0 8.5 0 8.5s0 4 .5 5.9c.3 1 1.1 1.8 2.1 2.1 1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5c1-.3 1.8-1.1 2.1-2.1.5-1.9.5-5.9.5-5.9s0-4-.5-5.9zM9.5 12.1V4.9l6.3 3.6-6.3 3.6z" />
          </svg>
          <span>YouTube</span>
        </div>

        {/* Vimeo */}
        <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
          <svg className="h-4 w-4 fill-sky-500" viewBox="0 0 24 21">
            <path d="M23.9 4.8c-.1 2.4-1.8 5.7-5.1 9.9-3.4 4.3-6.2 6.5-8.5 6.5-1.4 0-2.6-1.3-3.6-3.9-.7-2.6-1.4-5.2-2.1-7.7-.7-2.7-1.5-4.1-2.3-4.1-.2 0-.9.4-2.1 1.2L0 5.4c1.2-1.1 2.4-2.2 3.6-3.3 1.7-1.4 3-2.2 3.9-2.2 2.2 0 3.6 1.5 4.1 4.5.6 3.6 1 5.9 1.3 6.8.7 3.1 1.5 4.6 2.4 4.6.7 0 1.5-.9 2.5-2.7 1-1.8 1.5-3.2 1.5-4.2 0-1.6-.5-2.4-1.5-2.4-.5 0-1.1.1-1.7.4 1.1-3.6 3.2-5.3 6.3-5.3 2.3 0 3.5 1.5 3.6 4.4z" />
          </svg>
          <span>Vimeo</span>
        </div>

        {/* Spotify Podcasts */}
        <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-medium text-sm transition-colors">
          <span>Spotify Podcasts</span>
        </div>

        {/* TikTok */}
        <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-medium text-sm transition-colors">
          <span>TikTok</span>
        </div>

        {/* Instagram Reels */}
        <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-medium text-sm transition-colors">
          <span>Instagram Reels</span>
        </div>
      </div>
    </section>
  );
}

