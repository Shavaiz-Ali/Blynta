/** Transient playback updates only subscribed preview and transport controls. */
export class PlaybackClock {
  private snapshot = { playhead: 0, playing: false };
  private duration = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private listeners = new Set<() => void>();
  private lastTick = 0;
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(playhead: number, playing = this.snapshot.playing) {
    if (
      playhead === this.snapshot.playhead &&
      playing === this.snapshot.playing
    )
      return;
    this.snapshot = { playhead, playing };
    this.listeners.forEach((listener) => listener());
  }
  seek = (time: number) => {
    this.lastTick = performance.now();
    this.publish(Math.max(0, Math.min(this.duration, time)));
  };
  setDuration(duration: number) {
    this.duration = duration;
    if (this.snapshot.playhead >= duration) {
      this.stop();
      this.publish(duration, false);
    }
  }
  toggle = () => {
    if (this.snapshot.playing) {
      this.stop();
      return;
    }
    if (!this.duration) return;
    if (this.snapshot.playhead >= this.duration) this.seek(0);
    this.lastTick = performance.now();
    this.publish(this.snapshot.playhead, true);
    this.timer = setInterval(() => {
      const now = performance.now();
      const time = Math.min(
        this.duration,
        this.snapshot.playhead + (now - this.lastTick) / 1000,
      );
      this.lastTick = now;
      this.publish(time);
      if (time >= this.duration) this.stop();
    }, 100);
  };
  stop = () => {
    clearInterval(this.timer);
    this.timer = undefined;
    this.publish(this.snapshot.playhead, false);
  };
}
